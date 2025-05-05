import express from 'express';
import { getCurrentUser, updateCurrentUser } from '../controllers/userController';
import { protect } from '../utils/auth';

const router = express.Router();

// All routes require authentication
router.use(protect);

router.get('/me', getCurrentUser);
router.patch('/me', updateCurrentUser);

export default router; 