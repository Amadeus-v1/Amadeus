import { Request, Response } from 'express';
import argon2 from 'argon2';
import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma';
import { z } from 'zod';

const RegisterSchema = z.object({
  username: z.string().min(3),
  email: z.string().email().optional(),
  password: z.string().min(8),
});

export const register = async (req: Request, res: Response) => {
  try {
    const { username, email, password } = RegisterSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({ where: { username } });
    if (existingUser) {
      return res.status(400).json({ error: 'Username already taken' });
    }

    const passwordHash = await argon2.hash(password);

    const user = await prisma.user.create({
      data: {
        username,
        email,
        passwordHash,
      },
    });

    res.status(201).json({ message: 'User created', userId: user.id });
  } catch (error) {
    res.status(400).json({ error: 'Invalid input or server error' });
  }
};

export const login = async (req: Request, res: Response) => {
  try {
    const { username, password } = req.body;

    const user = await prisma.user.findUnique({ where: { username } });
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const validPassword = await argon2.verify(user.passwordHash, password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id, username: user.username },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '24h' }
    );

    res.json({ token, user: { id: user.id, username: user.username } });
  } catch (error) {
    res.status(500).json({ error: 'Server error' });
  }
};
