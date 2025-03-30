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

// Error handling middleware
app.use(handleError);

// Connect to MongoDB
const MONGODB_URI = process.env.MONGODB_URI as string;
const PORT = process.env.PORT || 3000;

// Add connection options
const mongooseOptions = {
  serverSelectionTimeoutMS: 10000, // Increase timeout to 10s
  family: 4,
};

// Debug MongoDB connection
mongoose.set('debug', true);
mongoose.set('strictQuery', false);

console.log('Attempting to connect to MongoDB...');
console.log('Using database:', MONGODB_URI.split('/').pop()?.split('?')[0]);

mongoose
  .connect(MONGODB_URI, mongooseOptions)
  .then(() => {
    console.log('Successfully connected to MongoDB');
    console.log('Connected to database:', mongoose.connection.name);
    
    app.listen(PORT, () => {
      console.log(`Server is running on port ${PORT}`);
      console.log(`API available at http://localhost:${PORT}`);
    });
  })
  .catch((error) => {
    console.error('MongoDB connection error details:');
    console.error('Error name:', error.name);
    console.error('Error message:', error.message);
    if (error.reason) {
      console.error('Error reason:', error.reason);
    }
    console.error('Please ensure:');
    console.error('1. Your IP address is whitelisted in MongoDB Atlas');
    console.error('2. Your username and password are correct');
    console.error('3. Your network can reach MongoDB Atlas');
    process.exit(1);
  });

// Handle unhandled promise rejections
process.on('unhandledRejection', (err: Error) => {
  console.error('Unhandled Rejection:', err);
  // Close server & exit process
  process.exit(1);
}); 