import { useRef, useEffect } from 'react';
import { usePresignedUrl } from '../../hooks/usePresignedUrl';

interface MemoryImageProps {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}

/** True if the S3 URI or path refers to a video (e.g. short-video .mp4). */
function isVideoUrl(src: string): boolean {
  return src.toLowerCase().endsWith('.mp4') || src.toLowerCase().includes('.mp4?');
}

/** True if the URL is a real video URL (not the placeholder data URI). */
function isRealVideoUrl(url: string): boolean {
  return (url.startsWith('http://') || url.startsWith('https://')) && url.includes('.mp4');
}

/**
 * Component for displaying memory images or short videos with automatic S3 URI to pre-signed URL conversion.
 * Renders <video> for .mp4 (short videos), <img> otherwise.
 */
export function MemoryImage({ src, alt, className, style }: MemoryImageProps) {
  const presignedUrl = usePresignedUrl(src);
  const isVideo = isVideoUrl(src);
  const videoRef = useRef<HTMLVideoElement>(null);

  // Ensure video autoplays when src is set asynchronously (presigned URL); many browsers won't autoplay on dynamic src without play().
  useEffect(() => {
    if (!isVideo || !isRealVideoUrl(presignedUrl)) return;
    const video = videoRef.current;
    if (!video) return;
    const play = () => {
      video.play().catch(() => {});
    };
    if (video.readyState >= 2) play();
    else video.addEventListener('loadeddata', play, { once: true });
    return () => video.removeEventListener('loadeddata', play);
  }, [isVideo, presignedUrl]);

  if (isVideo) {
    const videoSrc = isRealVideoUrl(presignedUrl) ? presignedUrl : undefined;
    return (
      <video
        ref={videoRef}
        src={videoSrc}
        className={className}
        style={style}
        loop
        muted
        playsInline
        autoPlay
        aria-label={alt}
      />
    );
  }

  return (
    <img
      src={presignedUrl}
      alt={alt}
      className={className}
      style={style}
    />
  );
}
