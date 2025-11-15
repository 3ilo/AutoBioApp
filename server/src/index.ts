// Load environment variables first
import dotenv from 'dotenv';
import path from 'path';
import logger from './utils/logger';

// NODE_ENV should be set by:
// - package.json scripts (for local dev: NODE_ENV=local)
// - serverless.yml (for deployments: NODE_ENV=dev or NODE_ENV=prod)
// - Test runners (for tests: NODE_ENV=test)
// If not set, default to 'local' for safety

// Step 1: Determine which stage-specific .env file to load based on NODE_ENV
function getStageEnvFile(): string {
  const nodeEnv = process.env.NODE_ENV;
  
  if (nodeEnv === 'production' || nodeEnv === 'prod') {
    return '.env.prod';
  }
  
  if (nodeEnv === 'development' || nodeEnv === 'dev') {
    return '.env.dev';
  }
  
  if (nodeEnv === 'test') {
    return '.env.test';
  }
  
  // Default to local
  return '.env.local';
}

const nodeEnv = process.env.NODE_ENV || 'local';
const stageEnvFile = getStageEnvFile();
const stageEnvPath = path.join(__dirname, `../${stageEnvFile}`);

// Step 2: Load stage-specific environment variables
logger.info(`Loading environment: ${nodeEnv} from ${stageEnvFile}`);
dotenv.config({ path: stageEnvPath });

// Validate required environment variables
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET', 'JWT_EXPIRES_IN'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    logger.error(`Missing required environment variable: ${envVar}`);
    process.exit(1);
  }
}

import express from 'express';
import mongoose from 'mongoose';
import cors from 'cors';
import authRoutes from './routes/authRoutes';
import memoryRoutes from './routes/memoryRoutes';
import userRoutes from './routes/userRoutes';
import imageRoutes from './routes/imageRoutes';
import loraRoutes from './routes/loraRoutes';
import { handleError } from './utils/errorHandler';
import { IS_SERVERLESS } from './utils/env';

// Create Express app
const app = express();

// CORS configuration - only allow requests from frontend domain
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';
const corsOptions = {
  origin: (origin: string | undefined, callback: (err: Error | null, allow?: boolean) => void) => {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) {
      return callback(null, true);
    }
    
    // Check if origin matches frontend URL
    if (origin === FRONTEND_URL || origin.startsWith(FRONTEND_URL)) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200,
};

// Middleware
app.use(cors(corsOptions));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/memories', memoryRoutes);
app.use('/api/users', userRoutes);
app.use('/api/images', imageRoutes);
app.use('/api/lora', loraRoutes);

// Error handling middleware
app.use(handleError);

// Connect to MongoDB only if not in test environment and not in serverless mode
const MONGODB_URI = process.env.MONGODB_URI as string;
const PORT = process.env.PORT || 3000;

// Add connection options
const mongooseOptions = {
  serverSelectionTimeoutMS: 10000, // Increase timeout to 10s
  family: 4,
};

// Initialize MongoDB connection (for both serverless and regular mode)
if (process.env.NODE_ENV !== 'test' && MONGODB_URI) {
  mongoose
    .connect(MONGODB_URI, mongooseOptions)
    .then(() => {
      logger.info('MongoDB connection established');
    })
    .catch((error) => {
      logger.error('MongoDB connection failed', { error: error.message });
      // Don't exit in serverless mode, let Lambda handle it
      if (!IS_SERVERLESS) {
        process.exit(1);
      }
    });
}

// Only start HTTP server if not in serverless mode
if (process.env.NODE_ENV !== 'test' && !IS_SERVERLESS) {
  app.listen(PORT, () => {
    logger.info(`Server listening on port ${PORT}`);
  });
}

export default app;