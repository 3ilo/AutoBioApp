import { useState, useEffect } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import { characterApi } from '../services/api';
import { ICharacter } from '../types/character';
import { CharacterForm } from '../components/characters/CharacterForm';
import { usePresignedUrl } from '../hooks/usePresignedUrl';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { useAuthStore } from '../stores/authStore';
import logger from '../utils/logger';

export function Character() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const user = useAuthStore((state) => state.user);
  
  // Check if we're in edit mode from the route
  const isEditMode = location.pathname.endsWith('/edit');
  
  const [character, setCharacter] = useState<ICharacter | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isEditing, setIsEditing] = useState(isEditMode);

  // Convert avatar S3 URI to pre-signed URL for display
  const avatarUrl = usePresignedUrl(character?.avatarS3Uri);

  useEffect(() => {
    if (id) {
      loadCharacter();
    }
  }, [id]);

  useEffect(() => {
    // Sync edit state with route
    setIsEditing(isEditMode);
  }, [isEditMode]);

  const loadCharacter = async () => {
    if (!id) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await characterApi.getById(id);
      const loadedCharacter = response.data.character;
      setCharacter(loadedCharacter);
      logger.debug('Character loaded', { characterId: id });
    } catch (error) {
      logger.error('Failed to load character', {
        error: error instanceof Error ? error.message : 'Unknown error',
        characterId: id,
      });
      setError('Failed to load character. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = () => {
    navigate(`/characters/${id}/edit`);
  };

  const handleCancel = () => {
    navigate(`/characters/${id}`);
  };

  const handleCharacterUpdated = async (updatedCharacter: ICharacter) => {
    // Update character state when form is saved (even if staying in edit mode)
    setCharacter(updatedCharacter);
  };

  const handleSave = async (updatedCharacter: ICharacter) => {
    // Update character state
    await handleCharacterUpdated(updatedCharacter);
    
    // Navigate back to readonly view
    navigate(`/characters/${id}`);
  };

  // Check if user owns this character
  const isOwner = character?.userId === user?._id;

  if (isLoading) {
    return (
      <div className="w-full px-6 sm:px-8 lg:px-12 py-12">
        <div className="flex justify-center items-center h-64">
          <LoadingSpinner />
        </div>
      </div>
    );
  }

  if (error || !character) {
    return (
      <div className="w-full px-6 sm:px-8 lg:px-12 py-12">
        <div className="max-w-6xl mx-auto">
          <div className="bg-red-50 border border-red-200 rounded-md p-4">
            <p className="text-sm text-red-800">{error || 'Character not found'}</p>
            <button
              onClick={() => navigate('/profile')}
              className="mt-2 text-sm text-red-600 underline"
            >
              Back to Profile
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full px-6 sm:px-8 lg:px-12 py-12">
      <div className="space-y-12 max-w-6xl mx-auto">
        {/* Character Header */}
        <div className="bg-white border border-slate-200">
          <div className="px-8 py-8">
            <div className="flex items-center justify-between border-b border-slate-200 pb-6">
              <div className="flex items-center gap-6">
                <div 
                  style={{
                    background: 'linear-gradient(to bottom, #c85064 0%, #c88250 14%, #c8aa64 28%, #64b48c 42%, #648cc8 57%, #7878c8 71%, #9678c8 85%, #c8648c 100%)',
                    padding: '2px'
                  }}
                >
                  <img
                    src={avatarUrl}
                    alt={`${character.firstName} ${character.lastName}`}
                    className="h-20 w-20 object-cover bg-white"
                  />
                </div>
                <div>
                  <h2 className="text-3xl font-semibold text-slate-900 tracking-tight mb-1">
                    {character.firstName} {character.lastName}
                  </h2>
                  <p className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                    {character.relationship ? `${character.relationship} • ` : ''}
                    {character.age} years old
                  </p>
                </div>
              </div>
              {isOwner && (
                <div className="flex items-center gap-3">
                  {!isEditing ? (
                    <button
                      onClick={handleEdit}
                      className="btn-secondary"
                    >
                      <svg className="w-4 h-4 mr-2 inline-block" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                      Edit Character
                    </button>
                  ) : (
                    <button
                      onClick={handleCancel}
                      className="btn-secondary"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>

          {isEditing ? (
            <div className="px-8 py-8 border-t border-slate-200">
              <CharacterForm
                character={character}
                onSave={handleSave}
                onCancel={handleCancel}
                stayInEditModeAfterSave={true}
                onCharacterUpdated={handleCharacterUpdated}
              />
            </div>
          ) : (
            <div className="px-8 py-8 border-t border-slate-200">
              <div className="grid grid-cols-1 gap-8 sm:grid-cols-2">
                {character.gender && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Gender</h3>
                    <p className="text-sm text-slate-700 capitalize">{character.gender}</p>
                  </div>
                )}
                {character.relationship && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Relationship</h3>
                    <p className="text-sm text-slate-700">{character.relationship}</p>
                  </div>
                )}
                {character.culturalBackground && (
                  <div>
                    <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Cultural Background</h3>
                    <p className="text-sm text-slate-700">{character.culturalBackground}</p>
                  </div>
                )}
                <div>
                  <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-2">Age</h3>
                  <p className="text-sm text-slate-700">{character.age} years old</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
