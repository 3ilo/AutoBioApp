import { Request, Response, NextFunction } from 'express';
import { User, IUser } from '../models/User';
import { AppError } from '../utils/errorHandler';
import { createSendToken } from '../utils/auth';

interface RegisterRequest {
  name: string;
  firstName: string;
  lastName: string;
  age: number;
  email: string;
  password: string;
}

interface LoginRequest {
  email: string;
  password: string;
}

interface UpdateMeRequest {
  name?: string;
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
    const { name, firstName, lastName, age, email, password } = req.body;

    // Check if user already exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return next(new AppError('Email already in use', 400));
    }

    // Create new user
    const user = await User.create({
      name,
      firstName,
      lastName,
      age,
      email,
      password,
    });

    // Generate token and send response
    createSendToken(user as IUser & { _id: string }, 201, res);
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
    createSendToken(user as IUser & { _id: string }, 200, res);
  } catch (error) {
    next(error);
  }
};

export const getMe = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const user = await User.findById(req.user?._id);
    if (!user) {
      return next(new AppError('User not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        user,
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
    const { name, firstName, lastName, age, bio, location } = req.body;

    // Find and update user
    const user = await User.findByIdAndUpdate(
      req.user?._id,
      {
        name,
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
        user,
      },
    });
  } catch (error) {
    next(error);
  }
}; 