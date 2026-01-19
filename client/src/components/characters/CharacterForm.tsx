import { useState } from 'react';
import { ICharacter, CreateCharacterInput, UpdateCharacterInput } from '../../types/character';
import { characterApi } from '../../services/api';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { CharacterAvatarGenerator } from './CharacterAvatarGenerator';
import logger from '../../utils/logger';

interface CharacterFormProps {
  character?: ICharacter;
  onSave: (character: ICharacter) => void;
  onCancel: () => void;
}

export function CharacterForm({ character, onSave, onCancel }: CharacterFormProps) {
  const isEditing = !!character;
  
  const [formData, setFormData] = useState<CreateCharacterInput>({
    firstName: character?.firstName || '',
    lastName: character?.lastName || '',
    age: character?.age || 0,
    gender: character?.gender || '',
    relationship: character?.relationship || '',
    culturalBackground: character?.culturalBackground || '',
  });
  
  const [savedCharacter, setSavedCharacter] = useState<ICharacter | null>(character || null);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAvatarSection, setShowAvatarSection] = useState(isEditing);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'age' ? parseInt(value) || 0 : value,
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      if (!formData.firstName || !formData.lastName || formData.age <= 0) {
        setError('First name, last name, and a valid age are required');
        setIsSaving(false);
        return;
      }

      let result: ICharacter;
      
      if (isEditing && character) {
        const updateData: UpdateCharacterInput = {
          firstName: formData.firstName,
          lastName: formData.lastName,
          age: formData.age,
          gender: formData.gender || undefined,
          relationship: formData.relationship || undefined,
          culturalBackground: formData.culturalBackground || undefined,
        };
        const response = await characterApi.update(character._id, updateData);
        result = response.data.character;
        logger.info('Character updated', { characterId: character._id });
      } else {
        const response = await characterApi.create(formData);
        result = response.data.character;
        logger.info('Character created', { characterId: result._id });
      }

      setSavedCharacter(result);
      
      // If creating a new character, show avatar section after save
      if (!isEditing) {
        setShowAvatarSection(true);
      } else {
        onSave(result);
      }
    } catch (error) {
      logger.error('Failed to save character', {
        error: error instanceof Error ? error.message : 'Unknown error',
      });
      setError('Failed to save character. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleAvatarGenerated = (updatedCharacter: ICharacter) => {
    setSavedCharacter(updatedCharacter);
  };

  const handleFinish = () => {
    if (savedCharacter) {
      onSave(savedCharacter);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="firstName" className="block text-sm font-medium text-slate-700 mb-1">
              First Name *
            </label>
            <input
              type="text"
              id="firstName"
              name="firstName"
              value={formData.firstName}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              required
              disabled={showAvatarSection && !isEditing}
            />
          </div>
          <div>
            <label htmlFor="lastName" className="block text-sm font-medium text-slate-700 mb-1">
              Last Name *
            </label>
            <input
              type="text"
              id="lastName"
              name="lastName"
              value={formData.lastName}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              required
              disabled={showAvatarSection && !isEditing}
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="age" className="block text-sm font-medium text-slate-700 mb-1">
              Age *
            </label>
            <input
              type="number"
              id="age"
              name="age"
              value={formData.age || ''}
              onChange={handleInputChange}
              min="0"
              max="150"
              className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              required
              disabled={showAvatarSection && !isEditing}
            />
          </div>
          <div>
            <label htmlFor="gender" className="block text-sm font-medium text-slate-700 mb-1">
              Gender
            </label>
            <select
              id="gender"
              name="gender"
              value={formData.gender}
              onChange={handleInputChange}
              className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              disabled={showAvatarSection && !isEditing}
            >
              <option value="">Select gender</option>
              <option value="male">Male</option>
              <option value="female">Female</option>
              <option value="non-binary">Non-binary</option>
              <option value="other">Other</option>
            </select>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label htmlFor="relationship" className="block text-sm font-medium text-slate-700 mb-1">
              Relationship
            </label>
            <input
              type="text"
              id="relationship"
              name="relationship"
              value={formData.relationship}
              onChange={handleInputChange}
              placeholder="e.g., mother, friend, spouse"
              className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              disabled={showAvatarSection && !isEditing}
            />
          </div>
          <div>
            <label htmlFor="culturalBackground" className="block text-sm font-medium text-slate-700 mb-1">
              Cultural Background
            </label>
            <input
              type="text"
              id="culturalBackground"
              name="culturalBackground"
              value={formData.culturalBackground}
              onChange={handleInputChange}
              placeholder="e.g., American, Chinese"
              className="w-full px-3 py-2 border border-slate-300 rounded-md shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
              disabled={showAvatarSection && !isEditing}
            />
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 rounded-md p-3">
            <p className="text-sm text-red-800">{error}</p>
          </div>
        )}

        {!showAvatarSection && (
          <div className="flex justify-end gap-3 pt-4">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-md hover:bg-slate-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSaving}
              className="inline-flex items-center px-4 py-2 text-sm font-medium text-white bg-indigo-600 border border-transparent rounded-md hover:bg-indigo-700 disabled:opacity-50"
            >
              {isSaving && <LoadingSpinner />}
              <span className={isSaving ? 'ml-2' : ''}>
                {isEditing ? 'Save Changes' : 'Create Character'}
              </span>
            </button>
          </div>
        )}
      </form>

      {/* Avatar Generation Section - shown after character is created */}
      {showAvatarSection && savedCharacter && (
        <div className="border-t border-slate-200 pt-6">
          <CharacterAvatarGenerator
            character={savedCharacter}
            onAvatarGenerated={handleAvatarGenerated}
          />
          
          <div className="flex justify-end gap-3 pt-6 mt-6 border-t border-slate-200">
            <button
              type="button"
              onClick={handleFinish}
              className="px-4 py-2 text-sm font-medium text-white bg-green-600 border border-transparent rounded-md hover:bg-green-700"
            >
              {savedCharacter.avatarS3Uri ? 'Done' : 'Skip Avatar & Finish'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
