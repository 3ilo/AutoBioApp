import { useState, useRef } from 'react';
import { characterApi, imageGenerationApi } from '../../services/api';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { usePresignedUrl } from '../../hooks/usePresignedUrl';
import { ICharacter } from '../../types/character';
import logger from '../../utils/logger';

interface CharacterAvatarGeneratorProps {
  character: ICharacter;
  onAvatarGenerated: (character: ICharacter) => void;
}

export function CharacterAvatarGenerator({ character, onAvatarGenerated }: CharacterAvatarGeneratorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Convert current avatar to pre-signed URL for display
  const currentAvatarUrl = usePresignedUrl(character.avatarS3Uri);
  const currentReferenceUrl = usePresignedUrl(character.referenceImageS3Uri);
  
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadedImage, setUploadedImage] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [generatedAvatarUrl, setGeneratedAvatarUrl] = useState<string | null>(null);

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
    setGeneratedAvatarUrl(null);
  };

  const uploadReferenceImage = async () => {
    if (!selectedFile) {
      setError('No file selected');
      return false;
    }

    setIsUploading(true);
    setError(null);

    try {
      // Get pre-signed URL for reference image upload
      const { data: uploadData } = await characterApi.generatePresignedReferenceUploadUrl(
        character._id,
        selectedFile.type
      );

      // Upload to S3
      await imageGenerationApi.uploadToS3(uploadData.uploadUrl, selectedFile);

      // Update character's reference image
      await characterApi.updateReferenceImage(character._id);

      logger.info('Character reference image uploaded', { characterId: character._id });
      return true;
    } catch (error) {
      logger.error('Failed to upload reference image', {
        error: error instanceof Error ? error.message : 'Unknown error',
        characterId: character._id,
      });
      setError('Failed to upload reference image. Please try again.');
      return false;
    } finally {
      setIsUploading(false);
    }
  };

  const generateAvatar = async () => {
    setIsGenerating(true);
    setError(null);

    try {
      // First upload the reference image if we have a new one
      if (selectedFile) {
        const uploadSuccess = await uploadReferenceImage();
        if (!uploadSuccess) {
          setIsGenerating(false);
          return;
        }
      }

      // Generate the avatar
      const response = await characterApi.generateAvatar(character._id);
      
      setGeneratedAvatarUrl(response.data.url);
      onAvatarGenerated(response.data.character);
      
      logger.info('Character avatar generated', { characterId: character._id });
    } catch (error) {
      logger.error('Failed to generate avatar', {
        error: error instanceof Error ? error.message : 'Unknown error',
        characterId: character._id,
      });
      setError('Failed to generate avatar. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  const hasReferenceImage = !!character.referenceImageS3Uri || !!selectedFile;

  return (
    <div className="space-y-6">
      <div>
        <h4 className="text-sm font-medium text-slate-900 mb-2">Reference Photo</h4>
        <p className="text-xs text-slate-600 mb-4">
          Upload a clear photo of {character.firstName} to generate their avatar.
        </p>
      </div>

      {/* File Upload Section */}
      <div className="border-2 border-dashed border-slate-300 rounded-lg p-4">
        <div className="text-center">
          <div className="mx-auto h-10 w-10 text-slate-400">
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div className="mt-2">
            <label htmlFor={`reference-image-${character._id}`} className="cursor-pointer">
              <span className="text-sm font-medium text-slate-900">
                {uploadedImage ? 'Change photo' : 'Upload a reference photo'}
              </span>
            </label>
            <input
              ref={fileInputRef}
              id={`reference-image-${character._id}`}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="sr-only"
              disabled={isGenerating || isUploading}
            />
          </div>
        </div>
      </div>

      {/* Image Previews */}
      <div className="flex gap-4 justify-center">
        {/* Uploaded/Reference Image Preview */}
        {(uploadedImage || currentReferenceUrl) && (
          <div className="text-center">
            <h5 className="text-xs font-medium text-slate-600 mb-2">Reference</h5>
            <img
              src={uploadedImage || currentReferenceUrl}
              alt="Reference photo"
              className="h-24 w-24 object-cover rounded-lg shadow-md border border-slate-200"
            />
          </div>
        )}

        {/* Generated Avatar Preview */}
        {(generatedAvatarUrl || currentAvatarUrl) && (
          <div className="text-center">
            <h5 className="text-xs font-medium text-slate-600 mb-2">Avatar</h5>
            <img
              src={generatedAvatarUrl || currentAvatarUrl}
              alt="Generated avatar"
              className="h-24 w-24 object-cover rounded-lg shadow-md border border-slate-200"
            />
          </div>
        )}
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-md p-3">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Generate Avatar Button */}
      <div className="text-center">
        <button
          onClick={generateAvatar}
          disabled={!hasReferenceImage || isGenerating || isUploading}
          className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isGenerating || isUploading ? (
            <>
              <LoadingSpinner />
              <span className="ml-2">
                {isUploading ? 'Uploading...' : 'Generating Avatar...'}
              </span>
            </>
          ) : (
            <>
              <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              {character.avatarS3Uri ? 'Regenerate Avatar' : 'Generate Avatar'}
            </>
          )}
        </button>
      </div>
    </div>
  );
}
