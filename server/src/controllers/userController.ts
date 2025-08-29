import { Request, Response, NextFunction } from 'express';
import { User } from '../models/User';
import { handleError } from '../utils/errorHandler';
import logger from '../utils/logger';

export const getCurrentUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        status: 'fail',
        message: 'User not authenticated',
      });
    }

    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found',
      });
    }

    logger.info(`Retrieved user profile for ${user.email}`);
    res.status(200).json({
      status: 'success',
      data: { user: user.toObject() },
    });
  } catch (error) {
    handleError(error as Error, req, res, next);
  }
};

export const updateCurrentUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        status: 'fail',
        message: 'User not authenticated',
      });
    }

    const allowedUpdates = [
      'firstName', 'lastName', 'age', 'bio', 'location', 'avatar',
      'occupation', 'gender', 'interests', 'culturalBackground', 'preferredStyle'
    ];
    const updates = Object.keys(req.body).filter(key => allowedUpdates.includes(key));
    
    if (updates.length === 0) {
      return res.status(400).json({
        status: 'fail',
        message: 'No valid updates provided',
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found',
      });
    }

    updates.forEach(update => {
      (user as any)[update] = req.body[update];
    });

    await user.save();
    
    logger.info(`Updated user profile for ${user.email}`);
    res.status(200).json({
      status: 'success',
      data: { user: user.toObject() },
    });
  } catch (error) {
    handleError(error as Error, req, res, next);
  }
}; 