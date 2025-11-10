import { useState, useRef } from 'react';
import { imageGenerationApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { usePresignedUrl } from '../../hooks/usePresignedUrl';
import logger from '../../utils/logger';

interface AvatarOption {
  id: string;
  url: string;
  isSelected: boolean;
}

interface AvatarGeneratorProps {
  onAvatarSelected: (avatarUrl: string) => void;
  currentAvatar?: string;
}

export function AvatarGenerator({ onAvatarSelected, currentAvatar }: AvatarGeneratorProps) {
  const user = useAuthStore((state) => state.user);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Convert current avatar to pre-signed URL for display
  const currentAvatarUrl = usePresignedUrl(currentAvatar);
  
  const [isGenerating, setIsGenerating] = useState(false);
  const [isConfirming, setIsConfirming] = useState(false);
  const [avatarOptions, setAvatarOptions] = useState<AvatarOption[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      setError('Please select a valid image file');
      return;
    }

    // Validate file size (10MB limit)
    if (file.size > 10 * 1024 * 1024) {
      setError('Image file must be smaller than 10MB');
      return;
    }

    setError(null);
    setSelectedFile(file);
    
    // Create preview URL
    const previewUrl = URL.createObjectURL(file);
    setUploadedImage(previewUrl);
    
    // Clear previous avatar options
    setAvatarOptions([]);
  };

  const generateAvatarOptions = async () => {
    if (!user?._id || !selectedFile) {
      setError('User not authenticated or no file selected');
      return;
    }

    setIsGenerating(true);
    setError(null);

    try {
      // First, upload the reference image to S3
      const { data: uploadData } = await imageGenerationApi.generatePresignedUploadUrl(selectedFile.type);
      await imageGenerationApi.uploadToS3(uploadData.uploadUrl, selectedFile);
      
      // Generate multiple avatar options (we'll call the endpoint multiple times)
      const promises = Array.from({ length: 1 }, () => 
        imageGenerationApi.generateSubjectIllustration(user._id!)
      );
      
      const responses = await Promise.all(promises);
      
      const options: AvatarOption[] = responses.map((response, index) => ({
        id: `avatar-${index}`,
        url: response.data.url,
        isSelected: false,
      }));
      
      setAvatarOptions(options);
    } catch (error) {
      logger.error('Failed to generate avatar options', { 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      setError('Failed to generate avatar options. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const selectAvatar = (avatarId: string) => {
    const updatedOptions = avatarOptions.map(option => ({
      ...option,
      isSelected: option.id === avatarId,
    }));
    setAvatarOptions(updatedOptions);
  };

  const handleRetryGeneration = () => {
    if (uploadedImage) {
      generateAvatarOptions();
    }
  };

  const confirmAvatarSelection = async () => {
    const selectedOption = avatarOptions.find(option => option.isSelected);
    if (!selectedOption) {
      setError('Please select an avatar option first');
      return;
    }

    setIsConfirming(true);
    setError(null);

    try {
      // Download the selected avatar image
      const response = await fetch(selectedOption.url);
      const blob = await response.blob();
      const file = new File([blob], 'avatar.png', { type: 'image/png' });
      
      // Get pre-signed URL for avatar upload
      const { data: uploadData } = await imageGenerationApi.generatePresignedAvatarUploadUrl(file.type);
      
      // Upload avatar to S3
      await imageGenerationApi.uploadToS3(uploadData.uploadUrl, file);
      
      // Convert S3 key to S3 URI for secure access
      const avatarUrl = `s3://auto-bio-illustrations/${uploadData.key}`;
      
      // Call the callback to save the avatar to the user's profile
      onAvatarSelected(avatarUrl);
      logger.info('Avatar selected and saved');
    } catch (error) {
      logger.error('Failed to confirm avatar selection', { 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      setError('Failed to save selected avatar. Please try again.');
    } finally {
      setIsConfirming(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h3 className="text-lg font-medium text-gray-900 mb-2">Create Your Avatar</h3>
        <p className="text-sm text-gray-600 mb-4">
          Upload a reference photo of yourself to generate personalized avatar options.
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
                Upload a reference photo
              </span>
              <span className="mt-1 block text-sm text-gray-500">
                Click to select an image file (JPG, PNG, etc.)
              </span>
            </label>
            <input
              ref={fileInputRef}
              id="reference-image"
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="sr-only"
              disabled={isGenerating || isConfirming}
            />
          </div>
        </div>
      </div>

      {/* Uploaded Image Preview */}
      {uploadedImage && (
        <div className="text-center">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Reference Photo</h4>
          <img
            src={uploadedImage}
            alt="Reference photo"
            className="mx-auto h-32 w-32 object-cover rounded-lg shadow-md"
          />
        </div>
      )}

      {/* Create Avatar Button */}
      {uploadedImage && avatarOptions.length === 0 && (
        <div className="text-center">
          <button
            onClick={generateAvatarOptions}
            disabled={isGenerating}
            className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isGenerating ? (
              <>
                <LoadingSpinner />
                <span className="ml-2">Creating Avatar Options...</span>
              </>
            ) : (
              <>
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
                </svg>
                Create Avatar
              </>
            )}
          </button>
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

      {/* Avatar Options */}
      {avatarOptions.length > 0 && (
        <div>
          <div className="flex items-center justify-between mb-4">
            <h4 className="text-sm font-medium text-gray-900">Choose Your Avatar</h4>
            <button
              onClick={handleRetryGeneration}
              disabled={isGenerating}
              className="text-sm text-indigo-600 hover:text-indigo-500 disabled:text-gray-400"
            >
              Generate New Options
            </button>
          </div>
          
          <div className="grid grid-cols-2 gap-4 mb-6">
            {avatarOptions.map((option) => (
              <div
                key={option.id}
                className={`relative cursor-pointer rounded-lg overflow-hidden border-2 transition-all ${
                  option.isSelected
                    ? 'border-indigo-500 ring-2 ring-indigo-200'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
                onClick={() => selectAvatar(option.id)}
              >
                <img
                  src={option.url}
                  alt={`Avatar option ${option.id}`}
                  className="w-full h-32 object-cover"
                />
                {option.isSelected && (
                  <div className="absolute inset-0 bg-indigo-500 bg-opacity-20 flex items-center justify-center">
                    <div className="bg-indigo-500 text-white rounded-full p-1">
                      <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Confirm Button */}
          <div className="text-center">
            <button
              onClick={confirmAvatarSelection}
              disabled={!avatarOptions.some(option => option.isSelected) || isConfirming}
              className="inline-flex items-center px-6 py-3 border border-transparent text-base font-medium rounded-md text-white bg-green-600 hover:bg-green-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-green-500 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isConfirming ? (
                <>
                  <LoadingSpinner />
                  <span className="ml-2">Saving Avatar...</span>
                </>
              ) : (
                <>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                  Confirm Selection
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* Current Avatar Display */}
      {currentAvatar && !uploadedImage && (
        <div className="text-center">
          <h4 className="text-sm font-medium text-gray-900 mb-2">Current Avatar</h4>
          <img
            src={currentAvatarUrl}
            alt="Current avatar"
            className="mx-auto h-24 w-24 object-cover rounded-full shadow-md"
          />
          <p className="mt-2 text-xs text-gray-500">Upload a new reference photo to generate new options</p>
        </div>
      )}
    </div>
  );
}
