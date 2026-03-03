import express from 'express';
import multer from 'multer';
import { AppError } from '../utils/errorHandler';
import { transcribe } from '../controllers/transcribeController';
import { protect } from '../utils/auth';

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const allowed = ['audio/webm', 'audio/webm;codecs=opus', 'audio/mp4', 'audio/mpeg', 'audio/wav', 'audio/ogg', 'audio/m4a'];
    const isAllowed = allowed.includes(file.mimetype) || file.mimetype.startsWith('audio/');
    if (isAllowed) {
      cb(null, true);
    } else {
      cb(new AppError('Invalid file type. Only audio files (webm, mp4, mp3, wav, ogg) are allowed.', 400));
    }
  },
});

router.use(protect);
router.post('/', upload.single('audio'), transcribe);

export default router;
