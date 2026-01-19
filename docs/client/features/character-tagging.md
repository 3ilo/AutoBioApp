# Character Tagging

This document describes the character tagging feature in the client, which enables users to @-mention characters in their memories for multi-person illustration generation.

## Overview

Character tagging allows users to mention people (characters) in their memory text using the @ symbol. These mentions are:

1. Highlighted in the editor with a distinctive style
2. Autocompleted from the user's character list
3. Stored with the memory for use during illustration generation
4. Used to include multiple people in generated illustrations

## TipTap Mention Extension

The feature uses TipTap's Mention extension configured with a custom suggestion component.

### Setup in Contribute Page

```typescript
import Mention from '@tiptap/extension-mention';
import { createMentionSuggestionConfig } from '../components/editor/mentionSuggestionConfig';

// Create config with available characters
const mentionSuggestionConfig = useMemo(
  () => createMentionSuggestionConfig({ characters }),
  [characters]
);

// Add to editor extensions
const editor = useEditor({
  extensions: [
    // ... other extensions
    Mention.configure({
      HTMLAttributes: {
        class: 'mention bg-indigo-100 text-indigo-700 px-1 rounded font-medium',
      },
      suggestion: mentionSuggestionConfig,
    }),
  ],
});
```

### Suggestion Configuration

The suggestion config handles filtering and rendering:

```typescript
// mentionSuggestionConfig.ts
export function createMentionSuggestionConfig(options: { characters: ICharacter[] }) {
  return {
    items: ({ query }) => {
      return options.characters
        .filter(character => {
          const fullName = `${character.firstName} ${character.lastName}`.toLowerCase();
          return fullName.includes(query.toLowerCase());
        })
        .slice(0, 5);
    },
    render: () => ({
      onStart, onUpdate, onKeyDown, onExit
    }),
  };
}
```

### Suggestion Component

The `MentionSuggestion` component renders the autocomplete dropdown:

```typescript
// MentionSuggestion.tsx
export const MentionSuggestion = forwardRef(({ items, command }, ref) => {
  // Keyboard navigation support
  const [selectedIndex, setSelectedIndex] = useState(0);
  
  // Render character list with avatars
  return (
    <div className="bg-white border shadow-lg">
      {items.map((item, index) => (
        <button onClick={() => selectItem(index)}>
          {item.firstName} {item.lastName}
        </button>
      ))}
    </div>
  );
});
```

## Extracting Tagged Characters

When saving or generating images, tagged characters are extracted from the editor content:

```typescript
const extractTaggedCharacters = (content: JSONContent): ITaggedCharacter[] => {
  const mentions: ITaggedCharacter[] = [];
  
  const traverse = (node: JSONContent) => {
    if (node.type === 'mention' && node.attrs?.id && node.attrs?.label) {
      if (!mentions.some(m => m.characterId === node.attrs.id)) {
        mentions.push({
          characterId: node.attrs.id,
          displayName: node.attrs.label,
        });
      }
    }
    node.content?.forEach(traverse);
  };
  
  traverse(content);
  return mentions;
};
```

## Usage

### Typing a Mention

1. User types `@` in the editor
2. Autocomplete dropdown appears with character suggestions
3. User can:
   - Continue typing to filter
   - Use arrow keys to navigate
   - Press Enter to select
   - Click on a character
4. Selected character appears as a styled mention

### Visual Styling

Mentions appear with:
- Indigo background (`bg-indigo-100`)
- Indigo text (`text-indigo-700`)
- Rounded corners
- Font weight medium

```css
.mention {
  background-color: #e0e7ff;
  color: #4338ca;
  padding: 0 0.25rem;
  border-radius: 0.25rem;
  font-weight: 500;
}
```

## Data Flow

```
User types @          Character selected         Memory saved
      │                      │                        │
      ▼                      ▼                        ▼
┌─────────────┐      ┌─────────────┐         ┌─────────────────┐
│ Suggestion  │─────▶│ Mention     │────────▶│ taggedCharacters│
│ Dropdown    │      │ Node        │         │ in Memory       │
└─────────────┘      └─────────────┘         └─────────────────┘
```

## Image Generation

When generating illustrations:

1. Extract character IDs from editor content
2. Pass `taggedCharacterIds` to the API
3. Server fetches reference images for each character
4. Multiple images are sent to OpenAI
5. Generated illustration includes all people

```typescript
const editorJson = editor.getJSON();
const taggedChars = extractTaggedCharacters(editorJson);

await imageGenerationApi.generate({
  title,
  content: editor.getText(),
  date: new Date(date),
  userId: user?._id,
  taggedCharacterIds: taggedChars.map(tc => tc.characterId),
});
```

## Dependencies

- `@tiptap/extension-mention` - TipTap mention extension
- `@tiptap/suggestion` - Suggestion handling utilities  
- `tippy.js` - Popup positioning for the dropdown

## Related Documentation

- [Character Management](../../server/features/character-management.md) - Server-side character API
- [Multi-Person Illustration](../../server/features/multi-person-illustration.md) - Illustration generation flow
