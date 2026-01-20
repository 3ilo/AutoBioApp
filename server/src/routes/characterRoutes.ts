import { Router } from 'express';
import {
  createCharacter,
  getCharacters,
  getCharacter,
  updateCharacter,
  deleteCharacter,
  generatePresignedReferenceUploadUrl,
  updateReferenceImage,
  generateCharacterAvatar,
  generateMultiAngleAvatar,
} from '../controllers/characterController';
import { protect } from '../utils/auth';

const router = Router();

// All routes require authentication
router.use(protect);

// CRUD operations
router.post('/', createCharacter);
router.get('/', getCharacters);
router.get('/:id', getCharacter);
router.patch('/:id', updateCharacter);
router.delete('/:id', deleteCharacter);

// Image upload operations
router.post('/:id/presigned-reference-upload-url', generatePresignedReferenceUploadUrl);
router.post('/:id/reference-image', updateReferenceImage);

// Avatar generation
router.post('/:id/generate-avatar', generateCharacterAvatar);
router.post('/:id/generate-multi-angle-avatar', generateMultiAngleAvatar);

export default router;
