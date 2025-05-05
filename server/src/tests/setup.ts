import { MongoMemoryServer } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import jwt from 'jsonwebtoken';
import { beforeAll, afterAll, afterEach } from '@jest/globals';
import request from 'supertest';
import app from '../index';
import { User } from '../models/User';

let mongod: MongoMemoryServer;
let isConnected = false;

// Singleton pattern for database connection
const connectToDatabase = async () => {
  console.log('Connecting to database');
  if (isConnected) {
    return;
  }

  // Create a new MongoDB instance
  mongod = await MongoMemoryServer.create();
  const uri = mongod.getUri();
  
  // Connect to the in-memory database
  await mongoose.connect(uri);
  isConnected = true;
};

// Global setup
beforeAll(async () => {
  await connectToDatabase();
});

// Clean up after each test
afterEach(async () => {
  // Clear all collections
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// Global teardown
afterAll(async () => {
  // Close the MongoDB connection and stop the server
  await mongoose.connection.close();
  await mongod.stop();
  isConnected = false;
});

// Helper function to create a test user and get their auth token
export const getAuthToken = async () => {
  const testUser = {
    email: 'test@example.com',
    password: 'password123',
    firstName: 'Test',
    lastName: 'User',
    age: 25,
  };

  // Create the user
  await User.create(testUser);

  // Login to get the token
  const response = await request(app)
    .post('/api/auth/login')
    .send({
      email: testUser.email,
      password: testUser.password,
    });

  if (response.status !== 200) {
    throw new Error('Failed to get auth token');
  }

  return response.body.data.token;
};

// Helper function to generate a test JWT token
export const generateTestToken = (userId: unknown) => {
  return jwt.sign({ id: userId }, process.env.JWT_SECRET || 'test-secret', {
    expiresIn: '1h',
  });
}; 