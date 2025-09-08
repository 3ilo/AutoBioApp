import express from 'express';
import { generateImage, regenerateImage, generateSubjectIllustration } from '../controllers/imageController';
import { protect } from '../utils/auth';

const router = express.Router();

router.use(protect);

router.post('/generate', generateImage);
// router.post('/regenerate', regenerateImage);
router.post('/subject', generateSubjectIllustration);

export default router; 