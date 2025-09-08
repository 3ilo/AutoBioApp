import express from 'express';
import { 
  generateImage, 
  regenerateImage, 
  generateSubjectIllustration, 
  generatePresignedUploadUrl,
  generatePresignedAvatarUploadUrl,
  generatePresignedViewUrl
} from '../controllers/imageController';
import { protect } from '../utils/auth';

const router = express.Router();

router.use(protect);

router.post('/generate', generateImage);
// router.post('/regenerate', regenerateImage);
router.post('/subject', generateSubjectIllustration);
router.post('/presigned-upload-url', generatePresignedUploadUrl);
router.post('/presigned-avatar-upload-url', generatePresignedAvatarUploadUrl);
router.post('/presigned-view-url', generatePresignedViewUrl);

export default router; 