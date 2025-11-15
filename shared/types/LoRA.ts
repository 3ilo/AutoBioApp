export interface ILoRA {
  _id?: string;
  lora_id: string; // UUID
  user_id: string; // ObjectId reference to User
  s3_uri?: string; // Set when training completes
  name?: string; // Optional human-readable name
  status: 'pending' | 'training' | 'completed' | 'failed';
  created_at?: Date;
  training_params?: {
    learning_rate?: number;
    num_train_epochs?: number;
    lora_rank?: number;
    lora_alpha?: number;
    [key: string]: any;
  };
  error_message?: string; // Set if status='failed'
  training_job_id?: string; // Job ID from illustration service
  createdAt?: Date;
  updatedAt?: Date;
}

export interface CreateLoRAInput {
  training_images_s3_path: string;
  name?: string;
  learning_rate?: number;
  num_train_epochs?: number;
  lora_rank?: number;
  lora_alpha?: number;
}

export interface LoRAResponse {
  lora_id: string;
  status: 'pending' | 'training' | 'completed' | 'failed';
  s3_uri?: string;
  name?: string;
  error_message?: string;
}

