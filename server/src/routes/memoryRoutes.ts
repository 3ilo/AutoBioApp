import express from 'express';
import {
  createMemory,
  getAllMemories,
  getPublicMemories,
  getMemory,
  updateMemory,
  deleteMemory,
  likeMemory,
  unlikeMemory,
  addComment,
  deleteComment,
  getFeed,
} from '../controllers/memoryController';
import { protect } from '../utils/auth';

const router = express.Router();

// Memory CRUD routes
router.get('/public', getPublicMemories); // All public memories (no auth required)

// All other memory routes require authentication
router.use(protect);

router.get('/feed', getFeed); // Following feed (requires auth)
router.get('/', getAllMemories); // User's own memories
router.post('/', createMemory);
router.patch('/:id', updateMemory);
router.delete('/:id', deleteMemory);
router.get('/:id', getMemory); // This should be last to avoid conflicts

// Like/Unlike routes
router.post('/:id/like', likeMemory);
router.delete('/:id/like', unlikeMemory);

// Comment routes
router.post('/:id/comments', addComment);
router.delete('/:id/comments/:commentId', deleteComment);

export default router; 