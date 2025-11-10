import { useState, useEffect } from 'react';
import { useAuthStore } from '../stores/authStore';
import { format } from 'date-fns';
import { AvatarGenerator } from '../components/avatar/AvatarGenerator';
import { usePresignedUrl } from '../hooks/usePresignedUrl';
import { memoriesApi } from '../services/api';
import { IMemory } from '@shared/types/Memory';
import { Link } from 'react-router-dom';
import { getMemoryLink } from '../utils/memoryLinks';
import logger from '../utils/logger';

export function Profile() {
  const user = useAuthStore((state) => state.user);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [interestsInput, setInterestsInput] = useState('');
  const [memories, setMemories] = useState<IMemory[]>([]);
  const [isLoadingMemories, setIsLoadingMemories] = useState(true);
  
  // Convert avatar S3 URI to pre-signed URL for display
  const avatarUrl = usePresignedUrl(user?.avatar);
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
    avatar: '',
  });

  // Fetch user's memories
  useEffect(() => {
    const fetchMemories = async () => {
      if (!user) return;
      
      try {
        setIsLoadingMemories(true);
        const response = await memoriesApi.getAll();
        setMemories(response.data);
        logger.debug('Profile: Memories loaded', { count: response.data.length });
      } catch (err) {
        logger.error('Failed to fetch memories for profile', {
          error: err instanceof Error ? err.message : 'Unknown error'
        });
      } finally {
        setIsLoadingMemories(false);
      }
    };

    fetchMemories();
  }, [user]);

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
        avatar: user.avatar || '',
      });
      // Also update the interests input field
      setInterestsInput(user.interests ? user.interests.join(', ') : '');
    }
  }, [user]);

  // Calculate statistics from actual data
  const stats = {
    totalMemories: memories.length,
    totalLikes: memories.reduce((sum, memory) => sum + (memory.likes?.length || 0), 0),
    totalComments: memories.reduce((sum, memory) => sum + (memory.comments?.length || 0), 0),
    joinedDate: user?.createdAt ? new Date(user.createdAt) : new Date(),
  };

  // Get recent memories (sorted by date, most recent first)
  const recentMemories = memories
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .slice(0, 3); // Show only the 3 most recent

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError(null);
    
    try {
      await updateProfile(profileData);
      logger.info('Profile updated successfully');
      setIsEditing(false);
    } catch (error) {
      logger.error('Failed to update profile', { 
        error: error instanceof Error ? error.message : 'Unknown error'
      });
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
    <div className="w-full px-6 sm:px-8 lg:px-12 py-12">
      <div className="space-y-12 max-w-6xl mx-auto">
        {/* Profile Header */}
        <div className="bg-white border border-slate-200">
          <div className="px-8 py-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-6">
              <div className="flex items-center gap-6">
                <div className="border-2 border-slate-900">
                  <img
                    src={avatarUrl}
                    alt={user?.firstName}
                    className="h-20 w-20 object-cover"
                  />
                </div>
                <div>
                  <h2 className="text-3xl font-semibold text-slate-900 tracking-tight mb-1">{user?.firstName} {user?.lastName}</h2>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    Member since {format(stats.joinedDate, 'MMMM yyyy')}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className="btn-secondary"
              >
                {isEditing ? 'Cancel' : 'Edit Profile'}
              </button>
            </div>
          </div>

          {isEditing ? (
            <form onSubmit={handleSubmit} className="px-8 py-8 border-t border-slate-200">
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
                <div>
                  <label htmlFor="firstName" className="form-label">
                    First Name
                  </label>
                  <input
                    type="text"
                    id="firstName"
                    value={profileData.firstName}
                    onChange={(e) => setProfileData({ ...profileData, firstName: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label htmlFor="lastName" className="form-label">
                    Last Name
                  </label>
                  <input
                    type="text"
                    id="lastName"
                    value={profileData.lastName}
                    onChange={(e) => setProfileData({ ...profileData, lastName: e.target.value })}
                    className="input-field"
                  />
                </div>
                <div>
                  <label htmlFor="location" className="form-label">
                    Location
                  </label>
                  <input
                    type="text"
                    id="location"
                    value={profileData.location}
                    onChange={(e) => setProfileData({ ...profileData, location: e.target.value })}
                    placeholder="City, Country"
                    className="input-field"
                  />
                </div>
                <div>
                  <label htmlFor="occupation" className="form-label">
                    Occupation
                  </label>
                  <input
                    type="text"
                    id="occupation"
                    value={profileData.occupation}
                    onChange={(e) => setProfileData({ ...profileData, occupation: e.target.value })}
                    placeholder="Job title or field"
                    className="input-field"
                  />
                </div>
                <div>
                  <label htmlFor="gender" className="form-label">
                    Gender
                  </label>
                  <select
                    id="gender"
                    value={profileData.gender}
                    onChange={(e) => setProfileData({ ...profileData, gender: e.target.value })}
                    className="input-field"
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
                  <label htmlFor="culturalBackground" className="form-label">
                    Cultural Background
                  </label>
                  <input
                    type="text"
                    id="culturalBackground"
                    value={profileData.culturalBackground}
                    onChange={(e) => setProfileData({ ...profileData, culturalBackground: e.target.value })}
                    placeholder="e.g., American, Chinese, Mexican"
                    className="input-field"
                  />
                </div>
                <div>
                  <label htmlFor="preferredStyle" className="form-label">
                    Preferred Art Style
                  </label>
                  <input
                    type="text"
                    id="preferredStyle"
                    value={profileData.preferredStyle}
                    onChange={(e) => setProfileData({ ...profileData, preferredStyle: e.target.value })}
                    placeholder="e.g., watercolor, minimalist, vibrant"
                    className="input-field"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="interests" className="form-label">
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
                    className="input-field"
                  />
                  <p className="mt-2 text-xs text-slate-500 uppercase tracking-wider">
                    Separate multiple interests with commas
                  </p>
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="bio" className="form-label">
                    Bio
                  </label>
                  <textarea
                    id="bio"
                    rows={4}
                    value={profileData.bio}
                    onChange={(e) => setProfileData({ ...profileData, bio: e.target.value })}
                    className="input-field"
                  />
                </div>
                
                {/* Avatar Generation Section */}
                <div className="sm:col-span-2">
                  <AvatarGenerator
                    onAvatarSelected={(avatarUrl) => setProfileData({ ...profileData, avatar: avatarUrl })}
                    currentAvatar={profileData.avatar}
                  />
                </div>
                <div className="sm:col-span-2 flex justify-end gap-3 pt-4 border-t border-slate-200">
                  {error && (
                    <div className="error-text self-center">
                      {error}
                    </div>
                  )}
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="btn-primary"
                  >
                    {isLoading ? 'Saving...' : 'Save Changes'}
                  </button>
                </div>
              </div>
            </form>
          ) : (
            <div className="px-8 py-8 border-t border-slate-200">
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">About</h3>
                  <p className="text-sm text-slate-700 leading-relaxed">{profileData.bio || 'Not specified'}</p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Location</h3>
                  <p className="text-sm text-slate-700">{profileData.location || 'Not specified'}</p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Occupation</h3>
                  <p className="text-sm text-slate-700">{profileData.occupation || 'Not specified'}</p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Gender</h3>
                  <p className="text-sm text-slate-700">{profileData.gender || 'Not specified'}</p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Cultural Background</h3>
                  <p className="text-sm text-slate-700">{profileData.culturalBackground || 'Not specified'}</p>
                </div>
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Preferred Art Style</h3>
                  <p className="text-sm text-slate-700">{profileData.preferredStyle || 'Not specified'}</p>
                </div>
                <div className="sm:col-span-2">
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Interests</h3>
                  <p className="text-sm text-slate-700">
                    {profileData.interests.length > 0 ? profileData.interests.join(', ') : 'Not specified'}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div className="bg-white border border-slate-200 p-8">
            <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Total Memories</dt>
            <dd className="text-4xl font-semibold text-slate-900 tracking-tight">
              {isLoadingMemories ? '...' : stats.totalMemories}
            </dd>
          </div>
          <div className="bg-white border border-slate-200 p-8">
            <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Total Likes</dt>
            <dd className="text-4xl font-semibold text-slate-900 tracking-tight">
              {isLoadingMemories ? '...' : stats.totalLikes}
            </dd>
          </div>
          <div className="bg-white border border-slate-200 p-8">
            <dt className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Total Comments</dt>
            <dd className="text-4xl font-semibold text-slate-900 tracking-tight">
              {isLoadingMemories ? '...' : stats.totalComments}
            </dd>
          </div>
        </div>

        {/* Recent Memories */}
        <div className="bg-white border border-slate-200">
          <div className="px-8 py-6 border-b border-slate-200">
            <h3 className="text-xl font-semibold text-slate-900 tracking-tight">Recent Memories</h3>
          </div>
          <div>
            {isLoadingMemories ? (
              <div className="px-8 py-12 text-center text-slate-500 text-sm uppercase tracking-wider">Loading memories...</div>
            ) : recentMemories.length === 0 ? (
              <div className="px-8 py-12 text-center text-slate-500 text-sm uppercase tracking-wider">No memories yet. Start creating your first memory!</div>
            ) : (
              <ul className="divide-y divide-slate-200">
                {recentMemories.map((memory) => (
                  <li key={memory._id} className="hover:bg-slate-50 transition-colors duration-150">
                    <Link 
                      to={getMemoryLink(memory._id)}
                      className="flex items-center justify-between px-8 py-6 block"
                    >
                      <div className="flex-1 min-w-0">
                        <h4 className="text-base font-semibold text-slate-900 truncate mb-1 tracking-tight">
                          {memory.title}
                        </h4>
                        <p className="text-sm text-slate-600 line-clamp-2 leading-relaxed">
                          {(() => {
                            const plainText = memory.content.replace(/<[^>]*>/g, '');
                            return plainText.length > 100 ? plainText.substring(0, 100) + '...' : plainText;
                          })()}
                        </p>
                      </div>
                      <div className="ml-6 flex-shrink-0 flex items-center gap-6">
                        <div className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                          {format(new Date(memory.date), 'MMM d, yyyy')}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-slate-500">{memory.likes?.length || 0}</span>
                          <span className="text-xs text-slate-500">{memory.comments?.length || 0}</span>
                        </div>
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  );
} 