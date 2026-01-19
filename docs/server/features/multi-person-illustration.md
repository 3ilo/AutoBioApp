# Multi-Person Illustration

This document describes the multi-person illustration feature, which enables generating illustrations that include multiple people from reference images.

## Overview

When a user tags characters in their memory using @-mentions, the illustration generation system:

1. Collects reference images for all tagged characters plus the user
2. **Stitches multiple images into a single grid image** (to work around OpenAI's single-image limitation)
3. Constructs prompts that identify each person by their grid position
4. Applies age-aware de-aging when the memory date is in the past
5. Sends the combined grid image with position-aware prompts to OpenAI

## Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────┐
│   Client        │────▶│  Image Controller    │────▶│  Orchestrator   │
│  (Contribute)   │     │  (imageController)   │     │  Service        │
└─────────────────┘     └──────────────────────┘     └────────┬────────┘
                                                              │
                        ┌─────────────────────────────────────┼─────────────────┐
                        │                                     │                 │
                        ▼                                     ▼                 ▼
                ┌───────────────┐                     ┌───────────────┐ ┌───────────────┐
                │  S3 Client    │                     │ Prompt Builder│ │ OpenAI Image  │
                │  (fetch refs) │                     │ (multi-subj.) │ │ Generator     │
                └───────────────┘                     └───────────────┘ └───────────────┘
```

## Flow

### 1. Client: Extract Tagged Characters

When generating an image, the Contribute page extracts tagged character IDs:

```typescript
const editorJson = editor.getJSON();
const taggedChars = extractTaggedCharacters(editorJson);
const taggedCharacterIds = taggedChars.map(tc => tc.characterId);

await imageGenerationApi.generate({
  title,
  content: editor.getText(),
  date: new Date(date),
  userId: user?._id,
  taggedCharacterIds,
});
```

### 2. Controller: Pass to Orchestrator

The image controller passes `taggedCharacterIds` in the options:

```typescript
const openAIOptions: OpenAIMemoryIllustrationOptions = {
  provider: 'openai',
  memoryTitle: title,
  memoryContent: content,
  memoryDate: date,
  taggedCharacterIds: taggedCharacterIds,
  // ... other options
};
```

### 3. Orchestrator: Fetch Reference Images

The `IllustrationOrchestratorService` fetches reference images:

```typescript
// Always include user's reference image first (highest fidelity)
const userReferenceImage = await this.fetchReferenceImage(userId);
referenceImagesBase64.push(userReferenceImage);

// Fetch tagged character reference images
const characterData = await this.fetchCharacterReferenceImages(userId, taggedCharacterIds);
for (const { base64 } of characterData) {
  referenceImagesBase64.push(base64);
}
```

### 4. Orchestrator: Stitch Images into Grid

If multiple images are collected, they're stitched into a single grid:

```typescript
// Stitch multiple reference images into a grid
const stitchResult = await stitchImages(referenceImagesBase64);
finalReferenceImage = stitchResult.combinedImageBase64;

// Build grid layout description
const gridDescription = buildGridLayoutDescription(stitchResult.layout, peopleNames);
// Example output: "The reference image is a 2x1 grid containing 2 people:
//                  - position 1: John Smith
//                  - position 2: Jane Doe"
```

Grid layouts are optimized for readability:
- **2 people**: 2×1 grid (horizontal)
- **3 people**: 3×1 grid (horizontal)
- **4 people**: 2×2 grid
- **5-6 people**: 3×2 grid
- **7-9 people**: 3×3 grid

### 5. Orchestrator: Build Grid-Based Multi-Subject Prompt

The orchestrator uses the **prompt builder** with template-based prompt generation:

```typescript
// Prepare subject data with age-aware de-aging
const subjects: MultiSubjectData[] = [
  {
    name: 'John Smith',
    isPrimary: true,
  },
  {
    name: 'Jane Doe',
    relationship: 'mother',
    deAgingInstruction: 'depict as approximately 45 years old (10 years younger than current)',
  },
];

// Use prompt builder with template
const promptInput: MultiSubjectGridPromptInput = {
  gridDescription,
  subjects,
};

const multiSubjectPrompt = this.promptBuilder.buildMultiSubjectGridPrompt(promptInput);
```

This generates a structured prompt from the template (`multi-subject-grid-v1.txt`):

```
[MULTIPLE SUBJECTS - GRID REFERENCE]
The reference image is a 2x1 grid containing 2 people:
- position 1: John Smith
- position 2: Jane Doe

Subject details:
- John Smith (primary subject)
- Jane Doe (mother) - depict as approximately 45 years old (10 years younger than current)

IMPORTANT: Use the grid positions to identify each person and accurately preserve 
their facial features and identity in the illustrated scene.
```

**Template Versioning**: The prompt template supports versioning (e.g., `multi-subject-grid-v1.txt`, `multi-subject-grid-v2.txt`). You can control which version is used via the `MULTI_SUBJECT_GRID_VERSION` environment variable.

### 6. OpenAI: Generate with Combined Grid Image

The OpenAI image generator receives a single stitched image:

```typescript
// Single combined grid image is sent
const imageBuffer = Buffer.from(combinedImageBase64, 'base64');
formData.append('image', imageBuffer, {
  filename: 'reference.png',
  contentType: 'image/png',
});
```

## Age-Aware De-Aging

When the memory date is in the past, the system calculates each person's age at that time:

```typescript
private calculateAgeAtDate(currentAge: number, memoryDate: Date): number {
  const now = new Date();
  const yearsAgo = (now.getTime() - memoryDate.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
  return Math.max(0, Math.round(currentAge - yearsAgo));
}

private getDeAgingInstruction(currentAge: number, ageAtMemory: number): string | null {
  const ageDifference = currentAge - ageAtMemory;
  
  // Only provide de-aging instruction if more than 5 years difference
  if (ageDifference > 5) {
    return `depict as approximately ${ageAtMemory} years old (${ageDifference} years younger than current)`;
  }
  
  return null;
}
```

The de-aging instructions are included in the prompt so the model knows to render younger versions of the people.

## OpenAI API Notes

OpenAI's `gpt-image-1.5` model supports multiple reference images:

- The `image` parameter can be passed multiple times in the form data
- The first image has the highest fidelity for feature preservation
- Each image should be referenced by its position in the prompt

Best practices:
- Place the primary subject (user) as the first reference image
- Use `input_fidelity: high` for better face/feature preservation (if supported)
- Be explicit in the prompt about which reference image corresponds to which person

## Memory Model Integration

The Memory model stores tagged characters:

```typescript
interface IMemory {
  // ... other fields
  taggedCharacters?: ITaggedCharacter[];
}

interface ITaggedCharacter {
  characterId: string;
  displayName: string;  // "FirstName LastName"
}
```

## Client @-Mention System

The TipTap Mention extension enables tagging characters:

```typescript
import Mention from '@tiptap/extension-mention';

Mention.configure({
  HTMLAttributes: {
    class: 'mention bg-indigo-100 text-indigo-700 px-1 rounded font-medium',
  },
  suggestion: {
    items: ({ query }) => characters.filter(c => 
      `${c.firstName} ${c.lastName}`.toLowerCase().includes(query.toLowerCase())
    ),
    // ... render configuration
  },
});
```

Mentions appear in the editor as styled spans with the character's name prefixed by @.

## Limitations

1. **Grid resolution trade-off**: When multiple people are included, each person's image is smaller in the grid (e.g., 2 people = 512×1024 each in a 1024×1024 grid)
2. **Reference image requirement**: All tagged characters must have a reference image uploaded
3. **Image count**: Recommended maximum of 9 people (3×3 grid) for best quality
4. **Age calculation accuracy**: Uses simple year-based calculation from current age
5. **SDXL support**: Currently only OpenAI provider supports the grid-based multi-person structure

## Technical Implementation

The system uses image stitching to work around OpenAI's single-image limitation:

1. **Collects** all reference images (user + tagged characters)
2. **Resizes** each image to fit grid dimensions
3. **Composites** images onto a blank canvas in grid layout
4. **Sends** single combined image to OpenAI
5. **Prompts** include grid position mappings

This approach preserves facial features for all subjects while respecting the API constraint.

## Image Stitching Details

The `imageStitcher` utility (`server/src/utils/imageStitcher.ts`) uses the `sharp` library to:
- Resize images proportionally to grid cells
- Maintain aspect ratios with `fit: 'cover'`
- Composite onto a 1024×1024 canvas
- Output as PNG with light gray background for empty cells

## Template-Based Prompt System

The multi-subject grid prompt uses the template-based prompt building system:

### Template File

Location: `server/src/services/promptBuilders/templates/multi-subject-grid-v1.txt`

```handlebars
[MULTIPLE SUBJECTS - GRID REFERENCE]
{{gridDescription}}

Subject details:
{{#each subjects}}
- {{name}}{{#if relationship}} ({{relationship}}){{/if}}{{#if isPrimary}} (primary subject){{/if}}{{#if deAgingInstruction}} - {{deAgingInstruction}}{{/if}}
{{/each}}

IMPORTANT: Use the grid positions to identify each person and accurately preserve their facial features and identity in the illustrated scene.
```

### Prompt Builder Interface

```typescript
interface MultiSubjectData {
  name: string;
  relationship?: string;
  isPrimary?: boolean;
  deAgingInstruction?: string;
}

interface MultiSubjectGridPromptInput {
  gridDescription: string;
  subjects: MultiSubjectData[];
}

interface IPromptBuilder {
  // ... other methods
  buildMultiSubjectGridPrompt(input: MultiSubjectGridPromptInput): string;
}
```

### Version Control

Template versions can be controlled via environment variables:

```bash
# Use version 2 of the multi-subject grid template
MULTI_SUBJECT_GRID_VERSION=v2

# Other template versions
SUBJECT_VERSION=v1
FORMAT_VERSION=v1
```

### Implementation

All prompt builders (`OpenAIPromptBuilder`, `SDXLPromptBuilder`, `StubPromptBuilder`) implement this interface:

- **OpenAI**: Uses Handlebars templates from template files
- **SDXL**: Implements similar formatting with string building
- **Stub**: Returns mock prompts for testing

This ensures consistent prompt structure across all image generation providers and allows for easy prompt evolution through versioning.
