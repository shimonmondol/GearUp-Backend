import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AppError } from '../utils/AppError';
import { Role } from '@prisma/client';

export const protect = (req: Request, res: Response, next: NextFunction): void => {
  let token: string | undefined;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    token = req.headers.authorization.split(' ')[1];
  }

  if (!token) {
    throw new AppError(401, 'You are not logged in. Please log in to get access.');
  }

  try {
    const decoded = jwt.verify(
      token,
      process.env.JWT_ACCESS_SECRET || process.env.JWT_SECRET || 'secret'
    ) as { id: string; role: Role };

    (req as any).user = decoded;
    next();
  } catch (error) {
    throw new AppError(401, 'Token is invalid or expired. Please log in again.');
  }
};

export const restrictTo = (...roles: (Role | string)[]) => {
  return (req: Request, res: Response, next: NextFunction): void => {
    const user = (req as any).user;

    if (!user) {
      throw new AppError(401, 'Authentication required.');
    }

    // Role case-insensitive check (e.g., 'ADMIN' or 'admin')
    const userRole = String(user.role || '').toUpperCase();
    const allowedRoles = roles.map((r) => String(r).toUpperCase());

    if (!allowedRoles.includes(userRole)) {
      throw new AppError(403, 'You do not have permission to perform this action.');
    }

    next();
  };
};

export const authorizeRoles = restrictTo;