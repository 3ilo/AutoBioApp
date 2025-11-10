import { useState, useEffect, useRef, useMemo } from 'react';
import { useAuthStore } from '../stores/authStore';
import { MemoryCard } from '../components/memories/MemoryCard';
import { Timeline } from '../components/memories/Timeline';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { memoriesApi } from '../services/api';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { IMemory } from '@shared/types/Memory';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import logger from '../utils/logger';

export function Memories() {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const [memories, setMemories] = useState<IMemory[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const isInitializingFromUrl = useRef(false);
  const hasInitializedFromUrl = useRef(false);
  const lastUrlMemoryId = useRef<string | null>(null);

  const fetchMemories = async () => {
    try {
      setIsLoading(true);
      setError(null);
      // Reset initialization flags when fetching new memories
      hasInitializedFromUrl.current = false;
      isInitializingFromUrl.current = false;
      const response = await memoriesApi.getAll();
      setMemories(response.data);
      logger.debug('Memories loaded', { count: response.data.length });
    } catch (err) {
      setError('Failed to load memories. Please try again later.');
      logger.error('Failed to fetch memories', { 
        error: err instanceof Error ? err.message : 'Unknown error'
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMemories();
  }, []);

  // Sort memories by date in ascending order (oldest to newest)
  const sortedMemories = useMemo(() => {
    return [...memories].sort((a, b) => 
      new Date(a.date).getTime() - new Date(b.date).getTime()
    );
  }, [memories]);

  // Handle deep linking: find memory by ID from URL parameter
  // This runs when memories are loaded or when URL changes externally
  useEffect(() => {
    if (sortedMemories.length > 0 && !isLoading) {
      const memoryId = searchParams.get('memoryId');
      const urlChangedExternally = memoryId !== lastUrlMemoryId.current;
      
      // Only process if we haven't initialized yet, or if URL changed externally
      if (!hasInitializedFromUrl.current || urlChangedExternally) {
        if (memoryId) {
          const index = sortedMemories.findIndex(m => m._id === memoryId);
          if (index !== -1 && index !== currentIndex) {
            logger.debug('Deep linking to memory from URL', { memoryId, index, currentIndex, urlChangedExternally });
            isInitializingFromUrl.current = true;
            setCurrentIndex(index);
            hasInitializedFromUrl.current = true;
            lastUrlMemoryId.current = memoryId;
            // Reset flag after a short delay to allow state to update
            setTimeout(() => {
              isInitializingFromUrl.current = false;
            }, 0);
          } else if (index === -1) {
            // Memory not found, remove invalid parameter
            logger.warn('Memory ID from URL not found', { memoryId });
            setSearchParams({}, { replace: true });
            hasInitializedFromUrl.current = true;
            lastUrlMemoryId.current = null;
          } else {
            // Memory already at correct index
            hasInitializedFromUrl.current = true;
            lastUrlMemoryId.current = memoryId;
          }
        } else {
          // No memoryId in URL
          if (!hasInitializedFromUrl.current) {
            hasInitializedFromUrl.current = true;
          }
          lastUrlMemoryId.current = null;
        }
      }
    }
  }, [sortedMemories, searchParams, setSearchParams, isLoading, currentIndex]);

  // Update URL when currentIndex changes (but not when initializing from URL)
  useEffect(() => {
    // Skip if we're currently initializing from URL
    if (isInitializingFromUrl.current) {
      return;
    }
    
    if (sortedMemories.length > 0 && sortedMemories[currentIndex]?._id) {
      const memoryId = sortedMemories[currentIndex]._id;
      const currentMemoryId = searchParams.get('memoryId');
      
      // Only update URL if it's different to avoid unnecessary navigation
      if (memoryId && memoryId !== currentMemoryId) {
        setSearchParams({ memoryId }, { replace: true });
        lastUrlMemoryId.current = memoryId;
      }
    }
  }, [currentIndex, sortedMemories, searchParams, setSearchParams]);

  const handleNext = () => {
    if (currentIndex < sortedMemories.length - 1) {
      setCurrentIndex(prev => prev + 1);
    }
  };

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1);
    }
  };

  const handleMemorySelect = (index: number) => {
    setCurrentIndex(index);
  };

  const handleMemoryDelete = async (memoryId: string) => {
    // Optimistically remove the memory from the UI
    setMemories(prev => prev.filter(m => m._id !== memoryId));
    
    // If we deleted the last memory, show the new last memory
    if (currentIndex >= sortedMemories.length - 1) {
      setCurrentIndex(Math.max(0, sortedMemories.length - 2));
    }
  };

  const handleMemoryEdit = (memory: IMemory) => {
    // Navigate to contribute page with memory data for editing
    navigate('/contribute', { 
      state: { 
        editingMemory: memory,
        isEditing: true 
      } 
    });
  };

  if (isLoading) {
    return (
      <div className="w-full px-6 sm:px-8 lg:px-12 py-12 min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center px-6">
        <div className="text-center">
          <p className="text-red-600 mb-6 text-sm uppercase tracking-wider">Error loading memories: {error}</p>
          <button
            onClick={() => fetchMemories()}
            className="btn-secondary"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  if (memories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen px-6">
        <h1 className="text-4xl font-semibold text-slate-900 mb-4 tracking-tight">No Memories Yet</h1>
        <p className="text-slate-600 mb-8 text-sm uppercase tracking-wider">Start creating your first memory!</p>
        <Link to="/contribute" className="btn-primary">
          Create Memory
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full px-6 sm:px-8 lg:px-12 py-12">
      <div className="flex justify-between items-baseline mb-12 border-b border-slate-200 pb-4">
        <h1 className="text-4xl font-semibold text-slate-900 tracking-tight">Your Memories</h1>
        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
          {user?.firstName} {user?.lastName}
        </div>
      </div>
      {sortedMemories && sortedMemories.length > 0 ? (
        <>
          <div className="relative mb-12 max-w-6xl mx-auto">
            <button
              onClick={handlePrevious}
              disabled={currentIndex === 0 || isLoading}
              className={`absolute z-10 left-0 top-1/2 -translate-y-1/2 -translate-x-8 sm:-translate-x-16 text-slate-400 hover:text-slate-900 disabled:opacity-20 disabled:cursor-not-allowed transition-colors duration-150 ${
                currentIndex === 0 ? 'hidden' : ''
              }`}
            >
              <ChevronLeftIcon className="w-8 h-8" />
            </button>
            
            <div className={`transition-all duration-200 ${isLoading ? 'opacity-0' : 'opacity-100'}`}>
              <MemoryCard
                memory={sortedMemories[currentIndex]}
                isActive={true}
                onDelete={handleMemoryDelete}
                onEdit={handleMemoryEdit}
                key={sortedMemories[currentIndex]._id}
              />
            </div>

            <button
              onClick={handleNext}
              disabled={currentIndex === sortedMemories.length - 1 || isLoading}
              className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-8 sm:translate-x-16 text-slate-400 hover:text-slate-900 disabled:opacity-20 disabled:cursor-not-allowed transition-colors duration-150 ${
                currentIndex === sortedMemories.length - 1 ? 'hidden' : ''
              }`}
            >
              <ChevronRightIcon className="w-8 h-8" />
            </button>
          </div>

          <Timeline
            memories={sortedMemories}
            currentIndex={currentIndex}
            onSelect={handleMemorySelect}
          />
        </>
      ) : (
        <div className="bg-white border border-slate-200 p-12 max-w-4xl mx-auto text-center">
          <p className="text-slate-600 mb-6 text-sm uppercase tracking-wider">No memories yet. Start by creating one!</p>
          <Link
            to="/contribute"
            className="btn-primary inline-flex"
          >
            Create Your First Memory
          </Link>
        </div>
      )}
    </div>
  );
} 