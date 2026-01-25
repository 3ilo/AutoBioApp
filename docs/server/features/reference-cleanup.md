# Reference Image Cleanup

## Overview

The system automatically deletes user-uploaded reference images after avatar generation is complete. This ensures:
1. Privacy - we don't permanently store raw user photos
2. Storage efficiency - only keep the generated outputs
3. Fresh uploads - users must upload new references when regenerating

## How It Works

### Storage Strategy

**Temporary (Deleted After Generation):**
- `reference-0.png`, `reference-1.png`, etc. - User uploads
- Stored only during avatar generation workflow
- **Automatically deleted** after successful generation

**Permanent (Kept Forever):**
- `avatar.png` - Generated character avatar
- `multi-angle.png` - Generated 3-angle array
- Used as references for memory illustrations

### Avatar Generation Flow

1. **User uploads** 1-5 reference photos → `reference-0.png`, `reference-1.png`, etc.
2. **System generates** avatar and multi-angle outputs
3. **System saves** generated outputs: `avatar.png`, `multi-angle.png`
4. **System deletes** uploaded references: `reference-0.png`, `reference-1.png`, etc.
5. **Database updated** to clear `referenceImageS3Uri` and `referenceImagesS3Uris`

### Memory Illustration Flow

1. **User creates memory** with tagged characters
2. **System fetches** generated avatar or multi-angle (based on feature flag)
3. **Uses generated output** as reference for new memory illustration
4. Generated outputs provide **consistent, high-quality** references

### Regeneration Flow

1. **User wants to regenerate** avatar
2. **User uploads NEW** reference photos (old ones are gone)
3. **System generates** new avatar and multi-angle
4. **System deletes** new uploaded references
5. **Overwrites old** generated outputs

## Feature Flag Behavior

### `useMultiAngleReferences: false` (Default)

**Avatar Generation:**
- Creates single `avatar.png` only
- No 3-angle array generation
- 1 image generation = faster, cheaper

**For memory illustrations:**
- Fetches `avatar.png` (single generated avatar)
- Faster, single reference

### `useMultiAngleReferences: true`

**Avatar Generation:**
- Creates 3 separate images (left, front, right profiles)
- Stitches them into `multi-angle.png`
- Extracts front view as `avatar.png`
- 3 image generations = slower, more expensive

**For memory illustrations:**
- Fetches `multi-angle.png` (3-angle generated array)
- Better consistency, more context

## S3 Storage Structure

### Character Images

```
characters/{userId}/{characterId}/
  ├── reference-0.png        ❌ TEMPORARY - deleted after generation
  ├── reference-1.png        ❌ TEMPORARY - deleted after generation  
  ├── avatar.png             ✅ PERMANENT - used for memories
  └── multi-angle.png        ✅ PERMANENT - used for memories (if flag enabled)
```

### Database Fields

```typescript
// Cleared after generation
referenceImageS3Uri: undefined
referenceImagesS3Uris: []

// Permanent - used for memories
avatarS3Uri: "s3://bucket/characters/.../avatar.png"
multiAngleReferenceS3Uri: "s3://bucket/characters/.../multi-angle.png"
```

## Implementation Details

### Deletion Method

```typescript
private async deleteCharacterUploadedReferences(
  userId: string, 
  characterId: string, 
  character: ICharacterDocument
): Promise<void>
```

**Called after:**
- `generateCharacterAvatar()` - Single avatar generation
- `generateMultiAngleAvatar()` - Multi-angle avatar generation

**Behavior:**
- Collects all uploaded reference keys
- Deletes from S3 using batch delete
- Clears database fields
- Logs errors but doesn't fail generation if cleanup fails

### Error Handling

If deletion fails:
- ✅ Avatar generation still succeeds
- ❌ Uploaded references remain in S3 (orphaned)
- ⚠️ Error logged for monitoring

**Rationale:** Better to have orphaned uploads than fail avatar generation

## Debugging

Enable debug logging to see cleanup:

```bash
LOG_LEVEL=debug npm run dev
```

**Look for:**
```
[info] Deleting uploaded reference images after avatar generation
  userId: "user123"
  characterId: "char456"
  count: 3
  keys: ["characters/.../reference-0.png", ...]

[info] Successfully deleted uploaded reference images
  count: 3
```

## Testing

### Test Cleanup After Generation

1. Upload 3 reference images to a character
2. Generate avatar
3. Check S3 - `reference-*.png` should be gone
4. Check database - `referenceImagesS3Uris` should be empty
5. Create memory with character - should use `avatar.png`

### Test Regeneration Requires New Uploads

1. Generate avatar for character
2. Try to regenerate without uploading new references
3. Should fail with "No reference images uploaded"
4. Upload new references
5. Generate successfully
6. New references deleted, new avatar saved

## Benefits

### Privacy ✅
- User photos not permanently stored
- Only AI-generated outputs kept
- Reduces liability for raw photo storage

### Storage Efficiency ✅
- Don't duplicate references and generated outputs
- Keep only what's used (generated avatars)
- Lower S3 costs

### Fresh References ✅
- Users must upload new photos to regenerate
- Ensures intentional avatar updates
- No accidental re-use of old photos

## Trade-offs

### Can't Regenerate Without New Upload
- ❌ User must upload references again to regenerate
- ✅ Forces intentional updates

### Orphaned Files if Cleanup Fails
- ❌ Failed deletion leaves orphaned files
- ✅ Doesn't block avatar generation
- ⚠️ Monitor errors, run cleanup jobs if needed

## Related

- [Feature Flags](../architecture/feature-flags.md) - `useMultiAngleReferences` flag
- [Multi-Person Illustration](./multi-person-illustration.md) - How character references are used
- [Character Avatar Generation](../../client/features/character-tagging.md) - Frontend flow
