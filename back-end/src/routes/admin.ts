import { Router } from 'express';
import { getPendingMedia, approveMedia, getUsers } from '../controllers/adminController';
import { authenticateToken } from '../middleware/auth';

const router = Router();

// Simple role check middleware
const isAdmin = (req: any, res: any, next: any) => {
  if (req.user && req.user.role === 'ADMIN') {
    next();
  } else {
    res.status(403).json({ error: 'Admin access required' });
  }
};

router.use(authenticateToken, isAdmin);

router.get('/media/pending', getPendingMedia);
router.post('/media/approve/:id', approveMedia);
router.get('/users', getUsers);

export default router;
