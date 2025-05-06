import { useState } from 'react';
import { MemoryCard } from '../components/memories/MemoryCard';
import { memoriesApi } from '../services/api';
import { useApi } from '../hooks/useApi';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

export function Explore() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'date' | 'likes'>('date');

  const {
    data: memories,
    isLoading,
    error,
    execute: fetchMemories,
  } = useApi(memoriesApi.getAll, []);

  const filteredMemories = memories?.filter(memory => {
    const matchesSearch = memory.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      memory.content.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesTags = selectedTags.length === 0 ||
      selectedTags.every(tag => memory.tags.includes(tag));

    return matchesSearch && matchesTags;
  });

  const sortedMemories = [...(filteredMemories || [])].sort((a, b) => {
    if (sortBy === 'date') {
      return new Date(b.date).getTime() - new Date(a.date).getTime();
    }
    return b.likes.length - a.likes.length;
  });

  const allTags = Array.from(new Set(memories?.flatMap(m => m.tags) || []));

  return (
    <div className="w-screen px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Explore Memories</h1>
        
        <div className="flex flex-col sm:flex-row gap-4">
          <div className="flex-1">
            <input
              type="text"
              placeholder="Search memories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'date' | 'likes')}
            className="px-4 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          >
            <option value="date">Sort by Date</option>
            <option value="likes">Sort by Likes</option>
          </select>
        </div>

        {allTags.length > 0 && (
          <div className="mt-4">
            <h2 className="text-sm font-medium text-gray-700 mb-2">Filter by Tags</h2>
            <div className="flex flex-wrap gap-2">
              {allTags.map(tag => (
                <button
                  key={tag}
                  onClick={() => {
                    setSelectedTags(prev =>
                      prev.includes(tag)
                        ? prev.filter(t => t !== tag)
                        : [...prev, tag]
                    );
                  }}
                  className={`px-3 py-1 rounded-full text-sm font-medium ${
                    selectedTags.includes(tag)
                      ? 'bg-indigo-100 text-indigo-800'
                      : 'bg-gray-100 text-gray-800 hover:bg-gray-200'
                  }`}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner size="lg" />
        </div>
      ) : error ? (
        <div className="text-center text-red-600">
          <p>Error loading memories: {error.message}</p>
          <button
            onClick={() => fetchMemories()}
            className="mt-2 text-indigo-600 hover:text-indigo-800"
          >
            Try again
          </button>
        </div>
      ) : sortedMemories.length === 0 ? (
        <div className="text-center text-gray-500">
          <p>No memories found matching your criteria.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {sortedMemories.map(memory => (
            <MemoryCard
              key={memory._id}
              memory={memory}
              isActive={false}
            />
          ))}
        </div>
      )}
    </div>
  );
} 