import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { memoriesApi } from '../services/api';
import { useApi } from '../hooks/useApi';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { MemoryImage } from '../components/memories/MemoryImage';
import { getErrorMessage } from '../utils/errorMessages';

export function Home() {
  const {
    data: featuredMemories,
    isLoading,
    error,
  } = useApi(memoriesApi.getAll, []);

  return (
    <div className="w-full">
      {/* Hero Section - Minimal, sharp */}
      <div className="bg-slate-900 text-white border-b-4 border-slate-700">
        <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-24">
          <div className="text-center">
            <h1 className="text-5xl sm:text-6xl md:text-7xl font-semibold tracking-tight mb-6">
              <span className="block">Capture Your Life's</span>
              <span className="block">Precious Moments</span>
            </h1>
            <p className="mt-6 max-w-2xl mx-auto text-lg text-slate-300 leading-relaxed">
              Tell your stories through an intelligently augmented autobiography. Share your experience and preserve your legacy.
            </p>
            <div className="mt-10 flex flex-col sm:flex-row gap-4 justify-center">
              <Link
                to="/contribute"
                className="btn-primary"
              >
                Start Contributing
              </Link>
              <Link
                to="/explore"
                className="btn-secondary text-white border-white hover:bg-white hover:text-slate-900"
              >
                View Memories
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Featured Memories Section - Colorful cards */}
      <div className="max-w-7xl mx-auto px-6 sm:px-8 lg:px-12 py-20">
        <div className="text-center mb-16">
          <h2 className="text-4xl font-semibold text-slate-900 tracking-tight mb-3">
            Featured Memories
          </h2>
          <p className="text-sm text-slate-500 uppercase tracking-wider">
            Discover stories from our community
          </p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-20">
            <LoadingSpinner size="lg" />
          </div>
        ) : error ? (
          <div className="text-center py-20">
            <div className="error-message inline-block">
              {getErrorMessage(error)}
            </div>
          </div>
        ) : featuredMemories && featuredMemories.length > 0 ? (
          <div className="grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {featuredMemories.slice(0, 3).map((memory) => {
              // Generate vibrant color for each memory card
              const getMemoryColor = (id: string | undefined) => {
                if (!id) return '#2979ff';
                const colors = ['#ff1744', '#ff6f00', '#ffc400', '#00e676', '#2979ff', '#3d5afe', '#7c4dff', '#e91e63'];
                const hash = id.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
                return colors[hash % colors.length];
              };
              const memoryColor = getMemoryColor(memory._id);
              
              return (
                <div
                  key={memory._id}
                  className="bg-white border-2 border-slate-200 hover:border-slate-900 transition-all duration-150"
                >
                  {memory.images.length > 0 && (
                    <div className="border-b-2 border-slate-200">
                      <MemoryImage
                        src={memory.images[0].url}
                        alt={memory.title}
                        className="w-full h-64 object-cover"
                      />
                    </div>
                  )}
                  <div className="p-6">
                    <div className="flex items-center gap-3 mb-4 pb-4 border-b border-slate-200">
                      <div 
                        className="w-10 h-10 border-2 border-slate-200"
                        style={{ backgroundColor: memoryColor }}
                      />
                      <div>
                        <p className="text-xs font-semibold text-slate-900 uppercase tracking-wider">
                          {memory.author.firstName} {memory.author.lastName}
                        </p>
                        <p className="text-xs text-slate-500 uppercase tracking-wider">
                          {format(new Date(memory.date), 'MMM d, yyyy')}
                        </p>
                      </div>
                    </div>
                    <h3 className="text-xl font-semibold text-slate-900 mb-3 tracking-tight">
                      {memory.title}
                    </h3>
                    <p className="text-sm text-slate-600 line-clamp-3 mb-4 leading-relaxed">
                      {memory.content.replace(/<[^>]*>/g, '').substring(0, 150)}...
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {memory.tags.map((tag) => (
                        <span
                          key={tag}
                          className="inline-flex items-center px-3 py-1 text-xs font-semibold uppercase tracking-wider bg-slate-100 text-slate-700 border border-slate-200"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="text-center py-20">
            <p className="text-slate-600 text-sm uppercase tracking-wider">No featured memories available yet.</p>
          </div>
        )}
      </div>
    </div>
  );
} 