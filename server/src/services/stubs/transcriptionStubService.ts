import logger from '../../utils/logger';
import { WhisperService } from '../transcription/whisperService';
import { TranscriptionCleanupService } from '../transcription/transcriptionCleanupService';

/**
 * Stub Whisper service - returns mock transcript without calling OpenAI
 */
export class WhisperStubService implements WhisperService {
  async transcribe(_audioBuffer: Buffer, _mimeType?: string): Promise<string> {
    logger.debug('Whisper stub - returning mock transcript');
    return 'This is a stub transcription of the recorded audio.';
  }
}

/**
 * Stub cleanup service - returns input as-is without calling Bedrock
 */
export class TranscriptionCleanupStubService implements TranscriptionCleanupService {
  async cleanup(rawTranscript: string) {
    logger.debug('Transcription cleanup stub - returning input unchanged');
    return { cleaned: rawTranscript, title: 'Stub Memory Title' };
  }
}

export const whisperStubService = new WhisperStubService();
export const transcriptionCleanupStubService = new TranscriptionCleanupStubService();
