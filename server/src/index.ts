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

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/memories', memoryRoutes);
app.use('/api/users', userRoutes);
app.use('/api/images', imageRoutes);

// Error handling middleware
app.use(handleError);

// Connect to MongoDB only if not in test environment
const MONGODB_URI = process.env.MONGODB_URI as string;
const PORT = process.env.PORT || 3000;

// Add connection options
const mongooseOptions = {
  serverSelectionTimeoutMS: 10000, // Increase timeout to 10s
  family: 4,
};

if (process.env.NODE_ENV !== 'test') {
  mongoose
    .connect(MONGODB_URI, mongooseOptions)
    .then(() => {
      console.log('Connected to MongoDB');
      app.listen(PORT, () => {
        console.log(`Server is running on port ${PORT}`);
      });
    })
    .catch((error) => {
      console.error('MongoDB connection error:', error);
      process.exit(1);
    });
}

export default app;