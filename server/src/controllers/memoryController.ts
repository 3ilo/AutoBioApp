import { Request, Response, NextFunction } from 'express';
import { Memory } from '../models/Memory';
import { User } from '../models/User';
import { AppError } from '../utils/errorHandler';
import { bedrockMemorySummaryService } from '../services/memorySummaryService';
import { memorySummaryStubService } from '../services/stubs/memorySummaryStubService';
import { s3Client } from '../utils/s3Client';
import logger from '../utils/logger';

// Environment variable
const USE_STUB = process.env.USE_STUB === 'true'; 

// Initialize memory summary service (use stub if USE_STUB is enabled)
const memorySummaryService = USE_STUB
  ? memorySummaryStubService
  : bedrockMemorySummaryService;

export const createMemory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, content, date, mainImage, images, tags } = req.body;

    // Create memory first
    const memory = await Memory.create({
      title,
      content,
      date,
      mainImage,
      images,
      tags,
      author: req.user?._id,
    });

    // Generate summary asynchronously (for future async implementation)
    try {
      const user = await User.findById(req.user?._id);
      if (user) {
        const summary = await memorySummaryService.generateMemorySummary(
          memory.toObject(),
          user.toObject() as any,
          { summaryLength: 'brief', includeUserContext: true }
        );

        // Update memory with summary
        await Memory.findByIdAndUpdate(memory._id, { summary });
        
        // Update the memory object for response
        memory.summary = summary;
      }
    } catch (summaryError) {
      logger.error('Failed to generate memory summary during creation', { 
        memoryId: memory._id, 
        userId: req.user?._id,
        error: (summaryError as Error).message 
      });
      // Continue without summary - memory creation was successful
    }

    res.status(201).json({
      status: 'success',
      data: {
        memory,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getAllMemories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        status: 'fail',
        message: 'User not authenticated',
      });
    }

    // Only get memories created by the current user
    const memories = await Memory.find({ author: req.user._id })
      .populate('author', 'firstName lastName avatar')
      .sort('-date')
      .lean()  // Returns plain objects instead of Mongoose documents
      .exec();

    // Convert S3 URIs to pre-signed URLs for all memories
    const memoriesWithPresignedUrls = await s3Client.convertMemoriesImagesToPresignedUrls(memories);

    res.status(200).json({
      status: 'success',
      results: memoriesWithPresignedUrls.length,
      data: memoriesWithPresignedUrls,
    });
  } catch (error) {
    next(error);
  }
};

export const getPublicMemories = async (req: Request, res: Response, next: NextFunction) => {
  try {
    // Get all public memories from all users
    // Include memories where isPublic is true OR where isPublic is not set (for backward compatibility)
    const memories = await Memory.find({
      $or: [
        { isPublic: true },
        { isPublic: { $exists: false } } // Include memories created before isPublic field was added
      ]
    })
      .populate('author', 'firstName lastName avatar')
      .sort('-date')
      .lean()  // Returns plain objects instead of Mongoose documents
      .exec();

    logger.info('Retrieved public memories for explore page', { count: memories.length });
    
    // Convert S3 URIs to pre-signed URLs for all memories
    const memoriesWithPresignedUrls = await s3Client.convertMemoriesImagesToPresignedUrls(memories);
    
    res.status(200).json({
      status: 'success',
      results: memoriesWithPresignedUrls.length,
      data: memoriesWithPresignedUrls,
    });
  } catch (error) {
    next(error);
  }
};

export const getFeed = async (req: Request, res: Response, next: NextFunction) => {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        status: 'fail',
        message: 'User not authenticated',
      });
    }

    const currentUser = await User.findById(req.user._id);
    if (!currentUser) {
      return res.status(404).json({
        status: 'fail',
        message: 'User not found',
      });
    }

    // Get memories from followed users
    const followedUserIds = currentUser.following || [];
    
    if (followedUserIds.length === 0) {
      // If not following anyone, return empty feed
      return res.status(200).json({
        status: 'success',
        results: 0,
        data: [],
      });
    }

    const feedMemories = await Memory.find({
      author: { $in: followedUserIds },
      isPublic: true,
    })
      .populate('author', 'firstName lastName avatar')
      .sort('-date')
      .lean()  // Returns plain objects instead of Mongoose documents
      .exec();

    // Convert S3 URIs to pre-signed URLs for all feed memories
    const feedMemoriesWithPresignedUrls = await s3Client.convertMemoriesImagesToPresignedUrls(feedMemories);

    res.status(200).json({
      status: 'success',
      results: feedMemoriesWithPresignedUrls.length,
      data: feedMemoriesWithPresignedUrls,
    });
  } catch (error) {
    next(error);
  }
};

export const getMemory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const memory = await Memory.findById(req.params.id)
      .populate('author', 'firstName lastName avatar')
      .populate('comments.user', 'firstName lastName avatar')
      .lean()  // Returns plain object instead of Mongoose document
      .exec();

    if (!memory) {
      return next(new AppError('Memory not found', 404));
    }

    // Convert S3 URIs to pre-signed URLs for the memory
    const memoryWithPresignedUrls = await s3Client.convertMemoryImagesToPresignedUrls(memory);

    res.status(200).json({
      status: 'success',
      data: {
        memory: memoryWithPresignedUrls,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const updateMemory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, content, date, mainImage, images, tags } = req.body;

    const memory = await Memory.findOneAndUpdate(
      { _id: req.params.id, author: req.user?._id },
      {
        title,
        content,
        date,
        mainImage,
        images,
        tags,
      },
      {
        new: true,
        runValidators: true,
      }
    ).populate('author', 'name avatar');

    if (!memory) {
      return next(new AppError('Memory not found or unauthorized', 404));
    }

    // Regenerate summary if content was updated
    if (title || content) {
      try {
        const user = await User.findById(req.user?._id);
        if (user) {
          const summary = await memorySummaryService.generateMemorySummary(
            memory.toObject(),
            user.toObject() as any,
            { summaryLength: 'brief', includeUserContext: true }
          );

          // Update memory with new summary
          await Memory.findByIdAndUpdate(memory._id, { summary });
          
          // Update the memory object for response
          memory.summary = summary;
        }
      } catch (summaryError) {
        logger.error('Failed to regenerate memory summary', { 
          memoryId: memory._id, 
          userId: req.user?._id,
          error: (summaryError as Error).message 
        });
        throw summaryError;
        // Continue without summary update - memory update was successful
      }
    }

    res.status(200).json({
      status: 'success',
      data: {
        memory,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteMemory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const memory = await Memory.findOneAndDelete({
      _id: req.params.id,
      author: req.user?._id,
    });

    if (!memory) {
      return next(new AppError('Memory not found or unauthorized', 404));
    }

    res.status(204).json({
      status: 'success',
      data: null,
    });
  } catch (error) {
    next(error);
  }
};

export const likeMemory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const memory = await Memory.findByIdAndUpdate(
      req.params.id,
      {
        $addToSet: { likes: req.user?._id },
      },
      { new: true }
    );

    if (!memory) {
      return next(new AppError('Memory not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        memory,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const unlikeMemory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const memory = await Memory.findByIdAndUpdate(
      req.params.id,
      {
        $pull: { likes: req.user?._id },
      },
      { new: true }
    );

    if (!memory) {
      return next(new AppError('Memory not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        memory,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const addComment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { content } = req.body;

    const memory = await Memory.findByIdAndUpdate(
      req.params.id,
      {
        $push: {
          comments: {
            user: req.user?._id,
            content,
            createdAt: new Date(),
          },
        },
      },
      { new: true }
    ).populate('comments.user', 'name avatar');

    if (!memory) {
      return next(new AppError('Memory not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        memory,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const deleteComment = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const memory = await Memory.findByIdAndUpdate(
      req.params.id,
      {
        $pull: {
          comments: {
            _id: req.params.commentId,
            user: req.user?._id,
          },
        },
      },
      { new: true }
    );

    if (!memory) {
      return next(new AppError('Memory or comment not found', 404));
    }

    res.status(200).json({
      status: 'success',
      data: {
        memory,
      },
    });
  } catch (error) {
    next(error);
  }
}; 