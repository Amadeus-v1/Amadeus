import { Request, Response } from 'express';
import prisma from '../lib/prisma';

export const getUserProfile = async (req: Request, res: Response) => {
  const { username } = req.params;
  try {
    const user = await prisma.user.findUnique({
      where: { username },
      select: {
        id: true,
        username: true,
        displayName: true,
        profilePic: true,
        bio: true,
        createdAt: true,
      },
    });

    if (!user) return res.status(404).json({ error: 'User not found' });

    // Calculate Statistics
    const stats = await prisma.collectionItem.aggregate({
      where: { userId: user.id },
      _count: { id: true },
      _sum: { quantity: true, estimatedValue: true },
    });

    const categoryBreakdown = await prisma.collectionItem.groupBy({
      by: ['mediaItemId'],
      where: { userId: user.id },
      _count: { id: true },
    });

    res.json({
      user,
      stats: {
        totalItems: stats._count.id,
        totalQuantity: stats._sum.quantity || 0,
        totalValue: stats._sum.estimatedValue || 0,
        categories: categoryBreakdown,
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
};
