import { Router } from 'express';
import { searchMedia, createMediaItem, getRecommendations } from '../controllers/mediaController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/search', searchMedia);
router.post('/create', authenticateToken, createMediaItem);
router.get('/recommendations', authenticateToken, getRecommendations);

export default router;
