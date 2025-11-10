import { useState, useEffect } from 'react';
import { MemoryCard } from '../components/memories/MemoryCard';
import { memoriesApi } from '../services/api';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { IMemory } from '@shared/types/Memory';
import logger from '../utils/logger';

export function Explore() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sortBy, setSortBy] = useState<'date' | 'likes'>('date');
  const [viewMode, setViewMode] = useState<'all' | 'following'>('all');
  
  const [allMemories, setAllMemories] = useState<IMemory[]>([]);
  const [feedMemories, setFeedMemories] = useState<IMemory[]>([]);
  const [isLoadingAll, setIsLoadingAll] = useState(true);
  const [isLoadingFeed, setIsLoadingFeed] = useState(true);
  const [errorAll, setErrorAll] = useState<string | null>(null);
  const [errorFeed, setErrorFeed] = useState<string | null>(null);

  // Fetch all public memories
  const fetchAllMemories = async () => {
    try {
      setIsLoadingAll(true);
      setErrorAll(null);
      const response = await memoriesApi.getPublic();
      setAllMemories(response.data);
      logger.debug('Public memories loaded', { count: response.data.length });
    } catch (err) {
      logger.error('Failed to fetch public memories', { 
        error: err instanceof Error ? err.message : 'Unknown error'
      });
      setErrorAll('Failed to load public memories');
    } finally {
      setIsLoadingAll(false);
    }
  };

  // Fetch feed memories
  const fetchFeedMemories = async () => {
    try {
      setIsLoadingFeed(true);
      setErrorFeed(null);
      const response = await memoriesApi.getFeed();
      setFeedMemories(response.data);
      logger.debug('Feed memories loaded', { count: response.data.length });
    } catch (err) {
      logger.error('Failed to fetch feed memories', { 
        error: err instanceof Error ? err.message : 'Unknown error'
      });
      setErrorFeed('Failed to load feed memories');
    } finally {
      setIsLoadingFeed(false);
    }
  };

  // Use appropriate data based on view mode
  const memories = viewMode === 'following' ? feedMemories : allMemories;
  const isLoading = viewMode === 'following' ? isLoadingFeed : isLoadingAll;
  const error = viewMode === 'following' ? errorFeed : errorAll;

  // Execute API calls when component mounts
  useEffect(() => {
    fetchAllMemories();
    fetchFeedMemories();
  }, []);

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
          
          <div className="flex gap-2">
            <button
              onClick={() => setViewMode('all')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'all'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              All Memories
            </button>
            <button
              onClick={() => setViewMode('following')}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                viewMode === 'following'
                  ? 'bg-indigo-600 text-white'
                  : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
              }`}
            >
              Following
            </button>
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
          <p>Error loading memories: {error}</p>
          <button
            onClick={() => viewMode === 'following' ? fetchFeedMemories() : fetchAllMemories()}
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
              showAuthor={true}
              showFollowButton={true}
              linkToMemory={true}
            />
          ))}
        </div>
      )}
    </div>
  );
} 