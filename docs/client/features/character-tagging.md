# Character Tagging

This document describes the character tagging feature in the client, which enables users to @-mention characters in their memories for multi-person illustration generation.

## Overview

Character tagging allows users to mention people (characters) in their memory text using the @ symbol. These mentions are:

1. Displayed with bold indigo text (no background highlighting or @ prefix)
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
        class: 'mention',
      },
      renderLabel({ node }) {
        // Display without @ prefix in editor
        return node.attrs.label;
      },
      renderText({ node }) {
        // Display without @ prefix in plain text
        return node.attrs.label;
      },
      renderHTML({ node }) {
        // Customize HTML output to exclude @ symbol
        return [
          'span',
          {
            class: 'mention',
            'data-type': 'mention',
            'data-id': node.attrs.id,
            'data-label': node.attrs.label,
          },
          node.attrs.label, // Just the name, no @
        ];
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
- Indigo text color (`#4f46e5` / indigo-600)
- Bold font weight (`font-bold`)
- No background or highlighting
- No @ prefix in the display

```css
.mention {
  font-weight: 700;
  color: #4f46e5; /* indigo-600 */
}
```

The configuration uses three render functions to remove the @ prefix:
- `renderLabel`: Controls how the mention displays in the editor
- `renderText`: Controls how the mention appears in plain text extraction
- `renderHTML`: Controls the HTML structure saved to the database

Additionally, both `MemoryCard` and `Memory` components clean up @ symbols from existing saved content using a regex replacement:

```typescript
function cleanMentionSymbols(html: string): string {
  return html.replace(
    /(<span[^>]*class="[^"]*mention[^"]*"[^>]*>)@([^<]+)(<\/span>)/g,
    '$1$2$3'
  );
}
```

This ensures mentions appear as just the character's name in bold indigo text, providing a clean and distinctive tagging experience that stands out in both the editor and rendered memory cards, regardless of when the memory was created.

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
