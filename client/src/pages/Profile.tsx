import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { format } from 'date-fns';
import { IUser } from '@shared/types/User';

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
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interestsInput, setInterestsInput] = useState('');
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    bio: '.',
    location: '',
    occupation: '',
    gender: '',
    interests: [] as string[],
    culturalBackground: '',
    preferredStyle: '',
  });

  // Update profile data when user data changes
  useEffect(() => {
    if (user) {
      setProfileData({
        firstName: user.firstName || '',
        lastName: user.lastName || '',
        bio: user.bio || '',
        location: user.location || '',
        occupation: user.occupation || '',
        gender: user.gender || '',
        interests: user.interests || [],
        culturalBackground: user.culturalBackground || '',
        preferredStyle: user.preferredStyle || '',
      });
      // Also update the interests input field
      setInterestsInput(user.interests ? user.interests.join(', ') : '');
    }
  }, [user]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      await updateProfile(profileData);
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating profile:', error);
      setError(error instanceof Error ? error.message : 'Failed to update profile');
    } finally {
      setIsLoading(false);
    }
  };

  // Show loading state if user is not available
  if (!user) {
    return (
      <div className="w-screen px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex justify-center items-center h-64">
          <div className="text-gray-500">Loading profile...</div>
        </div>
      </div>
    );
  }

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
                  alt={user?.firstName}
                  className="h-16 w-16 rounded-full"
                />
                <div className="ml-4">
                  <h2 className="text-2xl font-bold text-gray-900">{user?.firstName} {user?.lastName}</h2>
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
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <label htmlFor="firstName" className="block text-sm font-medium text-gray-700">
                    First Name
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    value={profileData.firstName}
                    onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="block text-sm font-medium text-gray-700">
                    Last Name
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    value={profileData.lastName}
                    onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
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
                    placeholder="City, Country"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="occupation" className="block text-sm font-medium text-gray-700">
                    Occupation
                  </label>
                  <input
                    type="text"
                    id="occupation"
                    value={profileData.occupation}
                    onChange={(e) => setProfileData({ ...profileData, occupation: e.target.value })}
                    placeholder="Job title or field"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="gender" className="block text-sm font-medium text-gray-700">
                    Gender
                  </label>
                  <select
                    id="gender"
                    value={profileData.gender}
                    onChange={(e) => setProfileData({ ...profileData, gender: e.target.value })}
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  >
                    <option value="">Select gender</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                    <option value="non-binary">Non-binary</option>
                    <option value="other">Other</option>
                    <option value="prefer-not-to-say">Prefer not to say</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="culturalBackground" className="block text-sm font-medium text-gray-700">
                    Cultural Background
                  </label>
                  <input
                    type="text"
                    id="culturalBackground"
                    value={profileData.culturalBackground}
                    onChange={(e) => setProfileData({ ...profileData, culturalBackground: e.target.value })}
                    placeholder="e.g., American, Chinese, Mexican"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
                <div>
                  <label htmlFor="preferredStyle" className="block text-sm font-medium text-gray-700">
                    Preferred Art Style
                  </label>
                  <input
                    type="text"
                    id="preferredStyle"
                    value={profileData.preferredStyle}
                    onChange={(e) => setProfileData({ ...profileData, preferredStyle: e.target.value })}
                    placeholder="e.g., watercolor, minimalist, vibrant"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="interests" className="block text-sm font-medium text-gray-700">
                    Interests
                  </label>
                  <input
                    type="text"
                    id="interests"
                    value={interestsInput}
                    onChange={(e) => {
                      setInterestsInput(e.target.value);
                    }}
                    onBlur={(e) => {
                      // Process the interests when user finishes editing
                      const value = e.target.value;
                      const interests = value
                        .split(',')
                        .map(s => s.trim())
                        .filter(s => s.length > 0);
                      
                      setProfileData({ 
                        ...profileData, 
                        interests
                      });
                    }}
                    placeholder="hiking, photography, cooking (comma-separated)"
                    className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm py-2 px-3 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm"
                  />
                  <p className="mt-1 text-sm text-gray-500">
                    Separate multiple interests with commas (e.g., "hiking, photography, cooking")
                  </p>
                </div>
                <div className="sm:col-span-2">
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
                <div className="sm:col-span-2 flex justify-end space-x-3">
                  {error && (
                    <div className="text-sm text-red-600 self-center">
                      {error}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="px-4 py-5 sm:p-6 border-t border-gray-200">
              <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
                <div>
                  <h3 className="text-lg font-medium text-gray-900">About</h3>
                  <p className="mt-1 text-sm text-gray-500">{profileData.bio}</p>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Location</h3>
                  <p className="mt-1 text-sm text-gray-500">{profileData.location || 'Not specified'}</p>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Occupation</h3>
                  <p className="mt-1 text-sm text-gray-500">{profileData.occupation || 'Not specified'}</p>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Gender</h3>
                  <p className="mt-1 text-sm text-gray-500">{profileData.gender || 'Not specified'}</p>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Cultural Background</h3>
                  <p className="mt-1 text-sm text-gray-500">{profileData.culturalBackground || 'Not specified'}</p>
                </div>
                <div>
                  <h3 className="text-lg font-medium text-gray-900">Preferred Art Style</h3>
                  <p className="mt-1 text-sm text-gray-500">{profileData.preferredStyle || 'Not specified'}</p>
                </div>
                <div className="sm:col-span-2">
                  <h3 className="text-lg font-medium text-gray-900">Interests</h3>
                  <p className="mt-1 text-sm text-gray-500">
                    {profileData.interests.length > 0 ? profileData.interests.join(', ') : 'Not specified'}
                  </p>
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