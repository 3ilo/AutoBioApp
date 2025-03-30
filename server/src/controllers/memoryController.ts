import { Request, Response, NextFunction } from 'express';
import { Memory } from '../models/Memory';
import { AppError } from '../utils/errorHandler';

export const createMemory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, content, date, images, tags } = req.body;

    const memory = await Memory.create({
      title,
      content,
      date,
      images,
      tags,
      author: req.user?._id,
    });

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
    const memories = await Memory.find()
      .populate('author', 'name avatar')
      .sort('-date')
      .exec();

    res.status(200).json({
      status: 'success',
      results: memories.length,
      data: {
        memories,
      },
    });
  } catch (error) {
    next(error);
  }
};

export const getMemory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const memory = await Memory.findById(req.params.id)
      .populate('author', 'name avatar')
      .populate('comments.user', 'name avatar')
      .exec();

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

export const updateMemory = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { title, content, date, images, tags } = req.body;

    const memory = await Memory.findOneAndUpdate(
      { _id: req.params.id, author: req.user?._id },
      {
        title,
        content,
        date,
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