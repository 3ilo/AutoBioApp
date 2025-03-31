import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { MemoryCard } from '../components/memories/MemoryCard';
import { Timeline } from '../components/memories/Timeline';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { memoriesApi } from '../services/api';
import { useApi } from '../hooks/useApi';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { Memory } from '../types';

export function Memories() {
  const user = useAuthStore((state) => state.user);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const {
    data: memories,
    isLoading,
    error,
    execute: fetchMemories,
  } = useApi(memoriesApi.getAll, []);

  useEffect(() => {
    fetchMemories();
  }, [fetchMemories]);

  const handlePrevious = () => {
    if (currentIndex > 0) {
      setIsTransitioning(true);
      setCurrentIndex(prev => prev - 1);
      setTimeout(() => setIsTransitioning(false), 300);
    }
  };

  const handleNext = () => {
    if (currentIndex < (memories?.length ?? 0) - 1) {
      setIsTransitioning(true);
      setCurrentIndex(prev => prev + 1);
      setTimeout(() => setIsTransitioning(false), 300);
    }
  };

  const handleTimelineSelect = (index: number) => {
    if (index !== currentIndex) {
      setIsTransitioning(true);
      setCurrentIndex(index);
      setTimeout(() => setIsTransitioning(false), 300);
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        handlePrevious();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error loading memories: {error.message}</p>
          <button
            onClick={() => fetchMemories()}
            className="text-indigo-600 hover:text-indigo-800"
          >
            Try again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Your Memories</h1>
        <div className="text-sm text-gray-500">
          Welcome back, {user?.firstName} {user?.lastName}
        </div>
      </div>
      {memories && memories.length > 0 ? (
        <>
          <div className="relative mb-8">
            <button
              onClick={handlePrevious}
              disabled={currentIndex === 0 || isTransitioning}
              className={`absolute z-10 left-0 top-1/2 -translate-y-1/2 -translate-x-4 sm:-translate-x-8 p-2 rounded-full bg-white shadow-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity ${
                currentIndex === 0 ? 'hidden' : ''
              }`}
            >
              <ChevronLeftIcon className="w-6 h-6 text-gray-600" />
            </button>
            
            <div className={`transition-all duration-300 ${isTransitioning ? 'opacity-0' : 'opacity-100'}`}>
              <MemoryCard
                memory={memories[currentIndex]}
                isActive={true}
                key={memories[currentIndex]._id}
              />
            </div>

            <button
              onClick={handleNext}
              disabled={currentIndex === memories.length - 1 || isTransitioning}
              className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 sm:translate-x-8 p-2 rounded-full bg-white shadow-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity ${
                currentIndex === memories.length - 1 ? 'hidden' : ''
              }`}
            >
              <ChevronRightIcon className="w-6 h-6 text-gray-600" />
            </button>
          </div>

          <Timeline
            memories={memories}
            currentIndex={currentIndex}
            onSelect={handleTimelineSelect}
          />
        </>
      ) : (
        <div className="bg-white shadow rounded-lg p-6">
          <div className="text-center">
            <p className="text-gray-500 mb-4">No memories yet. Start by creating one!</p>
            <a
              href="/contribute"
              className="inline-flex items-center px-4 py-2 border border-transparent text-sm font-medium rounded-md text-white bg-indigo-600 hover:bg-indigo-700"
            >
              Create Your First Memory
            </a>
          </div>
        </div>
      )}
    </div>
  );
} 