import { Router } from 'express';
import { getUserProfile } from '../controllers/userController';
import { exportCollectionCSV } from '../controllers/exportController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/profile/:username', getUserProfile);
router.get('/export/csv', authenticateToken, exportCollectionCSV);

export default router;
