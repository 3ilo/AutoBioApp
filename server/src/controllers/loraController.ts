import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';
import { ApiResponse } from '../../../shared/types/ApiResponse';
import { CreateLoRAInput, LoRAResponse } from '../../../shared/types/LoRA';
import logger from '../utils/logger';
import { loraService } from '../services/loraService';
import { illustrationService } from '../services/illustrationService';
import '../utils/auth'; // Import to ensure Request type extension is loaded

/**
 * Train a new LoRA model
 * Returns immediately with lora_id and status 'pending'
 * Training happens asynchronously
 */
export async function trainLoRA(req: Request, res: Response) {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        status: 'fail',
        message: 'User not authenticated',
      });
    }

    const userId = req.user._id.toString();
    const input = req.body as CreateLoRAInput;

    // Validate required fields
    if (!input.training_images_s3_path) {
      return res.status(400).json({
        status: 'fail',
        message: 'training_images_s3_path is required',
      });
    }

    // Start training job with illustration service (returns immediately with job_id)
    let trainingResult: { job_id: string; status: string; lora_id?: string };
    try {
      trainingResult = await illustrationService.trainLoRA(
        userId,
        input.training_images_s3_path,
        {
          loraName: input.name,
          learningRate: input.learning_rate,
          numTrainEpochs: input.num_train_epochs,
          loraRank: input.lora_rank,
          loraAlpha: input.lora_alpha,
        }
      );
    } catch (error) {
      logger.error('Failed to start training job', {
        userId,
        error: (error as Error).message,
      });
      return res.status(500).json({
        status: 'fail',
        message: 'Failed to start training job',
      });
    }

    // Generate unique lora_id (use from service response if available, otherwise generate)
    const loraId = trainingResult.lora_id || uuidv4();

    // Create LoRA record with status 'pending'
    const trainingParams = {
      learning_rate: input.learning_rate,
      num_train_epochs: input.num_train_epochs,
      lora_rank: input.lora_rank,
      lora_alpha: input.lora_alpha,
    };

    const lora = await loraService.createLoRA(userId, loraId, {
      name: input.name,
      training_params: trainingParams,
    });

    // Store job_id in LoRA record
    await loraService.updateLoRAStatus(loraId, 'pending', {
      training_job_id: trainingResult.job_id,
    } as any);

    // Return immediately with pending status
    const response: ApiResponse<LoRAResponse> = {
      status: 'success',
      data: {
        lora_id: lora.lora_id,
        status: 'pending',
        name: lora.name,
      },
      message: 'LoRA training started',
    };

    res.json(response);

    // Start status polling asynchronously (fire-and-forget)
    (async () => {
      const jobId = trainingResult.job_id;
      const pollInterval = 10000; // Poll every 10 seconds
      const maxPolls = 360; // Max 1 hour (360 * 10s = 3600s)
      let pollCount = 0;

      while (pollCount < maxPolls) {
        try {
          await new Promise((resolve) => setTimeout(resolve, pollInterval));
          pollCount++;

          // Get training status from illustration service
          const status = await illustrationService.getTrainingStatus(jobId);

          logger.debug('Training status poll', {
            userId,
            loraId,
            jobId,
            status: status.status,
            pollCount,
          });

          // Update LoRA status based on training status
          if (status.status === 'training') {
            await loraService.updateLoRAStatus(loraId, 'training');
          } else if (status.status === 'completed') {
            // Training completed successfully
            await loraService.updateLoRAStatus(loraId, 'completed', {
              s3_uri: status.lora_s3_uri,
            } as any);

            logger.info('LoRA training completed successfully', {
              userId,
              loraId,
              jobId,
              s3Uri: status.lora_s3_uri,
            });
            break; // Stop polling
          } else if (status.status === 'failed') {
            // Training failed
            await loraService.updateLoRAStatus(loraId, 'failed', {
              error_message: status.error_message,
            } as any);

            logger.error('LoRA training failed', {
              userId,
              loraId,
              jobId,
              error: status.error_message,
            });
            break; // Stop polling
          }
          // If status is still 'pending', continue polling
        } catch (error) {
          logger.error('Error polling training status', {
            userId,
            loraId,
            jobId,
            error: (error as Error).message,
            pollCount,
          });
          // Continue polling despite errors (might be transient)
          if (pollCount >= maxPolls) {
            // Max polls reached, mark as failed
            await loraService.updateLoRAStatus(loraId, 'failed', {
              error_message: 'Training status polling timeout',
            } as any);
          }
        }
      }

      if (pollCount >= maxPolls) {
        logger.warn('Training status polling timeout', {
          userId,
          loraId,
          jobId,
        });
        await loraService.updateLoRAStatus(loraId, 'failed', {
          error_message: 'Training status polling timeout',
        } as any);
      }
    })();
  } catch (error) {
    logger.error('Failed to start LoRA training', {
      userId: req.user?._id,
      error: (error as Error).message,
    });
    res.status(500).json({
      status: 'fail',
      message: 'Failed to start LoRA training',
    });
  }
}

/**
 * Get all LoRAs for the authenticated user
 * Returns list sorted by most recent first
 */
export async function getMyLoRAs(req: Request, res: Response) {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        status: 'fail',
        message: 'User not authenticated',
      });
    }

    const userId = req.user._id.toString();
    const loras = await loraService.getLoRAsByUser(userId);

    const response: ApiResponse<{ loras: typeof loras }> = {
      status: 'success',
      data: { loras },
      message: 'LoRAs retrieved successfully',
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to get user LoRAs', {
      userId: req.user?._id,
      error: (error as Error).message,
    });
    res.status(500).json({
      status: 'fail',
      message: 'Failed to retrieve LoRAs',
    });
  }
}

/**
 * Get a specific LoRA by ID
 * Verifies ownership before returning
 */
export async function getLoRAById(req: Request, res: Response) {
  try {
    if (!req.user?._id) {
      return res.status(401).json({
        status: 'fail',
        message: 'User not authenticated',
      });
    }

    const userId = req.user._id.toString();
    const { loraId } = req.params;

    if (!loraId) {
      return res.status(400).json({
        status: 'fail',
        message: 'loraId is required',
      });
    }

    const lora = await loraService.getLoRAById(loraId);

    if (!lora) {
      return res.status(404).json({
        status: 'fail',
        message: 'LoRA not found',
      });
    }

    // Verify ownership
    if (lora.user_id !== userId) {
      return res.status(403).json({
        status: 'fail',
        message: 'Access denied',
      });
    }

    const response: ApiResponse<{ lora: typeof lora }> = {
      status: 'success',
      data: { lora },
      message: 'LoRA retrieved successfully',
    };

    res.json(response);
  } catch (error) {
    logger.error('Failed to get LoRA by ID', {
      userId: req.user?._id,
      loraId: req.params.loraId,
      error: (error as Error).message,
    });
    res.status(500).json({
      status: 'fail',
      message: 'Failed to retrieve LoRA',
    });
  }
}

