import { usePresignedUrl } from '../../hooks/usePresignedUrl';

interface MemoryImageProps {
  src: string;
  alt: string;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Component for displaying memory images with automatic S3 URI to pre-signed URL conversion
 */
export function MemoryImage({ src, alt, className, style }: MemoryImageProps) {
  const presignedUrl = usePresignedUrl(src);

  return (
    <img
      src={presignedUrl}
      alt={alt}
      className={className}
      style={style}
    />
  );
}
