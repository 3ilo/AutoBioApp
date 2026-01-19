import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { IMemory, IMemoryImage } from '../../../shared/types/Memory';
import logger from './logger';
import { getAwsClientConfig } from './env';

// Environment variables
const S3_BUCKET = process.env.S3_BUCKET_NAME || 'auto-bio-illustrations';
const S3_CLIENT_REGION = process.env.S3_CLIENT_REGION || 'us-east-1';
const S3_SUBJECT_PREFIX = process.env.S3_SUBJECT_PREFIX || 'subjects/';
const S3_AVATAR_PREFIX = process.env.S3_AVATAR_PREFIX || 'avatars/';
const S3_GENERATED_PREFIX = process.env.S3_GENERATED_PREFIX || 'generated/';
const S3_STUBS_PREFIX = process.env.S3_STUBS_PREFIX || 'stubs/';
const S3_CHARACTER_PREFIX = process.env.S3_CHARACTER_PREFIX || 'characters/';

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
      
      logger.debug('Generated presigned upload URL', { userId, key });
      return presignedUrl;
    } catch (error) {
      logger.error('Failed to generate presigned upload URL', { 
        userId, 
        key, 
        error: (error as Error).message 
      });
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
      
      logger.debug('Generated presigned avatar upload URL', { userId, key });
      return presignedUrl;
    } catch (error) {
      logger.error('Failed to generate presigned avatar upload URL', { 
        userId, 
        key, 
        error: (error as Error).message 
      });
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
      
      logger.debug('Generated presigned download URL', { key });
      return presignedUrl;
    } catch (error) {
      logger.error('Failed to generate presigned download URL', { 
        key, 
        error: (error as Error).message 
      });
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
   * Get an object from S3 and return as base64 string
   */
  public async getObjectAsBase64(bucket: string, key: string): Promise<string> {
    try {
      const command = new GetObjectCommand({
        Bucket: bucket,
        Key: key,
      });

      const response = await this.s3Client.send(command);
      
      if (!response.Body) {
        throw new Error(`No body returned from S3 for key: ${key}`);
      }

      const chunks: Uint8Array[] = [];
      for await (const chunk of response.Body as AsyncIterable<Uint8Array>) {
        chunks.push(chunk);
      }
      const buffer = Buffer.concat(chunks);
      
      return buffer.toString('base64');
    } catch (error: any) {
      if (error.name === 'NoSuchKey') {
        logger.debug('Object not found in S3', { bucket, key });
        throw new Error(`S3 object not found: ${key}`);
      }
      logger.error('Failed to fetch object from S3', { bucket, key, error: error.message });
      throw error;
    }
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
   * Get the S3 region
   */
  public getRegion(): string {
    return S3_CLIENT_REGION;
  }

  /**
   * Get the S3 generated prefix
   */
  public getGeneratedPrefix(): string {
    return S3_GENERATED_PREFIX;
  }

  /**
   * Get the S3 stubs prefix
   */
  public getStubsPrefix(): string {
    return S3_STUBS_PREFIX;
  }

  /**
   * Get the S3 character prefix
   */
  public getCharacterPrefix(): string {
    return S3_CHARACTER_PREFIX;
  }

  /**
   * Get the S3 key for a character's reference image
   */
  public getCharacterReferenceKey(userId: string, characterId: string): string {
    return `${S3_CHARACTER_PREFIX}${userId}/${characterId}/reference.png`;
  }

  /**
   * Get the S3 key for a character's avatar
   */
  public getCharacterAvatarKey(userId: string, characterId: string): string {
    return `${S3_CHARACTER_PREFIX}${userId}/${characterId}/avatar.png`;
  }

  /**
   * Generate a pre-signed URL for uploading a character reference image
   */
  public async generatePresignedCharacterReferenceUploadUrl(
    userId: string,
    characterId: string,
    contentType: string
  ): Promise<string> {
    const key = this.getCharacterReferenceKey(userId, characterId);
    
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      ContentType: contentType,
    });

    try {
      const presignedUrl = await getSignedUrl(this.s3Client, command, { 
        expiresIn: 3600 // 1 hour
      });
      
      logger.debug('Generated presigned character reference upload URL', { userId, characterId, key });
      return presignedUrl;
    } catch (error) {
      logger.error('Failed to generate presigned character reference upload URL', { 
        userId,
        characterId,
        key, 
        error: (error as Error).message 
      });
      throw error;
    }
  }

  /**
   * Generate a pre-signed URL for uploading a character avatar
   */
  public async generatePresignedCharacterAvatarUploadUrl(
    userId: string,
    characterId: string,
    contentType: string
  ): Promise<string> {
    const key = this.getCharacterAvatarKey(userId, characterId);
    
    const command = new PutObjectCommand({
      Bucket: S3_BUCKET,
      Key: key,
      ContentType: contentType,
    });

    try {
      const presignedUrl = await getSignedUrl(this.s3Client, command, { 
        expiresIn: 3600 // 1 hour
      });
      
      logger.debug('Generated presigned character avatar upload URL', { userId, characterId, key });
      return presignedUrl;
    } catch (error) {
      logger.error('Failed to generate presigned character avatar upload URL', { 
        userId,
        characterId,
        key, 
        error: (error as Error).message 
      });
      throw error;
    }
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
        logger.error('Failed to convert image URL to presigned URL', { 
          imageUrl: image.url, 
          error: (error as Error).message 
        });
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
