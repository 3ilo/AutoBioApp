import { useState, useEffect } from 'react';
import { imageGenerationApi } from '../services/api';
import logger from '../utils/logger';

/**
 * Custom hook to convert S3 URIs to pre-signed URLs for viewing
 * @param s3Uri - The S3 URI to convert (e.g., "s3://bucket/path/image.png")
 * @returns The pre-signed URL for viewing the image, or a blank white image if not available
 */
export function usePresignedUrl(s3Uri: string | null | undefined): string {
  const [presignedUrl, setPresignedUrl] = useState<string>('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2ZmZmZmZiIvPjwvc3ZnPg=='); // Blank white image

  useEffect(() => {
    if (!s3Uri) {
      setPresignedUrl('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2ZmZmZmZiIvPjwvc3ZnPg==');
      return;
    }

    // Check if it's an S3 URI that needs conversion
    if (s3Uri.startsWith('s3://')) {
      logger.debug('Converting S3 URI to presigned URL', { s3Uri: s3Uri.substring(0, 50) + '...' });
      imageGenerationApi.generatePresignedViewUrl(s3Uri)
        .then((response) => {
          if (response.status === 'success') {
            setPresignedUrl(response.data.presignedUrl);
          } else {
            logger.error('Failed to generate presigned URL', { s3Uri: s3Uri.substring(0, 50) + '...' });
            setPresignedUrl('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2ZmZmZmZiIvPjwvc3ZnPg==');
          }
        })
        .catch((err) => {
          logger.error('Error generating presigned URL', { 
            error: err instanceof Error ? err.message : 'Unknown error',
            s3Uri: s3Uri.substring(0, 50) + '...'
          });
          setPresignedUrl('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2ZmZmZmZiIvPjwvc3ZnPg==');
        });
    } else {
      // For other formats, use as-is
      setPresignedUrl(s3Uri);
    }
  }, [s3Uri]);

  return presignedUrl;
}

/**
 * Utility function to get a display URL for an image
 * Handles S3 URIs, pre-signed URLs, and regular URLs
 */
export function getDisplayUrl(s3Uri: string | null | undefined): string {
  if (!s3Uri) {
    return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2ZmZmZmZiIvPjwvc3ZnPg=='; // Blank white image
  }

  // If it's already a URL, return it
  if (s3Uri.startsWith('http://') || s3Uri.startsWith('https://')) {
    return s3Uri;
  }

  // For S3 URIs, we need to convert them (this is handled by the hook)
  // For now, return a blank white image
  return 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48cmVjdCB3aWR0aD0iMTAwIiBoZWlnaHQ9IjEwMCIgZmlsbD0iI2ZmZmZmZiIvPjwvc3ZnPg==';
}
