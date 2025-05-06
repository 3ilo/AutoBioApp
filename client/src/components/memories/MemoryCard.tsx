import { format } from 'date-fns';
import { IMemory } from '@shared/types/Memory';
import DOMPurify from 'dompurify';

interface MemoryCardProps {
  memory: IMemory;
  isActive: boolean;
}

export function MemoryCard({ memory, isActive }: MemoryCardProps) {
  // Sanitize the HTML content
  const sanitizedContent = DOMPurify.sanitize(memory.content);

  return (
    <div
      className={`bg-white shadow-lg rounded-lg overflow-hidden transition-all duration-300 w-full ${
        isActive ? 'scale-105 shadow-xl' : 'opacity-75'
      }`}
    >
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <h2 className="text-2xl font-bold text-gray-900 truncate flex-1 mr-4">{memory.title}</h2>
          <time className="text-sm text-gray-500 flex-shrink-0">
            {format(new Date(memory.date), 'MMM d, yyyy')}
          </time>
        </div>
        
        <div className="relative flex gap-6">
          {/* Content container with fixed width and proper overflow handling */}
          <div className="prose prose-sm flex-1">
            <div 
              className="text-gray-700 whitespace-pre-wrap break-words"
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
                className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-indigo-100 text-indigo-800"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 