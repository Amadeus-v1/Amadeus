import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { z } from 'zod';

const AddItemSchema = z.object({
  mediaItemId: z.string(),
  variantId: z.string().optional(),
  condition: z.string().optional(),
  purchasePrice: z.number().optional(),
  notes: z.string().optional(),
  quantity: z.number().default(1),
});

export const getCollection = async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;

  try {
    const collection = await prisma.collectionItem.findMany({
      where: { userId },
      include: {
        mediaItem: true,
        variant: true,
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(collection);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch collection' });
  }
};

export const addToCollection = async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  
  try {
    const data = AddItemSchema.parse(req.body);

    const item = await prisma.collectionItem.create({
      data: {
        userId,
        ...data,
        purchasePrice: data.purchasePrice ? String(data.purchasePrice) : null,
      },
    });

    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ error: 'Invalid data' });
  }
};
