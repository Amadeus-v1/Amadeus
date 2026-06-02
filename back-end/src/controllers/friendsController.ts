import { Request, Response } from 'express';
import prisma from '../lib/prisma';

export const sendFriendRequest = async (req: Request, res: Response) => {
  const senderId = (req as any).user.userId;
  const { receiverId } = req.body;

  if (senderId === receiverId) return res.status(400).json({ error: 'Cannot add yourself' });

  try {
    const request = await prisma.friendRequest.create({
      data: { senderId, receiverId, status: 'PENDING' },
    });
    res.status(201).json(request);
  } catch (error) {
    res.status(400).json({ error: 'Request already exists' });
  }
};

export const handleFriendRequest = async (req: Request, res: Response) => {
  const { requestId, action } = req.body; // action: 'ACCEPTED' | 'DECLINED'
  const userId = (req as any).user.userId;

  try {
    const request = await prisma.friendRequest.findUnique({ where: { id: requestId } });
    if (!request || request.receiverId !== userId) return res.status(404).json({ error: 'Request not found' });

    if (action === 'ACCEPTED') {
      await prisma.$transaction([
        prisma.friendRequest.update({ where: { id: requestId }, data: { status: 'ACCEPTED' } }),
        prisma.friendship.create({ data: { userId: request.senderId, friendId: request.receiverId } }),
        prisma.friendship.create({ data: { userId: request.receiverId, friendId: request.senderId } }),
      ]);
      return res.json({ message: 'Friend added' });
    }

    await prisma.friendRequest.delete({ where: { id: requestId } });
    res.json({ message: 'Request declined' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to process request' });
  }
};

export const getFriends = async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const friends = await prisma.friendship.findMany({
      where: { userId },
      include: { friend: { select: { id: true, username: true, displayName: true, profilePic: true } } },
    });
    res.json(friends.map(f => f.friend));
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch friends' });
  }
};
