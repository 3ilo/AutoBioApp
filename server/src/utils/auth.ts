import jwt from 'jsonwebtoken';
import { Request } from 'express';
import { AppError } from './errorHandler';
import { IUser } from '../../../shared/types/User';
import { User } from '../models/User';

// Extend Express Request type to include user
declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

// Validate required environment variables
const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN;

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET environment variable is required');
}

if (!JWT_EXPIRES_IN) {
  throw new Error('JWT_EXPIRES_IN environment variable is required');
}

export const signToken = (id: string): string => {
  return jwt.sign(
    { id },
    JWT_SECRET as jwt.Secret,
    {
      expiresIn: JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'],
    }
  );
};

export const createSendToken = (user: IUser, statusCode: number, res: any) => {
  const token = signToken(user._id as string);

  // Remove password from output
  const userWithoutPassword = { ...user };
  delete userWithoutPassword.password;

  res.status(statusCode).json({
    status: 'success',
    data: {
      user: userWithoutPassword,
      token,
    },
  });
};

export const protect = async (req: Request, res: any, next: any) => {
  try {
    // 1) Get token
    let token;
    if (req.headers.authorization?.startsWith('Bearer')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return next(new AppError('You are not logged in! Please log in to get access.', 401));
    }

    // 2) Verify token
    const decoded = jwt.verify(token, JWT_SECRET as jwt.Secret) as { id: string };

    // 3) Check if user still exists
    const user = await User.findById(decoded.id);
    if (!user) {
      return next(new AppError('The user belonging to this token no longer exists.', 401));
    }

    // Grant access to protected route
    req.user = user.toObject() as IUser;
    next();
  } catch (error) {
    next(error);
  }
};

export const restrictTo = (...roles: string[]) => {
  return (req: Request, res: any, next: any) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return next(new AppError('You do not have permission to perform this action', 403));
    }
    next();
  };
}; 