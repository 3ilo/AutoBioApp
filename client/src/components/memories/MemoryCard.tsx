import { format } from 'date-fns';
import { Memory } from '../../types';

interface MemoryCardProps {
  memory: Memory;
  isActive: boolean;
}

export function MemoryCard({ memory, isActive }: MemoryCardProps) {
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
        
        <div className="prose max-w-none mb-4 overflow-hidden">
          <div className="line-clamp-4">{memory.content}</div>
        </div>

        {memory.images.length > 0 && (
          <div className="mb-4">
            <img
              src={memory.images[0]}
              alt={memory.title}
              className="w-full h-48 object-cover rounded-lg"
            />
          </div>
        )}

        {memory.tags.length > 0 && (
          <div className="flex flex-wrap gap-2">
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