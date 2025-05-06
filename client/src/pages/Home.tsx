import { Link } from 'react-router-dom';
import { format } from 'date-fns';
import { memoriesApi } from '../services/api';
import { useApi } from '../hooks/useApi';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';

export function Home() {
  const {
    data: featuredMemories,
    isLoading,
    error,
  } = useApi(memoriesApi.getAll, []);

  return (
    <div className="w-screen px-4 sm:px-6 lg:px-8 py-8">
      {/* Hero Section */}
      <div className="bg-indigo-600 text-white">
        <div className="max-w-7xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl md:text-6xl">
              <span className="block">Capture Your Life's</span>
              <span className="block text-indigo-200">Precious Moments</span>
            </h1>
            <p className="mt-3 max-w-md mx-auto text-base text-indigo-100 sm:text-lg md:mt-5 md:text-xl md:max-w-3xl">
              Create beautiful memories with AI-powered storytelling. Share your journey with loved ones and preserve your legacy.
            </p>
            <div className="mt-5 max-w-md mx-auto sm:flex sm:justify-center md:mt-8">
              <div className="rounded-md shadow">
                <Link
                  to="/contribute"
                  className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-indigo-600 bg-white hover:bg-indigo-50 md:py-4 md:text-lg md:px-10"
                >
                  Start Contributing
                </Link>
              </div>
              <div className="mt-3 sm:mt-0 sm:ml-3">
                <Link
                  to="/explore"
                  className="w-full flex items-center justify-center px-8 py-3 border border-transparent text-base font-medium rounded-md text-white bg-indigo-500 hover:bg-indigo-400 md:py-4 md:text-lg md:px-10"
                >
                  View Memories
                </Link>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Featured Memories Section */}
      <div className="max-w-7xl mx-auto py-16 px-4 sm:px-6 lg:px-8">
        <div className="text-center">
          <h2 className="text-3xl font-extrabold text-gray-900 sm:text-4xl">
            Featured Memories
          </h2>
          <p className="mt-4 text-lg text-gray-500">
            Discover stories from our community
          </p>
        </div>

        {isLoading ? (
          <div className="mt-12 flex justify-center">
            <LoadingSpinner size="lg" />
          </div>
        ) : error ? (
          <div className="mt-12 text-center text-red-600">
            <p>Error loading featured memories: {error.message}</p>
          </div>
        ) : featuredMemories && featuredMemories.length > 0 ? (
          <div className="mt-12 grid gap-8 md:grid-cols-2 lg:grid-cols-3">
            {featuredMemories.slice(0, 3).map((memory) => (
              <div
                key={memory._id}
                className="bg-white rounded-lg shadow-lg overflow-hidden"
              >
                {memory.images.length > 0 && (
                  <div className="aspect-w-16 aspect-h-9">
                    <img
                      src={memory.images[0].url}
                      alt={memory.title}
                      className="w-full h-48 object-cover"
                    />
                  </div>
                )}
                <div className="p-6">
                  <div className="flex items-center mb-4">
                    <img
                      src={memory.author.avatar || `https://ui-avatars.com/api/?name=${memory.author.firstName}`}
                      alt={memory.author.firstName}
                      className="h-10 w-10 rounded-full"
                    />
                    <div className="ml-3">
                      <p className="text-sm font-medium text-gray-900">
                        {memory.author.firstName}
                      </p>
                      <p className="text-sm text-gray-500">
                        {format(new Date(memory.date), 'MMM d, yyyy')}
                      </p>
                    </div>
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">
                    {memory.title}
                  </h3>
                  <p className="text-gray-600 line-clamp-3 mb-4">
                    {memory.content}
                  </p>
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
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="mt-12 text-center text-gray-500">
            <p>No featured memories available yet.</p>
          </div>
        )}
      </div>
    </div>
  );
} 