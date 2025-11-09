import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { AppError } from '../utils/errorHandler';
import { createSendToken } from '../utils/auth';
import { IUser } from '../../../shared/types/User';
import logger from '../utils/logger';

interface RegisterRequest {
  firstName: string;
  lastName: string;
  age: number;
  email: string;
  password: string;
  registrationSecret?: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface UpdateMeRequest {
  firstName?: string;
  lastName?: string;
  age?: number;
  bio?: string;
  location?: string;
}

export const register = async (
  req: Request<{}, {}, RegisterRequest>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { firstName, lastName, age, email, password, registrationSecret } = req.body;

    // Check registration secret if required
    const requiredSecret = process.env.REGISTRATION_SECRET;
    if (requiredSecret) {
      if (!registrationSecret || registrationSecret !== requiredSecret) {
        return next(new AppError('Invalid registration secret', 403));
      }
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new AppError('Email already in use', 400));
    }

    // Create new user
    const user = await User.create({
      firstName,
      lastName,
      age,
      email,
      password,
    });

    // Generate token and send response
    createSendToken(user.toObject() as IUser, 201, res);
  } catch (error) {
    next(error);
  }
};

export const login = async (
  req: Request<{}, {}, LoginRequest>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { email, password } = req.body;

    // Check if email and password exist
    if (!email || !password) {
      return next(new AppError('Please provide email and password', 400));
    }

    // Check if user exists && password is correct
    const user = await User.findOne({ email }).select('+password');
    if (!user || !(await user.comparePassword(password))) {
      return next(new AppError('Incorrect email or password', 401));
    }

    // Generate token and send response
    createSendToken(user.toObject() as IUser, 200, res);
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    logger.info("getMe", req.user);
    const user = await User.findById(req.user?._id);
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        user: user.toObject(),
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateMe = async (
  req: Request<{}, {}, UpdateMeRequest>,
  res: Response,
  next: NextFunction
) => {
  try {
    const { firstName, lastName, age, bio, location } = req.body;

    // Find and update user
    const user = await User.findByIdAndUpdate(
      req.user?._id,
      {
        firstName,
        lastName,
        age,
        bio,
        location,
      },
      {
        new: true,
        runValidators: true,
      }
    );

    if (!user) {
      return next(new AppError('User not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        user: user.toObject(),
      },
    });
  } catch (error) {
    next(error);
  }
}; 