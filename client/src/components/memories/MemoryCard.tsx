import { format } from 'date-fns';
import { IMemory } from '@shared/types/Memory';
import DOMPurify from 'dompurify';
import { TrashIcon, PencilIcon, UserPlusIcon, UserMinusIcon } from '@heroicons/react/24/outline';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { memoriesApi, userApi } from '../../services/api';
import { useAuthStore } from '../../stores/authStore';
import { MemoryImage } from './MemoryImage';
import { getMemoryLink } from '../../utils/memoryLinks';
import logger from '../../utils/logger';

interface MemoryCardProps {
  memory: IMemory;
  isActive: boolean;
  onDelete?: (memoryId: string) => void;
  onEdit?: (memory: IMemory) => void;
  showAuthor?: boolean;
  showFollowButton?: boolean;
  linkToMemory?: boolean; // If true, makes the card clickable to link to the memory in the carousel
}

export function MemoryCard({ memory, isActive, onDelete, onEdit, showAuthor = false, showFollowButton = false, linkToMemory = false }: MemoryCardProps) {
  const user = useAuthStore((state) => state.user);
  const userFollowing = useAuthStore((state) => state.user?.following);
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [isFollowing, setIsFollowing] = useState(false);
  const [isFollowLoading, setIsFollowLoading] = useState(false);

  // Check if this memory belongs to the current user
  const isOwnMemory = user?._id && (
    (typeof memory.author === 'string' && memory.author === user._id) ||
    (typeof memory.author === 'object' && memory.author?._id === user._id)
  );

  // Only link if linkToMemory is true AND it's the user's own memory
  const shouldLink = linkToMemory && isOwnMemory && memory._id;

  // Check if current user is following the memory's author
  useEffect(() => {
    if (user && memory.author && showFollowButton) {
      const authorId = (memory.author as any)._id;
      const isCurrentlyFollowing = userFollowing?.includes(authorId) || false;
      setIsFollowing(isCurrentlyFollowing);
    } else if (!showFollowButton) {
      setIsFollowing(false);
    }
  }, [user, userFollowing, memory.author, showFollowButton]);

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
      const currentUser = useAuthStore.getState().user;
      if (!currentUser) return;
      
      if (isFollowing) {
        await userApi.unfollowUser(authorId);
        // Update user's following list in auth store
        const updatedUser = { ...currentUser, following: currentUser.following?.filter(id => id !== authorId) || [] };
        useAuthStore.getState().setUser(updatedUser);
        logger.info('User unfollowed', { authorId });
      } else {
        await userApi.followUser(authorId);
        // Update user's following list in auth store
        const updatedUser = { ...currentUser, following: [...(currentUser.following || []), authorId] };
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

  // Stop event propagation for buttons to prevent link navigation
  const handleButtonClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
  };


  const cardContent = (
    <div>
      <div className="pl-8 pr-8 pt-8 pb-8">
        <div className="mb-6 border-b border-slate-200 pb-4">
          {/* Title row - full width on mobile */}
          <div className="mb-4 sm:mb-0">
            <h2 className={`text-3xl font-semibold text-slate-900 mb-2 tracking-tight truncate ${shouldLink ? 'hover:text-slate-600' : ''}`}>
              {shouldLink ? (
                <Link to={getMemoryLink(memory._id)} className="transition-colors duration-150 block truncate">
                  {memory.title}
                </Link>
              ) : (
                memory.title
              )}
            </h2>
            {showAuthor && memory.author && typeof memory.author !== 'string' && (
              <div className="flex items-center gap-3 mt-2">
                <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                  {(memory.author as any).firstName} {(memory.author as any).lastName}
                  </span>
                {showFollowButton && user?._id !== (memory.author as any)._id && (
                  <button
                  onClick={(e) => {
                    handleButtonClick(e);
                    handleFollowToggle();
                  }}
                    disabled={isFollowLoading}
                  className="p-1.5 border border-slate-300 hover:border-slate-900 hover:bg-slate-900 hover:text-white text-slate-600 transition-all duration-150 disabled:opacity-50"
                    title={isFollowing ? 'Unfollow' : 'Follow'}
                  >
                    {isFollowLoading ? (
                    <div className="w-3.5 h-3.5 border-2 border-slate-900 border-t-transparent animate-spin" />
                    ) : isFollowing ? (
                    <UserMinusIcon className="w-3.5 h-3.5" />
                    ) : (
                    <UserPlusIcon className="w-3.5 h-3.5" />
                    )}
                  </button>
                )}
              </div>
            )}
          </div>
          
          {/* Date and actions row - full width on mobile, flex on larger screens */}
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center gap-3">
            <time className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              {format(new Date(memory.date), 'MMM d, yyyy')}
            </time>
            {(onEdit || onDelete) && (
              <div className="flex items-center gap-3 flex-shrink-0">
                {onEdit && (
                  <button
                  onClick={(e) => {
                    handleButtonClick(e);
                    onEdit(memory);
                  }}
                  className="p-2 border border-slate-200 hover:border-slate-900 hover:bg-slate-900 hover:text-white text-slate-600 transition-all duration-150"
                    title="Edit memory"
                  >
                  <PencilIcon className="w-4 h-4" />
                  </button>
                )}
                {onDelete && (
                  <button
                  onClick={(e) => {
                    handleButtonClick(e);
                    setShowConfirmDialog(true);
                  }}
                  className="p-2 border border-slate-200 hover:border-red-600 hover:bg-red-600 hover:text-white text-slate-600 transition-all duration-150"
                    title="Delete memory"
                  >
                  <TrashIcon className="w-4 h-4" />
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
          
        <div className="relative flex gap-8 min-w-0">
          {/* Content container */}
          <div className="prose prose-sm flex-1 max-w-none min-w-0">
              <div 
              className="text-slate-700 whitespace-pre-wrap break-words leading-relaxed"
              style={{ 
                wordBreak: 'break-word', 
                overflowWrap: 'anywhere',
                display: '-webkit-box',
                WebkitLineClamp: 6,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
                dangerouslySetInnerHTML={{ __html: sanitizedContent }}
              />
            </div>

          {/* Images container - colorful, vibrant - show only main image */}
            {(memory.mainImage || (memory.images && memory.images.length > 0)) && (
            <div className="w-2/5 flex-shrink-0 min-w-0">
              <div className="relative w-full border-2 border-slate-200 aspect-[4/3] overflow-hidden">
                <MemoryImage
                  src={memory.mainImage?.url || memory.images[0]?.url || ''}
                  alt="Memory illustration"
                  className="w-full h-full object-cover"
                />
              </div>
            </div>
            )}
          </div>

          {memory.tags.length > 0 && (
          <div className="flex flex-wrap gap-2 mt-6 pt-6 border-t border-slate-200">
              {memory.tags.map((tag) => (
                <span
                  key={tag}
                className="inline-flex items-center px-3 py-1 text-xs font-semibold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200"
                >
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
    </div>
  );

  return (
    <>
      <div
        className={`relative bg-white border border-slate-200 transition-all duration-200 w-full ${
          isActive ? 'border-slate-900' : 'opacity-90'
        } ${shouldLink ? 'cursor-pointer hover:border-slate-400' : ''}`}
        onClick={shouldLink ? () => {} : undefined}
      >
        {/* Subdued rainbow gradient accent border on left - positioned relative to card */}
        <div
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{
            background: 'linear-gradient(to bottom, #c85064, #c88250, #c8aa64, #64b48c, #648cc8, #7878c8, #9678c8, #c8648c)'
          }}
        />
        {shouldLink ? (
          <Link to={getMemoryLink(memory._id)} className="block">
            {cardContent}
          </Link>
        ) : (
          cardContent
        )}
      </div>

      {/* Delete Confirmation Dialog - sharp, minimal */}
      {showConfirmDialog && (
        <div className="fixed inset-0 bg-slate-900 bg-opacity-60 flex items-center justify-center z-50 backdrop-blur-sm">
          <div className="bg-white border-2 border-slate-900 p-8 max-w-md w-full mx-4">
            <h3 className="text-xl font-semibold text-slate-900 mb-3 tracking-tight">Delete Memory</h3>
            <p className="text-slate-600 mb-8 text-sm leading-relaxed">
              Are you sure you want to delete this memory? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowConfirmDialog(false)}
                className="btn-secondary"
                disabled={isDeleting}
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-6 py-2.5 text-sm font-medium tracking-wide uppercase text-white bg-red-600 hover:bg-red-700 active:bg-red-800 focus:outline-none focus:ring-1 focus:ring-red-600 focus:ring-offset-2 transition-all duration-150"
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