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

export const followUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        status: 'fail',
        message: 'User not authenticated',
      });
    }

    const { userId } = req.params;
    const currentUserId = req.user._id;

    if (currentUserId === userId) {
      return res.status(400).json({
        status: 'fail',
        message: 'Cannot follow yourself',
      });
    }

    const userToFollow = await User.findById(userId);
    if (!userToFollow) {
      return res.status(404).json({
        status: 'fail',
        message: 'User to follow not found',
      });
    }

    const currentUser = await User.findById(currentUserId);
    if (!currentUser) {
      return res.status(404).json({
        status: 'fail',
        message: 'Current user not found',
      });
    }

    // Check if already following
    if (currentUser.following?.includes(userId)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Already following this user',
      });
    }

    // Add to following list
    currentUser.following = currentUser.following || [];
    currentUser.following.push(userId);
    await currentUser.save();

    // Add to user's followers list
    userToFollow.followers = userToFollow.followers || [];
    userToFollow.followers.push(currentUserId);
    await userToFollow.save();

    logger.info(`User ${currentUserId} started following ${userId}`);
    res.status(200).json({
      status: 'success',
      message: 'Successfully followed user',
    });
  } catch (error) {
    handleError(error as Error, req, res, next);
  }
};

export const unfollowUser = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        status: 'fail',
        message: 'User not authenticated',
      });
    }

    const { userId } = req.params;
    const currentUserId = req.user._id;

    if (currentUserId === userId) {
      return res.status(400).json({
        status: 'fail',
        message: 'Cannot unfollow yourself',
      });
    }

    const userToUnfollow = await User.findById(userId);
    if (!userToUnfollow) {
      return res.status(404).json({
        status: 'fail',
        message: 'User to unfollow not found',
      });
    }

    const currentUser = await User.findById(currentUserId);
    if (!currentUser) {
      return res.status(404).json({
        status: 'fail',
        message: 'Current user not found',
      });
    }

    // Check if not following
    if (!currentUser.following?.includes(userId)) {
      return res.status(400).json({
        status: 'fail',
        message: 'Not following this user',
      });
    }

    // Remove from following list
    currentUser.following = currentUser.following.filter(id => id.toString() !== userId);
    await currentUser.save();

    // Remove from user's followers list
    userToUnfollow.followers = (userToUnfollow.followers || []).filter(id => id.toString() !== currentUserId);
    await userToUnfollow.save();

    logger.info(`User ${currentUserId} unfollowed ${userId}`);
    res.status(200).json({
      status: 'success',
      message: 'Successfully unfollowed user',
    });
  } catch (error) {
    handleError(error as Error, req, res, next);
  }
};

export const getFollowers = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).populate('followers', 'firstName lastName avatar');
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found',
      });
    }

    res.status(200).json({
      status: 'success',
      data: { followers: user.followers || [] },
    });
  } catch (error) {
    handleError(error as Error, req, res, next);
  }
};

export const getFollowing = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).populate('following', 'firstName lastName avatar');
    if (!user) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found',
      });
    }

    res.status(200).json({
      status: 'success',
      data: { following: user.following || [] },
    });
  } catch (error) {
    handleError(error as Error, req, res, next);
  }
}; 