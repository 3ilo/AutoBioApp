import { useState, useRef } from 'react';
import { imageGenerationApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { usePresignedUrl } from '../../hooks/usePresignedUrl';
import logger from '../../utils/logger';

const MAX_REFERENCE_IMAGES = 5;

interface UploadedImagePreview {
  file: File;
  previewUrl: string;
  index: number;
}

interface AvatarGeneratorProps {
  onAvatarSelected: (avatarUrl: string) => void;
  currentAvatar?: string;
  currentMultiAngle?: string;
}

export function AvatarGenerator({ onAvatarSelected, currentAvatar, currentMultiAngle }: AvatarGeneratorProps) {
  const user = useAuthStore((state) => state.user);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Convert current avatar to pre-signed URL for display
  const currentAvatarUrl = usePresignedUrl(currentAvatar);
  const currentMultiAngleUrl = usePresignedUrl(currentMultiAngle);
  
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedImages, setUploadedImages] = useState<UploadedImagePreview[]>([]);
  const [generatedMultiAngleUrl, setGeneratedMultiAngleUrl] = useState<string | null>(null);
  const [generatedAvatarUrl, setGeneratedAvatarUrl] = useState<string | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (!files || files.length === 0) return;

    // Check if adding these files would exceed the limit
    if (uploadedImages.length + files.length > MAX_REFERENCE_IMAGES) {
      setError(`You can upload up to ${MAX_REFERENCE_IMAGES} reference images`);
      return;
    }

    const newImages: UploadedImagePreview[] = [];
    
    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      
      // Validate file type
      if (!file.type.startsWith('image/')) {
        setError(`File ${file.name} is not a valid image`);
        continue;
      }

      // Validate file size (10MB limit)
      if (file.size > 10 * 1024 * 1024) {
        setError(`File ${file.name} must be smaller than 10MB`);
        continue;
      }

      // Create preview URL
      const previewUrl = URL.createObjectURL(file);
      newImages.push({
        file,
        previewUrl,
        index: uploadedImages.length + newImages.length,
      });
    }

    if (newImages.length > 0) {
      setError(null);
      setUploadedImages([...uploadedImages, ...newImages]);
      setGeneratedMultiAngleUrl(null);
      setGeneratedAvatarUrl(null);
    }

    // Reset the file input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const removeImage = (index: number) => {
    setUploadedImages(uploadedImages.filter((_, i) => i !== index));
  };

  const uploadReferenceImages = async () => {
    if (uploadedImages.length === 0) {
      setError('No files selected');
      return false;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Upload each image with its index
      for (let i = 0; i < uploadedImages.length; i++) {
        const { file } = uploadedImages[i];
        
        // Get pre-signed URL for reference image upload
        const { data: uploadData } = await imageGenerationApi.generatePresignedUploadUrl(file.type, i);

        // Upload to S3
        await imageGenerationApi.uploadToS3(uploadData.uploadUrl, file);

        // Update user's reference image array
        await imageGenerationApi.updateUserReferenceImage(i);

        logger.info('User reference image uploaded', { 
          userId: user?._id,
          index: i,
          fileName: file.name,
        });
      }

      return true;
    } catch (error) {
      logger.error('Failed to upload reference images', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: user?._id,
      });
      setError('Failed to upload reference images. Please try again.');
      return false;
    } finally {
      setIsUploading(false);
    }
  };

  const generateMultiAngleAvatar = async () => {
    if (!user?._id) {
      setError('User not authenticated');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // First upload the reference images if we have new ones
      if (uploadedImages.length > 0) {
        const uploadSuccess = await uploadReferenceImages();
        if (!uploadSuccess) {
          setIsGenerating(false);
          return;
        }
      }

      // Generate the multi-angle avatar
      const response = await imageGenerationApi.generateMultiAngleUserAvatar(user._id);
      
      setGeneratedMultiAngleUrl(response.data.multiAngleUrl);
      setGeneratedAvatarUrl(response.data.avatarUrl);
      
      // Call the callback to save the avatar S3 URI to the user's profile
      onAvatarSelected(response.data.avatarS3Uri);
      
      logger.info('Multi-angle user avatar generated', { userId: user._id });
    } catch (error) {
      logger.error('Failed to generate multi-angle avatar', {
        error: error instanceof Error ? error.message : 'Unknown error',
        userId: user?._id,
      });
      setError('Failed to generate multi-angle avatar. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const hasReferenceImages = uploadedImages.length > 0;

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Create Your Avatar</h3>
        <p className="text-sm text-gray-600 mb-4">
          Upload 1-{MAX_REFERENCE_IMAGES} photos of yourself from different angles for best results.
          <span className="block mt-1">Recommended: front-facing, left profile, right profile, and additional angles.</span>
        </p>
      </div>

      {/* File Upload Section */}
      <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
        <div className="text-center">
          <div className="mx-auto h-12 w-12 text-gray-400">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="mt-4">
            <label htmlFor="reference-image" className="cursor-pointer">
              <span className="mt-2 block text-sm font-medium text-gray-900">
                {uploadedImages.length > 0 ? 'Add more photos' : 'Upload reference photos'}
              </span>
              <span className="mt-1 block text-sm text-gray-500">
                {uploadedImages.length}/{MAX_REFERENCE_IMAGES} uploaded
              </span>
            </label>
            <input
              ref={fileInputRef}
              id="reference-image"
              type="file"
              accept="image/*"
              multiple
              onChange={handleFileUpload}
              className="sr-only"
              disabled={isGenerating || isUploading || uploadedImages.length >= MAX_REFERENCE_IMAGES}
            />
          </div>
        </div>
      </div>

      {/* Uploaded Images Preview */}
      {uploadedImages.length > 0 && (
        <div>
          <h4 className="text-sm font-medium text-gray-900 mb-2">Uploaded References</h4>
          <div className="grid grid-cols-5 gap-2">
            {uploadedImages.map((img) => (
              <div key={img.index} className="relative group">
                <img
                  src={img.previewUrl}
                  alt={`Reference ${img.index + 1}`}
                  className="w-full h-20 object-cover rounded-md border border-gray-200"
                />
                <button
                  onClick={() => removeImage(img.index)}
                  className="absolute top-1 right-1 bg-red-500 text-white rounded-full w-5 h-5 flex items-center justify-center text-xs opacity-0 group-hover:opacity-100 transition-opacity"
                  disabled={isGenerating || isUploading}
                >
                  ×
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Generated Images Preview */}
      {(generatedMultiAngleUrl || generatedAvatarUrl || currentMultiAngleUrl || currentAvatarUrl) && (
        <div className="space-y-4">
          {/* Multi-Angle Array */}
          {(generatedMultiAngleUrl || currentMultiAngleUrl) && (
            <div className="text-center">
              <h4 className="text-sm font-medium text-gray-900 mb-2">3-Angle Reference</h4>
              <img
                src={generatedMultiAngleUrl || currentMultiAngleUrl}
                alt="3-angle reference array"
                className="mx-auto max-w-full h-auto rounded-lg shadow-md border border-gray-200"
              />
              <p className="text-xs text-gray-500 mt-1">Left profile, Front, Right profile</p>
            </div>
          )}

          {/* Extracted Avatar */}
          {(generatedAvatarUrl || currentAvatarUrl) && (
            <div className="text-center">
              <h4 className="text-sm font-medium text-gray-900 mb-2">Your Avatar (Front-Facing)</h4>
              <img
                src={generatedAvatarUrl || currentAvatarUrl}
                alt="Generated avatar"
                className="mx-auto h-32 w-32 object-cover rounded-lg shadow-md border border-gray-200"
              />
            </div>
          )}
        </div>
      )}

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
              </svg>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          </div>
        </div>
      )}

      {/* Generate Avatar Button */}
      <div className="text-center">
        <button
          onClick={generateMultiAngleAvatar}
          disabled={!hasReferenceImages || isGenerating || isUploading}
          className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating || isUploading ? (
            <>
              <LoadingSpinner />
              <span className="ml-2">
                {isUploading ? 'Uploading...' : 'Generating Multi-Angle Avatar...'}
              </span>
            </>
          ) : (
            <>
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {currentMultiAngle ? 'Regenerate Multi-Angle Avatar' : 'Generate Multi-Angle Avatar'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
