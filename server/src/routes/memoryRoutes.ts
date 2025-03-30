import express from 'express';
import {
  createMemory,
  getAllMemories,
  getMemory,
  updateMemory,
  deleteMemory,
  likeMemory,
  unlikeMemory,
  addComment,
  deleteComment,
} from '../controllers/memoryController';
import { protect } from '../utils/auth';

const router = express.Router();

// All memory routes require authentication
router.use(protect);

// Memory CRUD routes
router.get('/', getAllMemories);
router.get('/:id', getMemory);
router.post('/', createMemory);
router.patch('/:id', updateMemory);
router.delete('/:id', deleteMemory);

// Like/Unlike routes
router.post('/:id/like', likeMemory);
router.delete('/:id/like', unlikeMemory);

// Comment routes
router.post('/:id/comments', addComment);
router.delete('/:id/comments/:commentId', deleteComment);

export default router; 