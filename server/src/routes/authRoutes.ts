import express from 'express';
import { register, login, getMe, updateMe } from '../controllers/authController';
import { protect } from '../utils/auth';

const router = express.Router();

// Public routes
router.post('/register', register);
router.post('/login', login);

// Protected routes
router.use(protect);
router.get('/me', getMe);
router.patch('/updateMe', updateMe);

export default router; 