import { LoRA } from '../models/LoRA';
import logger from '../utils/logger';
import { ILoRA } from '../../../shared/types/LoRA';

export class LoRAService {
  /**
   * Get the most recent completed LoRA for a user
   */
  async getMostRecentLoRA(userId: string): Promise<ILoRA | null> {
    try {
      const lora = await LoRA.findOne({
        user_id: userId,
        status: 'completed',
      })
        .sort({ createdAt: -1 }) // Mongoose timestamps use createdAt
        .lean();

      if (!lora) {
        return null;
      }

      return {
        _id: (lora._id as any).toString(),
        lora_id: lora.lora_id,
        user_id: (lora.user_id as any).toString(),
        s3_uri: lora.s3_uri,
        name: lora.name,
        status: lora.status as 'pending' | 'training' | 'completed' | 'failed',
        created_at: lora.createdAt, // Map Mongoose createdAt to created_at
        training_params: lora.training_params,
        error_message: lora.error_message,
        training_job_id: (lora as any).training_job_id,
        createdAt: lora.createdAt,
        updatedAt: lora.updatedAt,
      };
    } catch (error) {
      logger.error('Failed to get most recent LoRA', {
        userId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Create a new LoRA record with status 'pending'
   */
  async createLoRA(
    userId: string,
    loraId: string,
    initialData: {
      name?: string;
      training_params?: any;
    } = {}
  ): Promise<ILoRA> {
    try {
      const lora = await LoRA.create({
        lora_id: loraId,
        user_id: userId,
        status: 'pending',
        name: initialData.name,
        training_params: initialData.training_params,
      });

      logger.info('LoRA record created', { userId, loraId, status: 'pending' });

      return {
        _id: (lora._id as any).toString(),
        lora_id: lora.lora_id,
        user_id: (lora.user_id as any).toString(),
        s3_uri: lora.s3_uri,
        name: lora.name,
        status: lora.status as 'pending' | 'training' | 'completed' | 'failed',
        created_at: lora.createdAt, // Map Mongoose createdAt to created_at
        training_params: lora.training_params,
        error_message: lora.error_message,
        training_job_id: (lora as any).training_job_id,
        createdAt: lora.createdAt,
        updatedAt: lora.updatedAt,
      };
    } catch (error) {
      logger.error('Failed to create LoRA record', {
        userId,
        loraId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Get all LoRAs for a user, sorted by most recent first
   */
  async getLoRAsByUser(userId: string): Promise<ILoRA[]> {
    try {
      const loras = await LoRA.find({ user_id: userId })
        .sort({ createdAt: -1 })
        .lean();

      return loras.map((lora) => ({
        _id: lora._id.toString(),
        lora_id: lora.lora_id,
        user_id: lora.user_id.toString(),
        s3_uri: lora.s3_uri,
        name: lora.name,
        status: lora.status as 'pending' | 'training' | 'completed' | 'failed',
        created_at: lora.createdAt,
        training_params: lora.training_params,
        error_message: lora.error_message,
        createdAt: lora.createdAt,
        updatedAt: lora.updatedAt,
      }));
    } catch (error) {
      logger.error('Failed to get LoRAs by user', {
        userId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Get a specific LoRA by lora_id
   */
  async getLoRAById(loraId: string): Promise<ILoRA | null> {
    try {
      const lora = await LoRA.findOne({ lora_id: loraId }).lean();

      if (!lora) {
        return null;
      }

      return {
        _id: (lora._id as any).toString(),
        lora_id: lora.lora_id,
        user_id: (lora.user_id as any).toString(),
        s3_uri: lora.s3_uri,
        name: lora.name,
        status: lora.status as 'pending' | 'training' | 'completed' | 'failed',
        created_at: lora.createdAt, // Map Mongoose createdAt to created_at
        training_params: lora.training_params,
        error_message: lora.error_message,
        training_job_id: (lora as any).training_job_id,
        createdAt: lora.createdAt,
        updatedAt: lora.updatedAt,
      };
    } catch (error) {
      logger.error('Failed to get LoRA by ID', {
        loraId,
        error: (error as Error).message,
      });
      throw error;
    }
  }

  /**
   * Update LoRA status and optional fields
   */
  async updateLoRAStatus(
    loraId: string,
    status: 'pending' | 'training' | 'completed' | 'failed',
    updateData?: {
      s3_uri?: string;
      error_message?: string;
      training_job_id?: string;
    }
  ): Promise<ILoRA | null> {
    try {
      const update: any = { status };

      if (updateData?.s3_uri) {
        update.s3_uri = updateData.s3_uri;
      }

      if (updateData?.error_message) {
        update.error_message = updateData.error_message;
      }

      if (updateData?.training_job_id) {
        update.training_job_id = updateData.training_job_id;
      }

      const lora = await LoRA.findOneAndUpdate(
        { lora_id: loraId },
        update,
        { new: true }
      ).lean();

      if (!lora) {
        return null;
      }

      logger.info('LoRA status updated', { loraId, status });

      return {
        _id: (lora._id as any).toString(),
        lora_id: lora.lora_id,
        user_id: (lora.user_id as any).toString(),
        s3_uri: lora.s3_uri,
        name: lora.name,
        status: lora.status as 'pending' | 'training' | 'completed' | 'failed',
        created_at: lora.createdAt, // Map Mongoose createdAt to created_at
        training_params: lora.training_params,
        error_message: lora.error_message,
        training_job_id: (lora as any).training_job_id,
        createdAt: lora.createdAt,
        updatedAt: lora.updatedAt,
      };
    } catch (error) {
      logger.error('Failed to update LoRA status', {
        loraId,
        status,
        error: (error as Error).message,
      });
      throw error;
    }
  }
}

// Export singleton instance
export const loraService = new LoRAService();

