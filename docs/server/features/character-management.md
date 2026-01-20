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
  referenceImageS3Uri?: string; // Legacy: single raw photo for generation
  referenceImagesS3Uris?: string[]; // Multi-angle: array of reference photos (up to 5)
  multiAngleReferenceS3Uri?: string; // Generated 3-angle array (left/front/right profiles)
  avatarS3Uri?: string;     // Generated avatar image (front-facing extracted from multi-angle)
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
      reference.png        # Legacy: single uploaded reference photo
      reference-0.png      # Multi-angle: first reference photo
      reference-1.png      # Multi-angle: second reference photo
      reference-2.png      # Multi-angle: third reference photo
      reference-3.png      # Multi-angle: fourth reference photo
      reference-4.png      # Multi-angle: fifth reference photo
      multi-angle.png      # Generated 3-angle array (left/front/right)
      avatar.png           # Generated avatar (front-facing from multi-angle)
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
| POST | `/api/characters/:id/presigned-reference-upload-url` | Get presigned URL for uploading reference image (supports optional `index` for multi-image) |
| POST | `/api/characters/:id/reference-image` | Confirm reference image upload and update character (supports optional `index`) |
| POST | `/api/characters/:id/generate-avatar` | Generate avatar from single reference image (legacy) |
| POST | `/api/characters/:id/generate-multi-angle-avatar` | Generate 3-angle avatar from multiple reference images |

## Character Avatar Generation

### Legacy Single-Image Flow

The traditional character avatar generation uses a single reference photo:

1. User uploads a reference photo for the character
2. System stores the photo in S3 at `characters/{userId}/{characterId}/reference.png`
3. User triggers avatar generation via the API
4. The `IllustrationOrchestratorService.generateCharacterAvatar()` method:
   - Fetches the character's reference image from S3
   - Builds a subject-style prompt with character metadata
   - Generates an avatar using the configured image generator
   - Stores the generated avatar in S3
   - Updates the character's `avatarS3Uri` field

### Multi-Angle Avatar Flow

For improved subject fidelity, users can upload multiple reference images from different angles:

1. **Upload Phase**:
   - User uploads 1-5 reference photos from different angles (recommended: front, left profile, right profile, etc.)
   - Each image is uploaded to S3 with an index: `reference-0.png`, `reference-1.png`, etc.
   - Images are stored in `character.referenceImagesS3Uris` array

2. **Generation Phase**:
   - User triggers multi-angle avatar generation
   - System fetches all uploaded reference images from S3
   - The `IllustrationOrchestratorService.generateMultiAngleAvatar()` method:
     a. **Input Stitching**: Multiple reference images are stitched into a grid (using existing `stitchImages()` utility)
     b. **Prompt Building**: Uses `buildMultiAngleSubjectPrompt()` which instructs the model to generate a 3-panel horizontal array
     c. **3-Angle Generation**: OpenAI generates a single image with three panels:
        - Left panel: Left profile (3/4 view facing left)
        - Center panel: Front-facing portrait
        - Right panel: Right profile (3/4 view facing right)
     d. **Storage**: The 3-angle array is stored at `characters/{userId}/{characterId}/multi-angle.png`
     e. **Avatar Extraction**: The center panel is extracted using `extractCenterPanel()` and stored as `avatar.png`
     f. **Database Update**: Both URIs are saved to the character:
        - `multiAngleReferenceS3Uri`: The full 3-angle array
        - `avatarS3Uri`: The extracted front-facing avatar

3. **Usage in Illustrations**:
   - When generating memory illustrations with tagged characters, the system prioritizes multi-angle references
   - `fetchCharacterReferenceImage()` checks for `multiAngleReferenceS3Uri` first, falling back to single reference
   - Multi-angle references provide better fidelity across different viewing angles in illustrations
   - The prompt builder uses `buildMultiAngleReferencePrompt()` to help the model understand the 3-panel layout

### Configuration

- `MAX_CHARACTER_REFERENCE_IMAGES`: Maximum number of reference images per character (default: 5)
- Environment variable: `MAX_CHARACTER_REFERENCE_IMAGES`

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

Component for uploading reference photos and generating multi-angle avatars. Located at `client/src/components/characters/CharacterAvatarGenerator.tsx`.

Features:
- Multi-file upload (up to 5 images)
- Thumbnail preview of all uploaded images
- Remove individual images before generation
- Displays both the 3-angle array and extracted avatar

Flow:
1. User uploads 1-5 reference photos from different angles
2. Each photo is uploaded to S3 via indexed presigned URLs
3. User clicks "Generate Multi-Angle Avatar"
4. System generates a 3-angle array (left profile, front, right profile)
5. Front-facing image is automatically extracted as the avatar
6. Both images are displayed to the user for confirmation
7. Character's `multiAngleReferenceS3Uri` and `avatarS3Uri` are updated

Display:
- **3-Angle Reference**: Full horizontal 3-panel array showing left profile, front, and right profile
- **Avatar**: Extracted front-facing image used in character displays and memory illustrations

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
