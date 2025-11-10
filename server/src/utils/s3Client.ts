import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { IMemory, IMemoryImage } from '../../../shared/types/Memory';
import logger from './logger';
import { getAwsClientConfig } from './env';

// Environment variables
const S3_BUCKET = process.env.S3_BUCKET_NAME || 'auto-bio-illustrations';
const S3_CLIENT_REGION = process.env.S3_CLIENT_REGION || 'us-west-2';
const S3_SUBJECT_PREFIX = process.env.S3_SUBJECT_PREFIX || 'subjects/';
const S3_AVATAR_PREFIX = process.env.S3_AVATAR_PREFIX || 'avatars/';

// Singleton S3 client
class S3ClientSingleton {
  private static instance: S3ClientSingleton;
  private s3Client: S3Client;

  private constructor() {
    // Use centralized AWS client configuration
    // Automatically handles credentials for local vs serverless (dev/prod)
    this.s3Client = new S3Client(getAwsClientConfig(S3_CLIENT_REGION));
  }

  public static getInstance(): S3ClientSingleton {
    if (!S3ClientSingleton.instance) {
      S3ClientSingleton.instance = new S3ClientSingleton();
    }
    return S3ClientSingleton.instance;
  }

  public getClient(): S3Client {
    return this.s3Client;
  }

  /**
   * Generate a pre-signed URL for uploading a reference image
   */
  public async generatePresignedUploadUrl(userId: string, contentType: string): Promise<string> {
    const key = `${S3_SUBJECT_PREFIX}${userId}.png`;
    
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      ContentType: contentType,
    });

    try {
      const presignedUrl = await getSignedUrl(this.s3Client, command, { 
        expiresIn: 3600 // 1 hour
      });
      
      logger.info(`Generated presigned upload URL for user ${userId}: ${key}`);
      return presignedUrl;
    } catch (error) {
      logger.error('Error generating presigned upload URL:', error);
      throw error;
    }
  }

  /**
   * Generate a pre-signed URL for uploading an avatar
   */
  public async generatePresignedAvatarUploadUrl(userId: string, contentType: string): Promise<string> {
    const key = `${S3_AVATAR_PREFIX}${userId}.png`;
    
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      ContentType: contentType,
    });

    try {
      const presignedUrl = await getSignedUrl(this.s3Client, command, { 
        expiresIn: 3600 // 1 hour
      });
      
      logger.info(`Generated presigned avatar upload URL for user ${userId}: ${key}`);
      return presignedUrl;
    } catch (error) {
      logger.error('Error generating presigned avatar upload URL:', error);
      throw error;
    }
  }

  /**
   * Generate a pre-signed URL for downloading a file
   */
  public async generatePresignedDownloadUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
    });

    try {
      const presignedUrl = await getSignedUrl(this.s3Client, command, { 
        expiresIn: 3600 // 1 hour
      });
      
      logger.info(`Generated presigned download URL for key: ${key}`);
      return presignedUrl;
    } catch (error) {
      logger.error('Error generating presigned download URL:', error);
      throw error;
    }
  }

  /**
   * Convert S3 URI to pre-signed URL for viewing
   */
  public async convertS3UriToPresignedUrl(s3Uri: string): Promise<string> {
    // Extract key from s3://bucket/key format
    const s3UriPattern = /^s3:\/\/([^\/]+)\/(.+)$/;
    const match = s3Uri.match(s3UriPattern);
    
    if (!match) {
      throw new Error(`Invalid S3 URI format: ${s3Uri}`);
    }
    
    const [, bucket, key] = match;
    
    return this.generatePresignedDownloadUrl(key);
  }

  /**
   * Convert S3 URI to public URL (deprecated - use convertS3UriToPresignedUrl instead)
   */
  public convertS3UriToPublicUrl(s3Uri: string): string {
    // Convert s3://bucket/key to https://bucket.s3.region.amazonaws.com/key
    const s3UriPattern = /^s3:\/\/([^\/]+)\/(.+)$/;
    const match = s3Uri.match(s3UriPattern);
    
    if (!match) {
      throw new Error(`Invalid S3 URI format: ${s3Uri}`);
    }
    
    const [, bucket, key] = match;
    return `https://${bucket}.s3.${S3_CLIENT_REGION}.amazonaws.com/${key}`;
  }

  /**
   * Get the S3 key for a user's subject image
   */
  public getSubjectKey(userId: string): string {
    return `${S3_SUBJECT_PREFIX}${userId}.png`;
  }

  /**
   * Get the S3 key for a user's avatar
   */
  public getAvatarKey(userId: string): string {
    return `${S3_AVATAR_PREFIX}${userId}.png`;
  }

  /**
   * Get the S3 bucket name
   */
  public getBucketName(): string {
    return S3_BUCKET;
  }

  /**
   * Convert S3 URIs in memory images to pre-signed URLs for viewing
   */
  public async convertMemoryImagesToPresignedUrls(memory: IMemory): Promise<IMemory> {
    if (!memory.images || memory.images.length === 0) {
      return memory;
    }

    const convertedImages: IMemoryImage[] = [];

    for (const image of memory.images) {
      try {
        let presignedUrl: string;

        if (image.url.startsWith('http://') || image.url.startsWith('https://')) {
          // Assume HTTP URLs stored in a Memory do not need to be signed.
          presignedUrl = image.url;
        } else if (image.url.startsWith('s3://')) {
          // S3 URI, convert to pre-signed URL
          presignedUrl = await this.convertS3UriToPresignedUrl(image.url);
        } else {
          // Unknown format, use as-is
          presignedUrl = image.url;
        }

        convertedImages.push({
          ...image,
          url: presignedUrl
        });
      } catch (error) {
        logger.error(`Error converting image URL ${image.url} to pre-signed URL:`, error);
        // If conversion fails, use the original URL
        convertedImages.push(image);
      }
    }

    return {
      ...memory,
      images: convertedImages
    };
  }

  /**
   * Convert S3 URIs in multiple memories to pre-signed URLs
   */
  public async convertMemoriesImagesToPresignedUrls(memories: IMemory[]): Promise<IMemory[]> {
    const convertedMemories: IMemory[] = [];

    for (const memory of memories) {
      const convertedMemory = await this.convertMemoryImagesToPresignedUrls(memory);
      convertedMemories.push(convertedMemory);
    }

    return convertedMemories;
  }
}

// Export singleton instance
export const s3Client = S3ClientSingleton.getInstance();
export default s3Client;
