import express from 'express';
import { generateImage, regenerateImage } from '../controllers/imageController';
import { protect } from '../utils/auth';

const router = express.Router();

router.use(protect);

router.post('/generate', generateImage);
router.post('/regenerate', regenerateImage);

export default router; 