import express from 'express';
import { generatePresignedTranscriptionUrl, transcribeFromS3 } from '../controllers/transcribeController';
import { protect } from '../utils/auth';

const router = express.Router();

router.use(protect);
router.post('/presigned-url', generatePresignedTranscriptionUrl);
router.post('/process', transcribeFromS3);

export default router;
