import { Request, Response } from 'express';
import { ApiResponse } from '../../../shared/types/ApiResponse';
import { AppError } from '../utils/errorHandler';
import logger from '../utils/logger';
import { s3Client } from '../utils/s3Client';
import { whisperService } from '../services/transcription/whisperService';
import { transcriptionCleanupService } from '../services/transcription/transcriptionCleanupService';
import { whisperStubService, transcriptionCleanupStubService } from '../services/stubs/transcriptionStubService';

const USE_STUB_TRANSCRIPTION = process.env.USE_STUB_TRANSCRIPTION === 'true';
const USE_STUB = process.env.USE_STUB === 'true';

const getWhisperService = () => (USE_STUB || USE_STUB_TRANSCRIPTION ? whisperStubService : whisperService);
const getCleanupService = () =>
  USE_STUB || USE_STUB_TRANSCRIPTION ? transcriptionCleanupStubService : transcriptionCleanupService;

const MIN_AUDIO_SIZE = 100;
const MAX_AUDIO_SIZE = 25 * 1024 * 1024;

/**
 * Generate presigned URL for uploading audio to S3.
 * Use this flow in Lambda (API Gateway does not support multipart/form-data).
 */
export async function generatePresignedTranscriptionUrl(req: Request, res: Response) {
  try {
    if (!req.user?._id) {
      throw new AppError('Not authenticated', 401);
    }

    const { contentType } = req.body as { contentType?: string };
    const allowed = ['audio/webm', 'audio/webm;codecs=opus', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/m4a'];
    const ct = contentType || 'audio/webm';
    if (!allowed.includes(ct) && !ct.startsWith('audio/')) {
      throw new AppError('Invalid content type. Use audio/webm, audio/mp4, etc.', 400);
    }

    const { presignedUrl, key } = await s3Client.generatePresignedTranscriptionUploadUrl(req.user._id, ct);

    const response: ApiResponse<{ uploadUrl: string; key: string }> = {
      status: 'success',
      data: { uploadUrl: presignedUrl, key },
    };
    return res.json(response);
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Failed to generate presigned transcription URL', { error: (error as Error).message });
    throw new AppError('Failed to generate upload URL', 500);
  }
}

/**
 * Transcribe audio from S3 key. Fetches file from S3, runs Whisper + cleanup.
 */
export async function transcribeFromS3(req: Request, res: Response) {
  try {
    if (!req.user?._id) {
      throw new AppError('Not authenticated', 401);
    }

    const { key } = req.body as { key?: string };
    if (!key || typeof key !== 'string') {
      throw new AppError('S3 key is required', 400);
    }

    // Validate key is under transcriptions prefix and belongs to user
    const transcriptionsPrefix = process.env.S3_TRANSCRIPTION_PREFIX || 'transcriptions/';
    const userPrefix = `${transcriptionsPrefix}${req.user._id}/`;
    if (!key.startsWith(userPrefix)) {
      throw new AppError('Invalid S3 key', 400);
    }

    const bucket = s3Client.getBucketName();
    const buffer = await s3Client.getObjectAsBuffer(bucket, key);

    if (buffer.length < MIN_AUDIO_SIZE) {
      throw new AppError('Recording too short. Please record at least a few seconds of audio.', 400);
    }
    if (buffer.length > MAX_AUDIO_SIZE) {
      throw new AppError('Recording too large. Maximum size is 25MB.', 400);
    }

    const mimeType = key.endsWith('.m4a') ? 'audio/mp4' : 'audio/webm';

    const whisper = getWhisperService();
    const rawTranscript = await whisper.transcribe(buffer, mimeType);

    if (!rawTranscript || !rawTranscript.trim()) {
      throw new AppError('No speech detected in the recording. Please try again.', 400);
    }

    const cleanup = getCleanupService();
    const { cleaned, title } = await cleanup.cleanup(rawTranscript);

    const response: ApiResponse<{ cleaned: string; title?: string }> = {
      status: 'success',
      data: { cleaned, title },
    };
    return res.json(response);
  } catch (error) {
    if (error instanceof AppError) throw error;
    logger.error('Transcription failed', { error: (error as Error).message });
    throw new AppError('Transcription failed. Please try again.', 502);
  }
}
