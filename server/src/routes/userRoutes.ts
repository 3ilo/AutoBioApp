import { Router } from 'express';
import { getCurrentUser, updateCurrentUser, followUser, unfollowUser, getFollowers, getFollowing } from '../controllers/userController';
import { protect } from '../utils/auth';

const router = Router();

// All routes require authentication
router.use(protect);

// Get current user profile
router.get('/me', getCurrentUser);

// Update current user profile
router.patch('/me', updateCurrentUser);

// Follow a user
router.post('/:userId/follow', followUser);

// Unfollow a user
router.delete('/:userId/follow', unfollowUser);

// Get user's followers
router.get('/:userId/followers', getFollowers);

// Get user's following list
router.get('/:userId/following', getFollowing);

export default router; 