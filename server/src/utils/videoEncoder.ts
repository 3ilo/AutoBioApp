import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const ffmpeg = require('fluent-ffmpeg') as typeof import('fluent-ffmpeg');
import logger from './logger';

const FFMPEG_PATH = process.env.FFMPEG_PATH;
if (FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(FFMPEG_PATH);
  logger.debug('Video encoder: using FFMPEG_PATH', { path: FFMPEG_PATH });
}

export interface EncodeFramesToMp4Options {
  /** Frames as base64-encoded PNG strings (in order) */
  framesBase64: string[];
  /** Output frame rate (e.g. 8–12) */
  fps: number;
}

/**
 * Encode a sequence of PNG frames to a single MP4 file.
 * Writes frames to a temp directory, runs ffmpeg, returns the MP4 buffer and cleans up.
 * Requires the ffmpeg binary to be installed on the host (and in PATH for Lambda/layers if deployed).
 *
 * @param options - Frames and fps
 * @returns MP4 file as Buffer
 */
export async function encodeFramesToMp4(options: EncodeFramesToMp4Options): Promise<Buffer> {
  const { framesBase64, fps } = options;
  if (framesBase64.length === 0) {
    throw new Error('At least one frame is required to encode video');
  }

  const tempDir = path.join(os.tmpdir(), `short-video-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`);
  await fs.mkdir(tempDir, { recursive: true });

  try {
    // Write frames as frame_0000.png, frame_0001.png, ... for ffmpeg %04d pattern
    for (let i = 0; i < framesBase64.length; i++) {
      const framePath = path.join(tempDir, `frame_${String(i).padStart(4, '0')}.png`);
      const buffer = Buffer.from(framesBase64[i], 'base64');
      await fs.writeFile(framePath, buffer);
    }

    const inputPattern = path.join(tempDir, 'frame_%04d.png');
    const outputPath = path.join(tempDir, 'output.mp4');

    await new Promise<void>((resolve, reject) => {
      ffmpeg()
        .input(inputPattern)
        .inputOptions([`-framerate`, String(fps)])
        .outputOptions(['-c:v libx264', '-pix_fmt yuv420p'])
        .output(outputPath)
        .on('end', () => resolve())
        .on('error', (err: Error) => {
          const msg = err?.message ?? String(err);
          if (msg.includes('Cannot find ffmpeg') || msg.includes('ffmpeg not found')) {
            reject(
              new Error(
                'ffmpeg is not installed or not on PATH. Install ffmpeg (e.g. brew install ffmpeg on macOS) or set FFMPEG_PATH to the full path of the ffmpeg binary.'
              )
            );
          } else {
            reject(err);
          }
        })
        .run();
    });

    const mp4Buffer = await fs.readFile(outputPath);
    logger.info('Video encoder: encoded frames to MP4', {
      frameCount: framesBase64.length,
      fps,
      outputSize: mp4Buffer.length,
    });
    return mp4Buffer;
  } finally {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch (cleanupErr) {
      logger.warn('Video encoder: failed to remove temp dir', {
        tempDir,
        error: (cleanupErr as Error).message,
      });
    }
  }
}
