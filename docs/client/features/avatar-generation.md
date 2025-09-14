# Avatar Generation Feature

## Overview

The avatar generation feature allows users to create personalized avatars using AI-generated illustrations based on their reference photos. This feature integrates with the illustration generation service to create multiple avatar options that users can choose from.

## Workflow

### 1. Reference Image Staging
- Users upload a reference photo of themselves through the profile editing interface
- The image is validated (file type, size limits) and staged locally in the frontend
- No upload to S3 occurs at this stage

### 2. Avatar Generation
- Users click the "Create Avatar" button to initiate the process
- The reference image is uploaded to S3 with the key pattern: `subjects/{userId}.png`
- The system generates 4 different avatar options using the `generateSubjectIllustration` endpoint
- The generated avatars use the user's reference photo as input for IP-Adapter

### 3. Avatar Selection
- Users can view all 4 generated options in a grid layout
- Users can select their preferred avatar by clicking on it
- Users can regenerate new options if they're not satisfied with the current ones

### 4. Avatar Confirmation and Storage
- Users click "Confirm Selection" to save their chosen avatar
- The selected avatar is uploaded to S3 with the key pattern: `avatars/{userId}.png`
- The avatar URL is saved to the user's profile
- The avatar is used as the profile picture throughout the application
- The avatar is also used by the IP-Adapter when generating memory illustrations

## Technical Implementation

### Backend Endpoints

#### Upload Reference Image
```
POST /api/images/upload-reference
Content-Type: multipart/form-data
Body: { image: File }
```

#### Generate Subject Illustration
```
POST /api/images/subject
Body: { userId: string }
Response: { url: string }
```

### Frontend Components

#### AvatarGenerator Component
- Located at: `AutoBio/client/src/components/avatar/AvatarGenerator.tsx`
- Handles file upload, avatar generation, and selection
- Provides a clean UI for the entire avatar creation workflow

#### Integration Points
- **Profile Page**: Avatar generation is integrated into the profile editing form
- **Profile Display**: User avatars are displayed in the profile header
- **Memory Generation**: User avatars are used as IP-Adapter input for memory illustrations

### File Structure
```
AutoBio/
├── client/src/
│   ├── components/avatar/
│   │   └── AvatarGenerator.tsx
│   ├── services/api.ts (updated with avatar endpoints)
│   └── pages/Profile.tsx (updated with avatar integration)
├── server/src/
│   ├── controllers/imageController.ts (updated with upload endpoint)
│   └── routes/imageRoutes.ts (updated with upload route)
└── docs/client/features/
    └── avatar-generation.md (this file)
```

## Usage Instructions

### For Users
1. Navigate to the Profile page
2. Click "Edit Profile"
3. Scroll to the "Create Your Avatar" section
4. Upload a reference photo of yourself (staged locally)
5. Click "Create Avatar" button to generate options
6. Wait for avatar options to generate
7. Select your preferred avatar by clicking on it
8. Click "Confirm Selection" to save the avatar
9. Save your profile changes

### For Developers
1. Ensure the illustration service is running and configured
2. Verify S3 credentials and bucket permissions
3. Test the upload and generation endpoints
4. Verify the avatar is properly saved to the user profile

## Configuration

### Environment Variables
- `S3_BUCKET_NAME`: S3 bucket for storing reference images
- `S3_SUBJECT_PREFIX`: Prefix for subject images (default: "subjects/")
- `USE_ILLUSTRATION_SERVICE`: Enable/disable the illustration service
- `ILLUSTRATION_SERVICE_URL`: URL of the illustration generation service

### Dependencies
- `multer`: For handling file uploads
- `@aws-sdk/client-s3`: For S3 operations
- Illustration generation service: For creating avatar options

## Error Handling

The system handles various error scenarios:
- Invalid file types or sizes
- Upload failures
- Generation service unavailability
- Network errors
- Authentication issues

All errors are displayed to users with appropriate error messages and recovery options.

## Future Enhancements

Potential improvements for the avatar generation feature:
1. Batch generation with different styles
2. Avatar customization options
3. Integration with social media profile pictures
4. Avatar history and versioning
5. Advanced image processing and enhancement
