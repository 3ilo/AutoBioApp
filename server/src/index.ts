// Load environment variables first
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env file
dotenv.config({ path: path.join(__dirname, '../.env') });

// Validate required environment variables
const requiredEnvVars = ['MONGODB_URI', 'JWT_SECRET', 'JWT_EXPIRES_IN'];
for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    console.error(`Error: ${envVar} environment variable is required`);
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
import { handleError } from './utils/errorHandler';

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

// Error handling middleware
app.use(handleError);

// Connect to MongoDB only if not in test environment and not in serverless mode
const MONGODB_URI = process.env.MONGODB_URI as string;
const PORT = process.env.PORT || 3000;
const IS_SERVERLESS = process.env.IS_SERVERLESS === 'true' || process.env.AWS_LAMBDA_FUNCTION_NAME !== undefined;

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
      console.log('Connected to MongoDB');
    })
    .catch((error) => {
      console.error('MongoDB connection error:', error);
      // Don't exit in serverless mode, let Lambda handle it
      if (!IS_SERVERLESS) {
        process.exit(1);
      }
    });
}

// Only start HTTP server if not in serverless mode
if (process.env.NODE_ENV !== 'test' && !IS_SERVERLESS) {
  app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
  });
}

export default app;