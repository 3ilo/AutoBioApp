import { v4 as uuidv4 } from 'uuid';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { IImageGenerator, ImageGenerationInput, OpenAIImageGenerationOptions } from './interfaces/IImageGenerator';
import { MomentSummarizerService } from './shortVideo/momentSummarizerService';
import { ShortVideoDistillerService, DistillerElement } from './shortVideo/shortVideoDistillerService';
import { User } from '../models/User';
import { s3Client } from '../utils/s3Client';
import { stitchImages } from '../utils/imageStitcher';
import { applyShortVideoEffects, ShortVideoEffectsOptions } from '../utils/shortVideoEffects';
import { encodeFramesToMp4 } from '../utils/videoEncoder';
import { retryWithBackoff } from '../utils/retryWithBackoff';
import {
  shortVideoPromptBuilder,
  FrameSpecInput,
  FrameSpecFixedElements,
} from './promptBuilders/shortVideoPromptBuilder';
import logger from '../utils/logger';
import { IMemory } from '../../../shared/types/Memory';

/** Single step in the short-video workflow log (request/response for debugging). */
export interface ShortVideoWorkflowLogStep {
  step: string;
  timestamp: string;
  request?: Record<string, unknown>;
  response?: Record<string, unknown>;
  error?: string;
}

/** Full workflow log written to S3 for each short-video run. */
export interface ShortVideoWorkflowLog {
  runId: string;
  userId: string;
  startedAt: string;
  finishedAt?: string;
  steps: ShortVideoWorkflowLogStep[];
  s3WorkflowLogKey?: string;
}

const SHORT_VIDEO_MAX_FRAMES = (() => {
  const n = parseInt(process.env.SHORT_VIDEO_MAX_FRAMES || '6', 10);
  return Number.isNaN(n) ? 6 : Math.min(6, Math.max(1, n));
})();
const DEFAULT_FPS = 2;
const DEFAULT_DURATION_SECONDS = 3;

export interface ShortVideoOptions {
  memoryTitle: string;
  memoryContent: string;
  memoryDate: Date | string;
  taggedCharacterIds?: string[];
  fps?: number;
  durationSeconds?: number;
  framesPerBatch?: number;
  effectsOptions?: ShortVideoEffectsOptions;
}

/**
 * Short video service: flipbook-style pipeline with moment summarizer, distiller,
 * element images, and frame generation. Aggregates a workflow log per run and
 * uploads it to S3 alongside frames and final MP4. Uses retries for image generation.
 */
export class ShortVideoService {
  constructor(
    private readonly imageGenerator: IImageGenerator,
    private readonly momentSummarizer: MomentSummarizerService,
    private readonly distiller: ShortVideoDistillerService
  ) {}

  async generateShortVideo(userId: string, options: ShortVideoOptions): Promise<string> {
    const fps = options.fps ?? DEFAULT_FPS;
    const durationSeconds = options.durationSeconds ?? DEFAULT_DURATION_SECONDS;
    const totalFrames = Math.min(
      SHORT_VIDEO_MAX_FRAMES,
      Math.max(1, Math.round(fps * durationSeconds))
    );
    const bucket = s3Client.getBucketName();
    const runId = `${Date.now()}-${uuidv4()}`;
    const startedAt = new Date().toISOString();
    const workflowLog: ShortVideoWorkflowLog = {
      runId,
      userId,
      startedAt,
      steps: [],
    };

    const pushStep = (step: Omit<ShortVideoWorkflowLogStep, 'timestamp'>) => {
      workflowLog.steps.push({ ...step, timestamp: new Date().toISOString() });
    };

    const uploadWorkflowLog = async () => {
      workflowLog.finishedAt = new Date().toISOString();
      const workflowLogKey = s3Client.getShortVideoKey(userId, `${runId}/workflow-log.json`);
      workflowLog.s3WorkflowLogKey = workflowLogKey;
      const body = JSON.stringify(workflowLog, null, 2);
      await s3Client.getClient().send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: workflowLogKey,
          Body: Buffer.from(body, 'utf-8'),
          ContentType: 'application/json',
        })
      );
      logger.info('ShortVideoService: workflow log uploaded', { userId, runId, key: workflowLogKey });
    };

    try {
      logger.info('ShortVideoService: starting generation', {
        userId,
        runId,
        totalFrames,
        fps,
        durationSeconds,
      });

      const user = await User.findById(userId);
      if (!user) throw new Error(`User not found: ${userId}`);

      const userObj = user.toObject() as any;
      const memoryDate =
        typeof options.memoryDate === 'string' ? new Date(options.memoryDate) : options.memoryDate;

      const memory: IMemory = {
        _id: 'short-video-memory',
        title: options.memoryTitle,
        content: options.memoryContent,
        date: memoryDate,
        author: userObj._id,
        tags: [],
        images: [],
        likes: [],
        comments: [],
        isPublic: false,
      } as IMemory;

      // 1. Moment summarizer
      const momentResult = await this.momentSummarizer.extractMoment(memory, userObj);
      const moment = momentResult.moment;
      pushStep({
        step: 'moment_summarizer',
        request: { systemPrompt: momentResult.systemPrompt, userPrompt: momentResult.userPrompt },
        response: { moment },
      });

      // 2. Distiller
      const distillerResult = await this.distiller.distill(moment, totalFrames);
      const spec = distillerResult.spec;
      pushStep({
        step: 'distiller',
        request: {
          systemPrompt: distillerResult.systemPrompt,
          userPrompt: distillerResult.userPrompt,
          totalFrames,
        },
        response: {
          rawResponse: distillerResult.rawResponse,
          spec: {
            fixedElements: spec.fixedElements,
            frames: spec.frames,
            elements: spec.elements,
          },
        },
      });

      // 3. User ref (for subject element)
      const userRefBase64 = await this.fetchUserReferenceImage(userId);
      if (!userRefBase64) {
        throw new Error('No reference image available for short video (user avatar or subject required)');
      }

      // 4. Element images: subject = user ref; others = generate (with retry), then stitch
      const elementImagesBase64 = await this.generateElementImages(
        spec.elements,
        userRefBase64,
        userId,
        bucket,
        runId,
        (step) => pushStep(step)
      );
      const { combinedImageBase64: elementsReferenceBase64 } = await stitchImages(elementImagesBase64);

      // 5. Frame loop (parallel; each frame uses same elements reference; retry per frame)
      const fixedElementsForPrompt: FrameSpecFixedElements = {
        setting: spec.fixedElements.setting,
        subjectInScene: spec.fixedElements.subjectInScene,
        props: spec.fixedElements.props,
        mood: spec.fixedElements.mood,
      };

      const frameIndices = Array.from({ length: totalFrames }, (_, i) => i);
      const frameResults = await Promise.all(
        frameIndices.map(async (i) => {
          const prompt = shortVideoPromptBuilder.buildFramePromptFromSpec({
            user: userObj,
            fixedElements: fixedElementsForPrompt,
            action: spec.frames[i].action,
            frameIndex: i,
            totalFrames,
          });
          const action = spec.frames[i].action;

          const input: ImageGenerationInput = {
            prompt,
            referenceImageBase64: elementsReferenceBase64,
            userId,
          };
          const options = { quality: 'low', size: '1024x1024' } as OpenAIImageGenerationOptions;
          const output = await retryWithBackoff(() =>
            this.imageGenerator.generateImage(input, options)
          );

          const frameKey = s3Client.getShortVideoKey(
            userId,
            `${runId}/frame-${String(i).padStart(4, '0')}.png`
          );
          await s3Client.getClient().send(
            new PutObjectCommand({
              Bucket: bucket,
              Key: frameKey,
              Body: Buffer.from(output.imageBase64, 'base64'),
              ContentType: 'image/png',
            })
          );

          return { imageBase64: output.imageBase64, frameIndex: i, prompt, action, s3Key: frameKey };
        })
      );

      frameResults
        .sort((a, b) => a.frameIndex - b.frameIndex)
        .forEach((r) => {
          pushStep({
            step: `frame_${r.frameIndex}`,
            request: { prompt: r.prompt, action: r.action, frameIndex: r.frameIndex },
            response: { s3Key: r.s3Key },
          });
        });

      const framesBase64 = frameResults.sort((a, b) => a.frameIndex - b.frameIndex).map((r) => r.imageBase64);

      // 6. Post-process, encode, S3
      const processedFrames = await applyShortVideoEffects(
        framesBase64,
        options.effectsOptions ?? {}
      );

      const mp4Buffer = await encodeFramesToMp4({
        framesBase64: processedFrames,
        fps,
      });

      const timestamp = Date.now();
      const uniqueId = uuidv4();
      const filename = `${timestamp}-${uniqueId}.mp4`;
      const key = s3Client.getShortVideoKey(userId, filename);

      await s3Client.getClient().send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: key,
          Body: mp4Buffer,
          ContentType: 'video/mp4',
        })
      );

      const s3Uri = `s3://${bucket}/${key}`;
      pushStep({
        step: 'final',
        request: {},
        response: { s3Uri, fps, totalFrames },
      });
      await uploadWorkflowLog();
      logger.info('ShortVideoService: short video generated and uploaded', { userId, runId, s3Uri });
      return s3Uri;
    } catch (err) {
      pushStep({
        step: 'error',
        request: {},
        error: err instanceof Error ? err.message : String(err),
      });
      await uploadWorkflowLog().catch((uploadErr) => {
        logger.error('ShortVideoService: failed to upload workflow log on error', {
          userId,
          runId,
          uploadError: uploadErr instanceof Error ? uploadErr.message : String(uploadErr),
        });
      });
      throw err;
    }
  }

  /**
   * Generate images for each element: subject uses user ref; others generated in parallel (with retry each).
   * Returns ordered list of base64 images for stitching.
   */
  private async generateElementImages(
    elements: DistillerElement[],
    userRefBase64: string,
    userId: string,
    bucket: string,
    runId: string,
    pushStep: (step: Omit<ShortVideoWorkflowLogStep, 'timestamp'>) => void
  ): Promise<string[]> {
    const result: string[] = new Array(elements.length);
    const stepEntries: { index: number; step: Omit<ShortVideoWorkflowLogStep, 'timestamp'> }[] = [];

    // Subject element that is the user: use user ref and upload to S3 so element-XX.png exists for debugging
    for (let i = 0; i < elements.length; i++) {
      const el = elements[i];
      if (el?.type === 'subject' && el.isUser === true) {
        result[i] = userRefBase64;
        const elementKey = s3Client.getShortVideoKey(
          userId,
          `${runId}/element-${String(i).padStart(2, '0')}.png`
        );
        await s3Client.getClient().send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: elementKey,
            Body: Buffer.from(userRefBase64, 'base64'),
            ContentType: 'image/png',
          })
        );
        stepEntries.push({
          index: i,
          step: {
            step: `element_${i}`,
            request: { type: el.type, description: el.description, isUser: true },
            response: { skipped: true, note: 'user reference used', s3Key: elementKey },
          },
        });
      }
    }

    // Elements that are generated: non-subject (prop/setting) and subject with isUser !== true
    const jobs = elements
      .map((el, i) => (el.type !== 'subject' || el.isUser !== true ? { el, index: i } : null))
      .filter((j): j is { el: DistillerElement; index: number } => j !== null);

    const generated = await Promise.all(
      jobs.map(async ({ el, index: i }) => {
        const prompt = shortVideoPromptBuilder.buildElementImagePrompt(el.description);
        const elementKey = s3Client.getShortVideoKey(
          userId,
          `${runId}/element-${String(i).padStart(2, '0')}.png`
        );
        const output = await retryWithBackoff(() =>
          this.imageGenerator.generateImage(
            { prompt, referenceImageBase64: userRefBase64, userId },
            { quality: 'low', size: '1024x1024' } as OpenAIImageGenerationOptions
          )
        );
        await s3Client.getClient().send(
          new PutObjectCommand({
            Bucket: bucket,
            Key: elementKey,
            Body: Buffer.from(output.imageBase64, 'base64'),
            ContentType: 'image/png',
          })
        );
        return {
          index: i,
          imageBase64: output.imageBase64,
          step: {
            step: `element_${i}`,
            request: { type: el.type, description: el.description, prompt },
            response: { s3Key: elementKey },
          },
        };
      })
    );

    generated.forEach(({ index: i, imageBase64, step }) => {
      result[i] = imageBase64;
      stepEntries.push({ index: i, step });
    });
    stepEntries.sort((a, b) => a.index - b.index).forEach(({ step }) => pushStep(step));

    return result;
  }

  private async fetchUserReferenceImage(userId: string): Promise<string | undefined> {
    try {
      const bucket = s3Client.getBucketName();
      const key = s3Client.getSubjectKey(userId);
      return await s3Client.getObjectAsBase64(bucket, key);
    } catch {
      try {
        const bucket = s3Client.getBucketName();
        const key = s3Client.getAvatarKey(userId);
        return await s3Client.getObjectAsBase64(bucket, key);
      } catch (err) {
        logger.warn('ShortVideoService: no user reference image', { userId });
        return undefined;
      }
    }
  }
}
