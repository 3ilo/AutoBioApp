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
    <div className="w-full px-6 sm:px-8 lg:px-12 py-12">
      <div className="mb-12 border-b border-slate-200 pb-6">
        <h1 className="text-4xl font-semibold text-slate-900 mb-8 tracking-tight">Explore Memories</h1>
        
        <div className="flex flex-col sm:flex-row gap-4 mb-6">
          <div className="flex-1 min-w-[300px]">
            <input
              type="text"
              placeholder="Search memories..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="input-field w-full"
            />
          </div>
          
          <div className="flex gap-2 flex-shrink-0">
            <button
              onClick={() => setViewMode('all')}
              className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-all duration-150 whitespace-nowrap ${
                viewMode === 'all'
                  ? 'bg-slate-900 text-white border-2 border-slate-900'
                  : 'bg-transparent text-slate-900 border-2 border-slate-900 hover:bg-slate-900 hover:text-white'
              }`}
            >
              All
            </button>
            <button
              onClick={() => setViewMode('following')}
              className={`px-3 py-2 text-xs font-semibold uppercase tracking-wider transition-all duration-150 whitespace-nowrap ${
                viewMode === 'following'
                  ? 'bg-slate-900 text-white border-2 border-slate-900'
                  : 'bg-transparent text-slate-900 border-2 border-slate-900 hover:bg-slate-900 hover:text-white'
              }`}
            >
              Following
            </button>
          </div>
          
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as 'date' | 'likes')}
            className="input-field flex-shrink-0 w-auto"
          >
            <option value="date">Sort by Date</option>
            <option value="likes">Sort by Likes</option>
          </select>
        </div>

        {allTags.length > 0 && (
          <div className="mt-6">
            <h2 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Filter by Tags</h2>
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
                  className={`px-3 py-1.5 text-xs font-semibold uppercase tracking-wider border transition-all duration-150 ${
                    selectedTags.includes(tag)
                      ? 'bg-slate-900 text-white border-slate-900'
                      : 'bg-transparent text-slate-700 border-slate-200 hover:border-slate-900 hover:text-slate-900'
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
        <div className="text-center">
          <p className="text-red-600 mb-6 text-sm uppercase tracking-wider">Error loading memories: {error}</p>
          <button
            onClick={() => viewMode === 'following' ? fetchFeedMemories() : fetchAllMemories()}
            className="btn-secondary"
          >
            Try again
          </button>
        </div>
      ) : sortedMemories.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-slate-600 text-sm uppercase tracking-wider">No memories found matching your criteria.</p>
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