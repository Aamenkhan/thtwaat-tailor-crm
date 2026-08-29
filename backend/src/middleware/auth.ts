import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { ENV } from '../config/env';
import { prisma } from '../config/db';

export interface AuthUser {
  id: string;
  companyId: string;
  branchId?: string | null;
  name: string;
  email: string;
  role: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
      companyId?: string;
      branchId?: string;
    }
  }
}

export const authenticateJWT = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Unauthorized: Missing or invalid token' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, ENV.JWT_SECRET) as any;

    if (!decoded || !decoded.userId) {
      return res.status(401).json({ error: 'Unauthorized: Invalid token payload' });
    }

    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        companyId: true,
        branchId: true,
        name: true,
        email: true,
        role: true,
        isActive: true
      }
    });

    if (!user || !user.isActive) {
      return res.status(401).json({ error: 'Unauthorized: User inactive or does not exist' });
    }

    // Allow overriding active branch via header if user is Owner/Admin/Manager
    const selectedBranchId = (req.headers['x-branch-id'] as string) || user.branchId || undefined;

    req.user = user;
    req.companyId = user.companyId;
    req.branchId = selectedBranchId;

    next();
  } catch (error) {
    return res.status(401).json({ error: 'Unauthorized: Token expired or invalid' });
  }
};

export const requireRoles = (roles: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // OWNER has master superadmin access to everything
    if (req.user.role === 'OWNER' || roles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({
      error: `Forbidden: Requires one of roles: [${roles.join(', ')}]. Current role: ${req.user.role}`
    });
  };
};
