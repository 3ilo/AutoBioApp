import sharp from 'sharp';
import logger from './logger';

export interface ShortVideoEffectsOptions {
  /** Duplicate every Nth frame for choppiness (default 2; 0 = skip) */
  duplicateEveryNth?: number;
  /** Film grain strength 0–255 (default 4; 0 = skip) */
  grainStrength?: number;
  /** Parallax shift in pixels (default 1; 0 = skip) */
  parallaxShiftPx?: number;
  /** Insert smear (blend) frame between frames (default true) */
  smearFrames?: boolean;
}

/**
 * Duplicate every Nth frame to add slight choppiness.
 */
export async function applyFrameDuplication(
  framesBase64: string[],
  everyNth: number = 2
): Promise<string[]> {
  if (everyNth <= 1 || framesBase64.length === 0) return framesBase64;
  const out: string[] = [];
  for (let i = 0; i < framesBase64.length; i++) {
    out.push(framesBase64[i]);
    if ((i + 1) % everyNth === 0 && i < framesBase64.length - 1) {
      out.push(framesBase64[i]);
    }
  }
  logger.debug('ShortVideoEffects: frame duplication', { inputFrames: framesBase64.length, outputFrames: out.length, everyNth });
  return out;
}

/**
 * Add subtle film grain (per-pixel luminance noise) to each frame.
 */
export async function applyFilmGrain(
  framesBase64: string[],
  strength: number = 4
): Promise<string[]> {
  if (strength <= 0 || framesBase64.length === 0) return framesBase64;
  const result: string[] = [];
  for (let f = 0; f < framesBase64.length; f++) {
    const buf = Buffer.from(framesBase64[f], 'base64');
    const img = sharp(buf);
    const { data, info } = await img.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
    const { width, height, channels } = info;
    const ch = channels || 4;
    for (let i = 0; i < data.length; i += ch) {
      const noise = () => Math.floor((Math.random() * 2 - 1) * strength);
      data[i] = Math.max(0, Math.min(255, data[i]! + noise()));
      data[i + 1] = Math.max(0, Math.min(255, data[i + 1]! + noise()));
      data[i + 2] = Math.max(0, Math.min(255, data[i + 2]! + noise()));
    }
    const outBuf = await sharp(data, { raw: { width, height, channels: ch } })
      .png()
      .toBuffer();
    result.push(outBuf.toString('base64'));
  }
  logger.debug('ShortVideoEffects: film grain applied', { frameCount: framesBase64.length, strength });
  return result;
}

/**
 * Apply subtle per-frame parallax-style shift (alternating or sine offset).
 */
export async function applyParallaxShift(
  framesBase64: string[],
  shiftPx: number = 1
): Promise<string[]> {
  if (shiftPx <= 0 || framesBase64.length === 0) return framesBase64;
  const result: string[] = [];
  for (let i = 0; i < framesBase64.length; i++) {
    const buf = Buffer.from(framesBase64[i], 'base64');
    const meta = await sharp(buf).metadata();
    const w = meta.width || 1024;
    const h = meta.height || 1024;
    const offsetX = Math.round(Math.sin((i / Math.max(1, framesBase64.length)) * Math.PI * 2) * shiftPx);
    const offsetY = Math.round(Math.cos((i / Math.max(1, framesBase64.length)) * Math.PI * 2) * shiftPx * 0.5);
    const pad = shiftPx * 2;
    const extended = await sharp(buf)
      .extend({ top: pad, bottom: pad, left: pad, right: pad })
      .toBuffer();
    const extracted = await sharp(extended)
      .extract({
        left: pad + offsetX,
        top: pad + offsetY,
        width: w,
        height: h,
      })
      .png()
      .toBuffer();
    result.push(extracted.toString('base64'));
  }
  logger.debug('ShortVideoEffects: parallax shift applied', { frameCount: framesBase64.length, shiftPx });
  return result;
}

/**
 * Insert one light smear (blend of adjacent frames) between the first and second frame.
 */
export async function applySmearFrame(framesBase64: string[]): Promise<string[]> {
  if (framesBase64.length < 2) return framesBase64;
  const buf0 = Buffer.from(framesBase64[0], 'base64');
  const buf1 = Buffer.from(framesBase64[1], 'base64');
  const img0 = sharp(buf0);
  const img1 = sharp(buf1);
  const { data: data0, info } = await img0.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { data: data1 } = await img1.ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  const { width, height, channels } = info;
  const ch = channels || 4;
  const blended = Buffer.alloc(data0.length);
  for (let i = 0; i < data0.length; i++) {
    blended[i] = Math.round((data0[i]! + data1[i]!) / 2);
  }
  const smearBuf = await sharp(blended, { raw: { width: width!, height: height!, channels: ch } })
    .png()
    .toBuffer();
  const smearB64 = smearBuf.toString('base64');
  const result = [framesBase64[0], smearB64, ...framesBase64.slice(1)];
  logger.debug('ShortVideoEffects: smear frame inserted', { totalFrames: result.length });
  return result;
}

/**
 * Apply all short-video effects in sequence: duplication, grain, parallax, smear.
 * Normal loop is implicit (no ping-pong); blink is deferred.
 */
export async function applyShortVideoEffects(
  framesBase64: string[],
  options: ShortVideoEffectsOptions = {}
): Promise<string[]> {
  if (framesBase64.length === 0) return [];
  const {
    duplicateEveryNth = 2,
    grainStrength = 4,
    parallaxShiftPx = 1,
    smearFrames = true,
  } = options;

  let frames = framesBase64;

  if (duplicateEveryNth > 1) {
    frames = await applyFrameDuplication(frames, duplicateEveryNth);
  }
  if (grainStrength > 0) {
    frames = await applyFilmGrain(frames, grainStrength);
  }
  if (parallaxShiftPx > 0) {
    frames = await applyParallaxShift(frames, parallaxShiftPx);
  }
  if (smearFrames && frames.length >= 2) {
    frames = await applySmearFrame(frames);
  }

  logger.info('ShortVideoEffects: all effects applied', {
    inputFrames: framesBase64.length,
    outputFrames: frames.length,
  });
  return frames;
}
