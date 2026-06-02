import { Router } from 'express';
import { getCollection, addToCollection } from '../controllers/collectionController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// All collection routes require authentication
router.use(authenticateToken);

router.get('/', getCollection);
router.post('/add', addToCollection);

export default router;
