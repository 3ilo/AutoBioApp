import express from 'express';
import { 
  generateImage, 
  generateSubjectIllustration, 
  generatePresignedUploadUrl,
  generatePresignedAvatarUploadUrl,
  generatePresignedViewUrl,
  updateUserReferenceImage,
  generateMultiAngleUserAvatar
} from '../controllers/imageController';
import { protect } from '../utils/auth';

const router = express.Router();

router.use(protect);

router.post('/generate', generateImage);
router.post('/subject', generateSubjectIllustration);
router.post('/multi-angle-user-avatar', generateMultiAngleUserAvatar);
router.post('/presigned-upload-url', generatePresignedUploadUrl);
router.post('/presigned-avatar-upload-url', generatePresignedAvatarUploadUrl);
router.post('/presigned-view-url', generatePresignedViewUrl);
router.post('/update-user-reference', updateUserReferenceImage);

export default router; 