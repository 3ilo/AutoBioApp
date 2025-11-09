import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { MemoryCard } from '../components/memories/MemoryCard';
import { Timeline } from '../components/memories/Timeline';
import { ChevronLeftIcon, ChevronRightIcon } from '@heroicons/react/24/outline';
import { memoriesApi } from '../services/api';
import { useApi } from '../hooks/useApi';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { IMemory } from '@shared/types/Memory';
import { Link, useNavigate } from 'react-router-dom';

export function Memories() {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const [memories, setMemories] = useState<IMemory[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchMemories = async () => {
    try {
      setIsLoading(true);
      setError(null);
      const response = await memoriesApi.getAll();
      setMemories(response.data);
    } catch (err) {
      setError('Failed to load memories. Please try again later.');
      console.error('Error fetching memories:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchMemories();
  }, []);

  // Sort memories by date in ascending order (oldest to newest)
  const sortedMemories = [...memories].sort((a, b) => 
    new Date(a.date).getTime() - new Date(b.date).getTime()
  );

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
      <div className="w-screen px-4 sm:px-6 lg:px-8 py-8 min-h-screen flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error loading memories: {error}</p>
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

  if (memories.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen">
        <h1 className="text-3xl font-bold text-warm-900 mb-4">No Memories Yet</h1>
        <p className="text-warm-600 mb-8">Start creating your first memory!</p>
        <Link to="/contribute" className="btn-primary">
          Create Memory
        </Link>
      </div>
    );
  }

  return (
    <div className="w-screen px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Your Memories</h1>
        <div className="text-sm text-gray-500">
          Welcome back, {user?.firstName} {user?.lastName}
        </div>
      </div>
      {sortedMemories && sortedMemories.length > 0 ? (
        <>
          <div className="relative mb-8 max-w-4xl mx-auto">
            <button
              onClick={handlePrevious}
              disabled={currentIndex === 0 || isLoading}
              className={`absolute z-10 left-0 top-1/2 -translate-y-1/2 -translate-x-4 sm:-translate-x-8 p-2 rounded-full bg-white shadow-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity ${
                currentIndex === 0 ? 'hidden' : ''
              }`}
            >
              <ChevronLeftIcon className="w-6 h-6 text-gray-600" />
            </button>
            
            <div className={`transition-all duration-300 ${isLoading ? 'opacity-0' : 'opacity-100'}`}>
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
              className={`absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 sm:translate-x-8 p-2 rounded-full bg-white shadow-md hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity ${
                currentIndex === sortedMemories.length - 1 ? 'hidden' : ''
              }`}
            >
              <ChevronRightIcon className="w-6 h-6 text-gray-600" />
            </button>
          </div>

          <Timeline
            memories={sortedMemories}
            currentIndex={currentIndex}
            onSelect={handleMemorySelect}
          />
        </>
      ) : (
        <div className="bg-white shadow rounded-lg p-6 max-w-7xl mx-auto">
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