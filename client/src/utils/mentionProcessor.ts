/**
 * Utility functions for processing and rendering character mentions in memory content
 */

import { ICharacter } from '../types/character';

/**
 * Extract first name from full name
 */
export function getFirstName(fullName: string): string {
  return fullName.split(' ')[0] || fullName;
}

/**
 * Process mention HTML to:
 * 1. Show only first name instead of full name
 * 2. Add data attributes for tooltip (full name, relationship)
 * 3. Make it clickable
 */
export function processMentions(
  html: string,
  characters: ICharacter[]
): string {
  // Create a map of character ID to character data for quick lookup
  const characterMap = new Map<string, ICharacter>();
  characters.forEach(char => {
    characterMap.set(char._id, char);
  });

  // Process each mention span
  return html.replace(
    /<span([^>]*class="[^"]*mention[^"]*"[^>]*data-id="([^"]+)"[^>]*data-label="([^"]+)"[^>]*)>([^<]+)<\/span>/g,
    (_match, attrs, characterId, fullName) => {
      const character = characterMap.get(characterId);
      const firstName = getFirstName(fullName);
      const relationship = character?.relationship || '';
      
      // Add data attributes for tooltip
      const newAttrs = attrs
        .replace(/data-label="[^"]+"/, `data-label="${fullName}"`)
        .replace(/class="([^"]*)"/, `class="$1 mention-tooltip"`)
        + ` data-full-name="${fullName}"`
        + ` data-relationship="${relationship}"`
        + ` data-character-id="${characterId}"`;
      
      return `<span${newAttrs}>${firstName}</span>`;
    }
  );
}
