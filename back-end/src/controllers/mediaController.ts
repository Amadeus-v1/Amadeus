import { Request, Response } from 'express';
import prisma from '../lib/prisma';
import { z } from 'zod';

const MediaItemSchema = z.object({
  title: z.string(),
  creator: z.string(),
  type: z.enum(['VINYL', 'CD', 'DVD', 'BLURAY', 'BOOK', 'CASSETTE', 'OTHER']),
  releaseYear: z.number().optional(),
  barcode: z.string().optional(),
  baseCover: z.string().optional(),
});

export const searchMedia = async (req: Request, res: Response) => {
  const { query } = req.query;
  try {
    const items = await prisma.mediaItem.findMany({
      where: {
        OR: [
          { title: { contains: String(query), mode: 'insensitive' } },
          { creator: { contains: String(query), mode: 'insensitive' } },
          { barcode: String(query) },
        ],
      },
      include: { variants: true },
    });
    res.json(items);
  } catch (error) {
    res.status(500).json({ error: 'Search failed' });
  }
};

export const createMediaItem = async (req: Request, res: Response) => {
  try {
    const data = MediaItemSchema.parse(req.body);
    const item = await prisma.mediaItem.create({ data });
    res.status(201).json(item);
  } catch (error) {
    res.status(400).json({ error: 'Invalid media data' });
  }
};
