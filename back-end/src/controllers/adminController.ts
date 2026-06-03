import { Request, Response } from 'express';
import prisma from '../lib/prisma';

export const getPendingMedia = async (req: Request, res: Response) => {
  try {
    const pending = await prisma.mediaItem.findMany({
      where: { isApproved: false },
      include: { _count: { select: { userEntries: true } } },
    });
    res.json(pending);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch pending media' });
  }
};

export const approveMedia = async (req: Request, res: Response) => {
  const { id } = req.params;
  try {
    await prisma.mediaItem.update({
      where: { id },
      data: { isApproved: true },
    });
    res.json({ message: 'Media item approved' });
  } catch (error) {
    res.status(500).json({ error: 'Approval failed' });
  }
};

export const getUsers = async (req: Request, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      select: {
        id: true,
        username: true,
        displayName: true,
        role: true,
        createdAt: true,
        _count: { select: { collection: true } },
      },
    });
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};
