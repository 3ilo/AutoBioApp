import express from 'express';
import {
  trainLoRA,
  getMyLoRAs,
  getLoRAById,
} from '../controllers/loraController';
import { protect } from '../utils/auth';

const router = express.Router();

router.use(protect);

router.post('/train', trainLoRA);
router.get('/', getMyLoRAs);
router.get('/:loraId', getLoRAById);

export default router;

