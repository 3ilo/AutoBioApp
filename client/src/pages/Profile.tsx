import { useState } from 'react';
import { useAuthStore } from '../stores/authStore';
import { format } from 'date-fns';

// Temporary mock data
const mockStats = {
  totalMemories: 12,
  totalLikes: 45,
  totalComments: 23,
  joinedDate: '2024-01-01',
};

const mockMemories = [
  {
    id: '1',
    title: 'First Day at School',
    content: 'I remember walking into my first day of school, feeling both excited and nervous...',
    date: '2024-01-15',
    images: ['https://picsum.photos/800/400'],
    tags: ['childhood', 'education'],
    likes: 12,
    comments: 3,
  },
  // Add more mock memories...
];

export function Profile() {
  const user = useAuthStore((state) => state.user);
  const [isEditing, setIsEditing] = useState(false);
  const [profileData, setProfileData] = useState({
    name: user?.name || '',
    bio: 'I love capturing and sharing my life\'s moments.',
    location: 'San Francisco, CA',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    // TODO: Update profile in backend
    setIsEditing(false);
  };

  return (
    <div className="w-screen px-4 sm:px-6 lg:px-8 py-8">
      <div className="space-y-8">
        {/* Profile Header */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <img
                  src={user?.avatar || 'https://picsum.photos/100/100'}
                  alt={user?.name}
                  className="h-16 w-16 rounded-full"
                />
                <div className="ml-4">
                  <h2 className="text-2xl font-bold text-gray-900">{user?.name}</h2>
                  <p className="text-sm text-gray-500">Member since {format(new Date(mockStats.joinedDate), 'MMMM yyyy')}</p>
                </div>
              </div>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="inline-flex items-center px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                {isEditing ? 'Cancel' : 'Edit Profile'}
              </button>
            </div>
          </div>

          {isEditing ? (
            <form onSubmit={handleSubmit} className="px-4 py-5 sm:p-6 border-t border-gray-200">
              <div className="space-y-6">
                <div>
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Name
                  </label>
                  <input
                    type="text"
                    id="name"
                    value={profileData.name}
                    onChange={(e) => setProfileData({ ...profileData, name: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="bio" className="block text-sm font-medium text-gray-700">
                    Bio
                  </label>
                  <textarea
                    id="bio"
                    rows={3}
                    value={profileData.bio}
                    onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="location" className="block text-sm font-medium text-gray-700">
                    Location
                  </label>
                  <input
                    type="text"
                    id="location"
                    value={profileData.location}
                    onChange={(e) => setProfileData({ ...profileData, location: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
                <div className="flex justify-end">
                  <button
                    type="submit"
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
                  >
                    Save Changes
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="px-4 py-5 sm:p-6 border-t border-gray-200">
              <div className="space-y-4">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">About</h3>
                  <p className="mt-1 text-sm text-gray-500">{profileData.bio}</p>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Location</h3>
                  <p className="mt-1 text-sm text-gray-500">{profileData.location}</p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-3">
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <dt className="text-sm font-medium text-gray-500 truncate">Total Memories</dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900">{mockStats.totalMemories}</dd>
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <dt className="text-sm font-medium text-gray-500 truncate">Total Likes</dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900">{mockStats.totalLikes}</dd>
            </div>
          </div>
          <div className="bg-white overflow-hidden shadow rounded-lg">
            <div className="px-4 py-5 sm:p-6">
              <dt className="text-sm font-medium text-gray-500 truncate">Total Comments</dt>
              <dd className="mt-1 text-3xl font-semibold text-gray-900">{mockStats.totalComments}</dd>
            </div>
          </div>
        </div>

        {/* Recent Memories */}
        <div className="bg-white shadow rounded-lg">
          <div className="px-4 py-5 sm:px-6">
            <h3 className="text-lg font-medium text-gray-900">Recent Memories</h3>
          </div>
          <div className="border-t border-gray-200">
            <ul className="divide-y divide-gray-200">
              {mockMemories.map((memory) => (
                <li key={memory.id} className="px-4 py-4 sm:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <h4 className="text-sm font-medium text-indigo-600 truncate">{memory.title}</h4>
                      <p className="mt-1 text-sm text-gray-500 line-clamp-2">{memory.content}</p>
                    </div>
                    <div className="ml-4 flex-shrink-0 flex items-center space-x-4">
                      <div className="text-sm text-gray-500">
                        {format(new Date(memory.date), 'MMM d, yyyy')}
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm text-gray-500">❤️ {memory.likes}</span>
                        <span className="text-sm text-gray-500">💬 {memory.comments}</span>
                      </div>
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
} 