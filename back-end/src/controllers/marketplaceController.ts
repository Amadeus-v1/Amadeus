import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { z } from 'zod';

const CreateListingSchema = z.object({
  collectionItemId: z.string(),
  price: z.number().positive(),
  description: z.string().optional(),
});

export const getListings = async (req: Request, res: Response) => {
  try {
    const listings = await prisma.marketplaceListing.findMany({
      where: { status: 'ACTIVE' },
      include: {
        seller: { select: { username: true, displayName: true } },
        collectionItem: {
          include: { mediaItem: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });
    res.json(listings);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
};

export const createListing = async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;
  try {
    const { collectionItemId, price, description } = CreateListingSchema.parse(req.body);
    
    // Ensure user owns the item
    const item = await prisma.collectionItem.findUnique({
      where: { id: collectionItemId }
    });

    if (!item || item.userId !== userId) {
      return res.status(403).json({ error: 'You do not own this item' });
    }

    const listing = await prisma.marketplaceListing.create({
      data: {
        sellerId: userId,
        collectionItemId,
        price: String(price),
        description,
      }
    });

    res.status(201).json(listing);
  } catch (error) {
    res.status(400).json({ error: 'Invalid listing data' });
  }
};
