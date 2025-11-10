import { format } from 'date-fns';
import { IMemory } from '@shared/types/Memory';
import DOMPurify from 'dompurify';
import { TrashIcon, PencilIcon, UserPlusIcon, UserMinusIcon } from '@heroicons/react/24/outline';
import { useState, useEffect } from 'react';
import { memoriesApi, userApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { MemoryImage } from './MemoryImage';
import logger from '../../utils/logger';

interface MemoryCardProps {
  memory: IMemory;
  isActive: boolean;
  onDelete?: (memoryId: string) => void;
  onEdit?: (memory: IMemory) => void;
  showAuthor?: boolean;
  showFollowButton?: boolean;
}

export function MemoryCard({ memory, isActive, onDelete, onEdit, showAuthor = false, showFollowButton = false }: MemoryCardProps) {
  const user = useAuthStore((state) => state.user);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  // Check if current user is following the memory's author
  useEffect(() => {
    if (user && memory.author && showFollowButton) {
      const authorId = (memory.author as any)._id;
      const isCurrentlyFollowing = user.following?.includes(authorId) || false;
      setIsFollowing(isCurrentlyFollowing);
    }
  }, [user, memory.author, showFollowButton]);

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await memoriesApi.delete(memory._id ?? '');
      logger.info('Memory deleted', { memoryId: memory._id });
      onDelete?.(memory._id ?? '');
    } catch (error) {
      logger.error('Failed to delete memory', { 
        memoryId: memory._id,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsDeleting(false);
      setShowConfirmDialog(false);
    }
  };

  const handleFollowToggle = async () => {
    if (!memory.author || typeof memory.author === 'string' || !user) return;
    
    const authorId = (memory.author as any)._id;
    try {
      setIsFollowLoading(true);
      if (isFollowing) {
        await userApi.unfollowUser(authorId);
        setIsFollowing(false);
        // Update user's following list in auth store
        const updatedUser = { ...user, following: user.following?.filter(id => id !== authorId) || [] };
        useAuthStore.getState().setUser(updatedUser);
        logger.info('User unfollowed', { authorId });
      } else {
        await userApi.followUser(authorId);
        setIsFollowing(true);
        // Update user's following list in auth store
        const updatedUser = { ...user, following: [...(user.following || []), authorId] };
        useAuthStore.getState().setUser(updatedUser);
        logger.info('User followed', { authorId });
      }
    } catch (error) {
      logger.error('Failed to toggle follow', { 
        authorId,
        error: error instanceof Error ? error.message : 'Unknown error'
      });
    } finally {
      setIsFollowLoading(false);
    }
  };

  // Sanitize the HTML content
  const sanitizedContent = DOMPurify.sanitize(memory.content);

  return (
    <>
      <div
        className={`bg-white shadow-lg rounded-lg overflow-hidden transition-all duration-300 w-full ${
          isActive ? 'scale-105 shadow-xl' : 'opacity-75'
        }`}
      >
        <div className="p-6">
          <div className="flex justify-between items-start mb-4">
            <div className="flex-1 mr-4">
              <h2 className="text-2xl font-bold text-warm-900 truncate">{memory.title}</h2>
              {showAuthor && memory.author && typeof memory.author !== 'string' && (
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-sm text-warm-600">
                    by {(memory.author as any).firstName} {(memory.author as any).lastName}
                  </span>
                  {showFollowButton && user?._id !== (memory.author as any)._id && (
                    <button
                      onClick={handleFollowToggle}
                      disabled={isFollowLoading}
                      className="p-1 text-warm-400 hover:text-indigo-600 transition-colors duration-200 disabled:opacity-50"
                      title={isFollowing ? 'Unfollow' : 'Follow'}
                    >
                      {isFollowLoading ? (
                        <div className="w-4 h-4 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                      ) : isFollowing ? (
                        <UserMinusIcon className="w-4 h-4" />
                      ) : (
                        <UserPlusIcon className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="flex items-center gap-4">
              <time className="text-sm text-warm-500 flex-shrink-0">
                {format(new Date(memory.date), 'MMM d, yyyy')}
              </time>
              {onEdit && (
                <button
                  onClick={() => onEdit(memory)}
                  className="p-2 text-warm-400 hover:text-indigo-600 transition-colors duration-200"
                  title="Edit memory"
                >
                  <PencilIcon className="w-5 h-5" />
                </button>
              )}
              <button
                onClick={() => setShowConfirmDialog(true)}
                className="p-2 text-warm-400 hover:text-accent-error transition-colors duration-200"
                title="Delete memory"
              >
                <TrashIcon className="w-5 h-5" />
              </button>
            </div>
          </div>
          
          <div className="relative flex gap-6">
            {/* Content container with fixed width and proper overflow handling */}
            <div className="prose prose-sm flex-1">
              <div 
                className="text-warm-700 whitespace-pre-wrap break-words"
                dangerouslySetInnerHTML={{ __html: sanitizedContent }}
              />
            </div>

            {/* Images container */}
            {memory.images.length > 0 && (
              <div className="w-1/3 flex-shrink-0 flex flex-col gap-4">
                {memory.images.map((image, index) => (
                  <div
                    key={index}
                    className="relative w-full"
                    style={{ minHeight: '300px' }}
                  >
                    <MemoryImage
                      src={image.url}
                      alt={`Memory illustration ${index + 1}`}
                      className="w-full h-full object-cover rounded-lg shadow-md"
                    />
                  </div>
                ))}
              </div>
            )}
          </div>

          {memory.tags.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-4">
              {memory.tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary-100 text-primary-800"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation Dialog */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-warm-900 mb-4">Delete Memory</h3>
            <p className="text-warm-600 mb-6">
              Are you sure you want to delete this memory? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-4">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="btn-secondary"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="btn-primary bg-accent-error hover:bg-accent-error/90"
                disabled={isDeleting}
              >
                {isDeleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
} 