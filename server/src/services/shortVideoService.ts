import { v4 as uuidv4 } from 'uuid';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { IImageGenerator, ImageGenerationInput, OpenAIImageGenerationOptions } from './interfaces/IImageGenerator';
import { MemorySummaryService } from './memorySummarizers/memorySummaryService';
import { IPromptBuilder, MultiSubjectData, MultiSubjectGridPromptInput } from './interfaces/IPromptBuilder';
import { User } from '../models/User';
import { Character, ICharacterDocument } from '../models/Character';
import { s3Client } from '../utils/s3Client';
import { stitchImages, buildGridLayoutDescription } from '../utils/imageStitcher';
import { applyShortVideoEffects, ShortVideoEffectsOptions } from '../utils/shortVideoEffects';
import { encodeFramesToMp4 } from '../utils/videoEncoder';
import { shortVideoPromptBuilder, ShortVideoPromptInput } from './promptBuilders/shortVideoPromptBuilder';
import { featureFlags } from './featureFlagService';
import logger from '../utils/logger';
import { IMemory } from '../../../shared/types/Memory';

export interface ShortVideoOptions {
  memoryTitle: string;
  memoryContent: string;
  memoryDate: Date | string;
  taggedCharacterIds?: string[];
  /** Frames per second (default 10) */
  fps?: number;
  /** Duration in seconds (default 1.5) */
  durationSeconds?: number;
  /** Generate N frames per batch; use last frame as ref for next batch (default: all in one) */
  framesPerBatch?: number;
  /** Post-processing effect options */
  effectsOptions?: ShortVideoEffectsOptions;
}

const DEFAULT_FPS = 6;
const DEFAULT_DURATION_SECONDS = 1.2;

/**
 * Short video service: generates 1–3 second looping videos by generating frames
 * sequentially with the GPT image model (prompt + last frame as reference),
 * then applying effects and encoding to MP4. Uses one LLM call for memory
 * summarization with no recent-memory context.
 */
export class ShortVideoService {
  constructor(
    private readonly imageGenerator: IImageGenerator,
    private readonly memorySummaryService: MemorySummaryService,
    private readonly multiSubjectPromptBuilder: IPromptBuilder
  ) {}

  /**
   * Generate a short video and return its S3 URI.
   */
  async generateShortVideo(userId: string, options: ShortVideoOptions): Promise<string> {
    const fps = options.fps ?? DEFAULT_FPS;
    const durationSeconds = options.durationSeconds ?? DEFAULT_DURATION_SECONDS;
    const framesPerBatch = options.framesPerBatch;
    const totalFrames = Math.max(1, Math.round(fps * durationSeconds));

    logger.info('ShortVideoService: starting generation', {
      userId,
      totalFrames,
      fps,
      durationSeconds,
      framesPerBatch,
    });

    const user = await User.findById(userId);
    if (!user) throw new Error(`User not found: ${userId}`);

    const memoryDate =
      typeof options.memoryDate === 'string' ? new Date(options.memoryDate) : options.memoryDate;

    // 1. One LLM call for memory summarization (no recent-memory context)
    const distilledScene = await this.distillMemory(
      options.memoryTitle,
      options.memoryContent,
      memoryDate,
      user.toObject() as any
    );

    // 2. Fetch user + character reference images and stitch if multiple
    const { referenceImageBase64, multiSubjectAppendix } = await this.fetchReferenceAndMultiSubject(
      userId,
      user.toObject() as any,
      memoryDate,
      options.taggedCharacterIds ?? []
    );

    if (!referenceImageBase64) {
      throw new Error('No reference image available for short video (user avatar or subject required)');
    }

    // 3. Build prompts
    const promptInput: ShortVideoPromptInput = {
      user: user.toObject() as any,
      distilledScene,
      memoryTitle: options.memoryTitle,
      memoryDate,
    };
    const firstFramePrompt =
      shortVideoPromptBuilder.buildFirstFramePrompt(promptInput) +
      (multiSubjectAppendix ? `\n\n${multiSubjectAppendix}` : '');
    const continuationPrompt =
      shortVideoPromptBuilder.buildContinuationPrompt(promptInput) +
      (multiSubjectAppendix ? `\n\n${multiSubjectAppendix}` : '');

    // 4. Generate frames (sequential; optional batching). Save each frame to S3 as we go for retry/failure recovery.
    const runId = `${Date.now()}-${uuidv4()}`;
    const framesBase64: string[] = [];
    let currentRefBase64 = referenceImageBase64;
    const batchSize = framesPerBatch && framesPerBatch > 0 ? framesPerBatch : totalFrames;
    const bucket = s3Client.getBucketName();

    for (let i = 0; i < totalFrames; i++) {
      const isFirst = i === 0;
      const prompt = isFirst ? firstFramePrompt : continuationPrompt;
      logger.info('ShortVideoService: generating frame', {
        frameIndex: i,
        totalFrames,
        promptLength: prompt.length,
      });
      logger.debug('ShortVideoService: frame prompt', { frameIndex: i, prompt });
      const input: ImageGenerationInput = {
        prompt,
        referenceImageBase64: currentRefBase64,
        userId,
      };
      const output = await this.imageGenerator.generateImage(input, {
        quality: 'low',
        size: '1024x1024',
      } as OpenAIImageGenerationOptions);
      framesBase64.push(output.imageBase64);
      currentRefBase64 = output.imageBase64;

      const frameKey = s3Client.getShortVideoKey(userId, `${runId}/frame-${String(i).padStart(4, '0')}.png`);
      await s3Client.getClient().send(
        new PutObjectCommand({
          Bucket: bucket,
          Key: frameKey,
          Body: Buffer.from(output.imageBase64, 'base64'),
          ContentType: 'image/png',
        })
      );
      logger.debug('ShortVideoService: frame saved to S3', { userId, runId, frameIndex: i, key: frameKey });

      if ((i + 1) % batchSize === 0 && i + 1 < totalFrames) {
        currentRefBase64 = output.imageBase64;
      }
    }

    // 5. Post-process (normal loop; no ping-pong; blink deferred)
    const processedFrames = await applyShortVideoEffects(
      framesBase64,
      options.effectsOptions ?? {}
    );

    // 6. Encode to MP4
    const mp4Buffer = await encodeFramesToMp4({
      framesBase64: processedFrames,
      fps,
    });

    // 7. Upload final MP4 to S3
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
    logger.info('ShortVideoService: short video generated and uploaded', { userId, s3Uri });
    return s3Uri;
  }

  private async distillMemory(
    title: string,
    content: string,
    date: Date,
    user: any
  ): Promise<string> {
    const memory: IMemory = {
      _id: 'short-video-memory',
      title,
      content,
      date,
      author: user._id,
      tags: [],
      images: [],
      likes: [],
      comments: [],
      isPublic: false,
    } as IMemory;
    return this.memorySummaryService.generateMemorySummary(memory, user, {
      summaryLength: 'brief',
      includeUserContext: true,
    });
  }

  private async fetchReferenceAndMultiSubject(
    userId: string,
    user: any,
    memoryDate: Date,
    taggedCharacterIds: string[]
  ): Promise<{
    referenceImageBase64: string | undefined;
    multiSubjectAppendix: string | null;
  }> {
    const referenceImagesBase64: string[] = [];
    const peopleNames: string[] = [`${user.firstName} ${user.lastName}`];

    const userRef = await this.fetchUserReferenceImage(userId);
    if (userRef) referenceImagesBase64.push(userRef);

    const characterData = await this.fetchCharacterReferenceImages(userId, taggedCharacterIds);
    for (const { base64, character } of characterData) {
      if (base64 && character) {
        referenceImagesBase64.push(base64);
        peopleNames.push(`${character.firstName} ${character.lastName}`);
      }
    }

    if (referenceImagesBase64.length === 0) {
      return { referenceImageBase64: undefined, multiSubjectAppendix: null };
    }

    let referenceImageBase64: string;
    let multiSubjectAppendix: string | null = null;

    if (referenceImagesBase64.length > 1) {
      const stitchResult = await stitchImages(referenceImagesBase64);
      referenceImageBase64 = stitchResult.combinedImageBase64;
      const gridDescription = buildGridLayoutDescription(stitchResult.layout, peopleNames);
      const subjects = this.buildMultiSubjectData(user, characterData, memoryDate);
      multiSubjectAppendix = this.multiSubjectPromptBuilder.buildMultiSubjectGridPrompt({
        gridDescription,
        subjects,
      });
    } else {
      referenceImageBase64 = referenceImagesBase64[0]!;
    }

    return { referenceImageBase64, multiSubjectAppendix };
  }

  /** Prefer subject/reference photo over generated avatar for short-video consistency. */
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

  private async fetchCharacterReferenceImage(
    userId: string,
    characterId: string
  ): Promise<string | undefined> {
    const useMultiAngle = featureFlags.isEnabled('useMultiAngleReferences');
    const bucket = s3Client.getBucketName();
    if (useMultiAngle) {
      try {
        const key = s3Client.getCharacterMultiAngleKey(userId, characterId);
        return await s3Client.getObjectAsBase64(bucket, key);
      } catch {
        // fall through to avatar
      }
    }
    try {
      const key = s3Client.getCharacterAvatarKey(userId, characterId);
      return await s3Client.getObjectAsBase64(bucket, key);
    } catch {
      return undefined;
    }
  }

  private async fetchCharacterReferenceImages(
    userId: string,
    characterIds: string[]
  ): Promise<{ characterId: string; base64: string | undefined; character: ICharacterDocument }[]> {
    const results: {
      characterId: string;
      base64: string | undefined;
      character: ICharacterDocument;
    }[] = [];
    for (const characterId of characterIds) {
      try {
        const character = await Character.findOne({ _id: characterId, userId });
        if (!character) continue;
        const base64 = await this.fetchCharacterReferenceImage(userId, characterId);
        results.push({ characterId, base64, character });
      } catch (err) {
        logger.warn('ShortVideoService: failed to fetch character ref', { userId, characterId });
      }
    }
    return results;
  }

  private buildMultiSubjectData(
    user: any,
    characterData: { character: ICharacterDocument }[],
    memoryDate: Date
  ): MultiSubjectData[] {
    const subjects: MultiSubjectData[] = [];
    const userAgeAtMemory = this.calculateAgeAtDate(user.age, memoryDate);
    const userDeAging = this.getDeAgingInstruction(user.age, userAgeAtMemory);
    subjects.push({
      name: `${user.firstName} ${user.lastName}`,
      isPrimary: true,
      deAgingInstruction: userDeAging ?? undefined,
    });
    for (const { character } of characterData) {
      const ageAtMemory = this.calculateAgeAtDate(character.age, memoryDate);
      const deAging = this.getDeAgingInstruction(character.age, ageAtMemory);
      subjects.push({
        name: `${character.firstName} ${character.lastName}`,
        relationship: character.relationship,
        deAgingInstruction: deAging ?? undefined,
      });
    }
    return subjects;
  }

  private calculateAgeAtDate(currentAge: number, memoryDate: Date): number {
    const now = new Date();
    const yearsAgo = (now.getTime() - memoryDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
    return Math.max(0, Math.round(currentAge - yearsAgo));
  }

  private getDeAgingInstruction(currentAge: number, ageAtMemory: number): string | null {
    const diff = currentAge - ageAtMemory;
    if (diff > 5) {
      return `depict as approximately ${ageAtMemory} years old (${diff} years younger than current)`;
    }
    return null;
  }
}
