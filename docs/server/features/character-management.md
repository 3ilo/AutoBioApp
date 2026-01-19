# Character Management

This document describes the character management feature, which allows users to create and manage additional people (characters) that can be included in memory illustrations.

## Overview

Characters are additional people in a user's life (family members, friends, etc.) that can be tagged in memories using @-mentions. When a memory with tagged characters is used for illustration generation, the system includes reference images for all tagged characters and constructs prompts that properly identify each person.

## Data Model

### Character Schema

```typescript
interface ICharacter {
  _id?: string;
  userId: string;           // Owner reference
  firstName: string;        // Required
  lastName: string;         // Required
  age: number;              // Current age (for de-aging calculations)
  gender?: string;          // For image generation context
  relationship?: string;    // e.g., "mother", "friend", "spouse"
  culturalBackground?: string;
  referenceImageS3Uri?: string; // Raw photo for generation
  avatarS3Uri?: string;     // Generated avatar image
  createdAt?: Date;
  updatedAt?: Date;
}
```

### S3 Storage Structure

Characters use a dedicated S3 prefix structure:

```
characters/
  {userId}/
    {characterId}/
      reference.png    # Uploaded reference photo
      avatar.png       # Generated avatar
```

## API Endpoints

All endpoints require authentication.

### CRUD Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/characters` | Create a new character |
| GET | `/api/characters` | List all characters for the authenticated user |
| GET | `/api/characters/:id` | Get a single character by ID |
| PATCH | `/api/characters/:id` | Update a character |
| DELETE | `/api/characters/:id` | Delete a character |

### Image Operations

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/characters/:id/presigned-reference-upload-url` | Get presigned URL for uploading reference image |
| POST | `/api/characters/:id/reference-image` | Confirm reference image upload and update character |
| POST | `/api/characters/:id/generate-avatar` | Generate avatar from reference image |

## Character Avatar Generation

The character avatar generation reuses the existing subject illustration flow:

1. User uploads a reference photo for the character
2. System stores the photo in S3 at `characters/{userId}/{characterId}/reference.png`
3. User triggers avatar generation via the API
4. The `IllustrationOrchestratorService.generateCharacterAvatar()` method:
   - Fetches the character's reference image from S3
   - Builds a subject-style prompt with character metadata
   - Generates an avatar using the configured image generator
   - Stores the generated avatar in S3
   - Updates the character's `avatarS3Uri` field

## Integration with Memory Tagging

When a memory contains @-mentions of characters:

1. The frontend extracts character IDs from TipTap mention nodes
2. Character IDs are stored in the memory's `taggedCharacters` array
3. During illustration generation, tagged character IDs are passed to the orchestrator
4. The orchestrator fetches reference images for all tagged characters
5. Multiple reference images are passed to OpenAI's image generation API

See [Multi-Person Illustration](./multi-person-illustration.md) for details on the illustration generation flow.

## Client Components

### CharacterManager

Main modal component for managing characters. Located at `client/src/components/characters/CharacterManager.tsx`.

Features:
- List all user's characters with avatars
- Create new characters
- Edit existing characters
- Delete characters

### CharacterForm

Form component for creating/editing characters. Located at `client/src/components/characters/CharacterForm.tsx`.

Fields:
- First name (required)
- Last name (required)
- Age (required)
- Gender (optional)
- Relationship (optional)
- Cultural background (optional)

### CharacterAvatarGenerator

Component for uploading reference photos and generating avatars. Located at `client/src/components/characters/CharacterAvatarGenerator.tsx`.

Flow:
1. User uploads a reference photo
2. Photo is uploaded to S3 via presigned URL
3. User clicks "Generate Avatar"
4. Avatar is generated and displayed
5. Character's `avatarS3Uri` is updated

## Usage in Profile Page

The "Manage Characters" button is available in the Profile page header. Clicking it opens the CharacterManager modal.

```tsx
import { CharacterManager } from '../components/characters';

// In Profile component
const [isCharacterManagerOpen, setIsCharacterManagerOpen] = useState(false);

// Button to open modal
<button onClick={() => setIsCharacterManagerOpen(true)}>
  Manage Characters
</button>

// Modal component
<CharacterManager
  isOpen={isCharacterManagerOpen}
  onClose={() => setIsCharacterManagerOpen(false)}
/>
```
