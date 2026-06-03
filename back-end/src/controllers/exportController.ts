import { Request, Response } from 'express';
import prisma from '../lib/prisma';

export const exportCollectionCSV = async (req: Request, res: Response) => {
  const userId = (req as any).user.userId;

  try {
    const collection = await prisma.collectionItem.findMany({
      where: { userId },
      include: {
        mediaItem: true,
        variant: true,
      },
    });

    let csv = 'Title,Creator,Type,Format,Condition,Acquired Date,Price,Value,Quantity,Notes\n';

    collection.forEach((item) => {
      const row = [
        `"${item.mediaItem.title}"`,
        `"${item.mediaItem.creator}"`,
        item.mediaItem.type,
        `"${item.variant?.name || 'Standard'}"`,
        `"${item.condition || ''}"`,
        item.dateAcquired ? item.dateAcquired.toISOString().split('T')[0] : '',
        item.purchasePrice || '',
        item.estimatedValue || '',
        item.quantity,
        `"${item.notes || ''}"`,
      ];
      csv += row.join(',') + '\n';
    });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=amadeus_collection_export.csv');
    res.status(200).send(csv);
  } catch (error) {
    res.status(500).json({ error: 'Export failed' });
  }
};
