import { Request, Response } from 'express';
import { ApiResponse } from '../../../shared/types/ApiResponse';
import { AppError } from '../utils/errorHandler';
import logger from '../utils/logger';
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

export async function transcribe(req: Request, res: Response) {
  try {
    const file = req.file;
    if (!file || !file.buffer) {
      throw new AppError('No audio file provided', 400);
    }

    const buffer = file.buffer as Buffer;
    if (buffer.length < MIN_AUDIO_SIZE) {
      throw new AppError('Recording too short. Please record at least a few seconds of audio.', 400);
    }
    if (buffer.length > MAX_AUDIO_SIZE) {
      throw new AppError('Recording too large. Maximum size is 25MB.', 400);
    }

    const mimeType = file.mimetype;

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
    if (error instanceof AppError) {
      throw error;
    }
    logger.error('Transcription failed', { error: (error as Error).message });
    throw new AppError('Transcription failed. Please try again.', 502);
  }
}
