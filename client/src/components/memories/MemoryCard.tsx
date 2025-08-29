import { format } from 'date-fns';
import { IMemory } from '@shared/types/Memory';
import DOMPurify from 'dompurify';
import { TrashIcon } from '@heroicons/react/24/outline';
import { useState } from 'react';
import { memoriesApi } from '../../services/api';

interface MemoryCardProps {
  memory: IMemory;
  isActive: boolean;
  onDelete?: (memoryId: string) => void;
}

export function MemoryCard({ memory, isActive, onDelete }: MemoryCardProps) {
  const [isDeleting, setIsDeleting] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  const handleDelete = async () => {
    try {
      setIsDeleting(true);
      await memoriesApi.delete(memory._id ?? '');
      onDelete?.(memory._id ?? '');
    } catch (error) {
      console.error('Failed to delete memory:', error);
    } finally {
      setIsDeleting(false);
      setShowConfirmDialog(false);
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
            <h2 className="text-2xl font-bold text-warm-900 truncate flex-1 mr-4">{memory.title}</h2>
            <div className="flex items-center gap-4">
              <time className="text-sm text-warm-500 flex-shrink-0">
                {format(new Date(memory.date), 'MMM d, yyyy')}
              </time>
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
                    <img
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