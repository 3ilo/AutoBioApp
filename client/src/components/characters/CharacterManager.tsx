import { useState, useEffect } from 'react';
import { ICharacter } from '../../types/character';
import { characterApi, imageGenerationApi } from '../../services/api';
import { CharacterForm } from './CharacterForm';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import logger from '../../utils/logger';

interface CharacterManagerProps {
  isOpen: boolean;
  onClose: () => void;
}

type View = 'list' | 'create' | 'edit';

export function CharacterManager({ isOpen, onClose }: CharacterManagerProps) {
  const [characters, setCharacters] = useState<ICharacter[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<View>('list');
  const [selectedCharacter, setSelectedCharacter] = useState<ICharacter | null>(null);
  const [characterAvatarUrls, setCharacterAvatarUrls] = useState<Record<string, string>>({});

  useEffect(() => {
    if (isOpen) {
      loadCharacters();
    }
  }, [isOpen]);

  const loadCharacters = async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await characterApi.getAll();
      setCharacters(response.data.characters);
      
      // Load presigned URLs for avatars
      const avatarUrls: Record<string, string> = {};
      for (const char of response.data.characters) {
        if (char.avatarS3Uri) {
          try {
            const presignedResponse = await imageGenerationApi.generatePresignedViewUrl(char.avatarS3Uri);
            avatarUrls[char._id] = presignedResponse.data.presignedUrl;
          } catch (e) {
            logger.warn('Failed to load avatar for character', { characterId: char._id });
          }
        }
      }
      setCharacterAvatarUrls(avatarUrls);
      
      logger.debug('Characters loaded', { count: response.data.characters.length });
    } catch (error) {
      logger.error('Failed to load characters', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      setError('Failed to load characters. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCreateClick = () => {
    setSelectedCharacter(null);
    setView('create');
  };

  const handleEditClick = (character: ICharacter) => {
    setSelectedCharacter(character);
    setView('edit');
  };

  const handleDeleteClick = async (character: ICharacter) => {
    if (!confirm(`Are you sure you want to delete ${character.firstName} ${character.lastName}?`)) {
      return;
    }

    try {
      await characterApi.delete(character._id);
      setCharacters(prev => prev.filter(c => c._id !== character._id));
      logger.info('Character deleted', { characterId: character._id });
    } catch (error) {
      logger.error('Failed to delete character', {
        error: error instanceof Error ? error.message : 'Unknown error',
        characterId: character._id,
      });
      setError('Failed to delete character. Please try again.');
    }
  };

  const handleSave = async (character: ICharacter) => {
    // Update or add the character in the list
    setCharacters(prev => {
      const existingIndex = prev.findIndex(c => c._id === character._id);
      if (existingIndex >= 0) {
        const updated = [...prev];
        updated[existingIndex] = character;
        return updated;
      }
      return [...prev, character];
    });

    // Update avatar URL if available
    if (character.avatarS3Uri) {
      try {
        const presignedResponse = await imageGenerationApi.generatePresignedViewUrl(character.avatarS3Uri);
        setCharacterAvatarUrls(prev => ({
          ...prev,
          [character._id]: presignedResponse.data.presignedUrl,
        }));
      } catch (e) {
        logger.warn('Failed to load avatar for character', { characterId: character._id });
      }
    }

    setView('list');
    setSelectedCharacter(null);
  };

  const handleCancel = () => {
    setView('list');
    setSelectedCharacter(null);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:p-0">
        {/* Backdrop */}
        <div 
          className="fixed inset-0 bg-slate-500 bg-opacity-75 transition-opacity"
          onClick={onClose}
        />

        {/* Modal */}
        <div className="relative inline-block w-full max-w-2xl p-6 my-8 text-left align-middle bg-white shadow-xl transform transition-all">
          {/* Header */}
          <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-200">
            <h2 className="text-xl font-semibold text-slate-900">
              {view === 'list' && 'Manage Characters'}
              {view === 'create' && 'Add New Character'}
              {view === 'edit' && `Edit ${selectedCharacter?.firstName || 'Character'}`}
            </h2>
            <button
              onClick={onClose}
              className="text-slate-400 hover:text-slate-600"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Content */}
          {view === 'list' && (
            <div className="space-y-4">
              {isLoading ? (
                <div className="flex justify-center py-8">
                  <LoadingSpinner />
                </div>
              ) : error ? (
                <div className="bg-red-50 border border-red-200 rounded-md p-4">
                  <p className="text-sm text-red-800">{error}</p>
                  <button
                    onClick={loadCharacters}
                    className="mt-2 text-sm text-red-600 underline"
                  >
                    Try again
                  </button>
                </div>
              ) : characters.length === 0 ? (
                <div className="text-center py-8">
                  <svg className="mx-auto h-12 w-12 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  <h3 className="mt-2 text-sm font-medium text-slate-900">No characters yet</h3>
                  <p className="mt-1 text-sm text-slate-500">
                    Add people from your life to include them in your memory illustrations.
                  </p>
                </div>
              ) : (
                <div className="space-y-2 max-h-96 overflow-y-auto">
                  {characters.map(character => (
                    <div
                      key={character._id}
                      className="flex items-center justify-between p-4 bg-slate-50 rounded-lg hover:bg-slate-100"
                    >
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-full bg-slate-200 overflow-hidden">
                          {characterAvatarUrls[character._id] ? (
                            <img
                              src={characterAvatarUrls[character._id]}
                              alt={`${character.firstName} ${character.lastName}`}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center text-slate-400">
                              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div>
                          <h4 className="text-sm font-medium text-slate-900">
                            {character.firstName} {character.lastName}
                          </h4>
                          <p className="text-xs text-slate-500">
                            {character.relationship ? `${character.relationship} • ` : ''}
                            {character.age} years old
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleEditClick(character)}
                          className="p-2 text-slate-400 hover:text-slate-600"
                          title="Edit"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                          </svg>
                        </button>
                        <button
                          onClick={() => handleDeleteClick(character)}
                          className="p-2 text-slate-400 hover:text-red-600"
                          title="Delete"
                        >
                          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Add Character Button */}
              <div className="pt-4 border-t border-slate-200">
                <button
                  onClick={handleCreateClick}
                  className="w-full inline-flex items-center justify-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700"
                >
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                  </svg>
                  Add Character
                </button>
              </div>
            </div>
          )}

          {(view === 'create' || view === 'edit') && (
            <CharacterForm
              character={selectedCharacter || undefined}
              onSave={handleSave}
              onCancel={handleCancel}
            />
          )}
        </div>
      </div>
    </div>
  );
}
