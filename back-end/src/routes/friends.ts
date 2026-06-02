import { Router } from 'express';
import { sendFriendRequest, handleFriendRequest, getFriends } from '../controllers/friendsController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

router.use(authenticateToken);

router.get('/', getFriends);
router.post('/request', sendFriendRequest);
router.post('/handle', handleFriendRequest);

export default router;
