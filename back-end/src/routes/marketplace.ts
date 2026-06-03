import { Router } from 'express';
import { getListings, createListing } from '../controllers/marketplaceController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.get('/listings', getListings);
router.post('/list', authenticateToken, createListing);

export default router;
