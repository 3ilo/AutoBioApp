import axios from 'axios';
import FormData from 'form-data';
import logger from '../../utils/logger';

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const WHISPER_MODEL = 'whisper-1';

export interface WhisperService {
  transcribe(audioBuffer: Buffer, mimeType?: string): Promise<string>;
}

export class OpenAIWhisperService implements WhisperService {
  constructor() {
    if (!OPENAI_API_KEY) {
      logger.warn('OPENAI_API_KEY not configured - Whisper transcription will fail on requests');
    }
  }

  async transcribe(audioBuffer: Buffer, mimeType?: string): Promise<string> {
    if (!OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY not configured');
    }

    const ext = this.getExtensionFromMime(mimeType);
    const filename = `recording.${ext}`;

    const formData = new FormData();
    formData.append('file', audioBuffer, {
      filename,
      contentType: mimeType || 'audio/webm',
    });
    formData.append('model', WHISPER_MODEL);
    formData.append('response_format', 'text');

    try {
      const response = await axios.post<string>(
        'https://api.openai.com/v1/audio/transcriptions',
        formData,
        {
          headers: {
            Authorization: `Bearer ${OPENAI_API_KEY}`,
            ...formData.getHeaders(),
          },
          timeout: 60000,
        }
      );

      const text = typeof response.data === 'string' ? response.data : (response.data as { text?: string })?.text || '';
      logger.debug('Whisper transcription complete', { textLength: text.length });
      return text.trim();
    } catch (error) {
      logger.error('Whisper transcription failed', {
        error: (error as Error).message,
      });
      throw error;
    }
  }

  private getExtensionFromMime(mimeType?: string): string {
    if (!mimeType) return 'webm';
    if (mimeType.includes('webm')) return 'webm';
    if (mimeType.includes('mp4') || mimeType.includes('m4a')) return 'm4a';
    if (mimeType.includes('mpeg') || mimeType.includes('mp3')) return 'mp3';
    if (mimeType.includes('wav')) return 'wav';
    if (mimeType.includes('ogg')) return 'ogg';
    return 'webm';
  }
}

export const whisperService = new OpenAIWhisperService();
