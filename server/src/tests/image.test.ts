// server/src/tests/image.test.ts
import request from 'supertest';
import app from '../index';
import { User } from '../models/User';
import { Memory } from '../models/Memory';
import { getAuthToken } from './setup';
import { describe, beforeEach, it, expect } from '@jest/globals';

// Mock the summarization service
jest.mock('../services/summarizationService', () => ({
  BedrockSummarizationService: jest.fn().mockImplementation(() => ({
    summarizeMemories: jest.fn().mockResolvedValue('User has been enjoying outdoor activities and learning new skills.')
  }))
}));

// Mock Bedrock image generation
jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({
      body: new TextEncoder().encode(JSON.stringify({
        images: ['base64encodedimage']
      }))
    })
  })),
  InvokeModelCommand: jest.fn()
}));

// Mock S3 upload
jest.mock('@aws-sdk/client-s3', () => ({
  S3Client: jest.fn().mockImplementation(() => ({
    send: jest.fn().mockResolvedValue({})
  })),
  PutObjectCommand: jest.fn()
}));

describe('Enhanced Image Generation', () => {
  let testUser: any;
  let token: string;

  beforeEach(async () => {
    // Clear collections
    await User.deleteMany({});
    await Memory.deleteMany({});

    // Create test user with enhanced profile
    const enhancedUser = {
      email: 'test@example.com',
      password: 'password123',
      firstName: 'Test',
      lastName: 'User',
      age: 28,
      location: 'San Francisco, CA',
      bio: 'Software engineer who loves hiking and photography'
    };

    // Create user and get token
    await User.create(enhancedUser);
    token = await getAuthToken();
    testUser = await User.findOne({ email: 'test@example.com' });

    // Create some test memories
    await Memory.create([
      {
        title: 'Hiking in Yosemite',
        content: 'Amazing day hiking with friends in Yosemite National Park.',
        date: new Date('2024-01-15'),
        author: testUser._id
      },
      {
        title: 'Cooking Class',
        content: 'Took an Italian cooking class and learned to make authentic pasta.',
        date: new Date('2024-01-10'),
        author: testUser._id
      },
      {
        title: 'Photography Workshop',
        content: 'Attended a photography workshop in the city.',
        date: new Date('2024-01-05'),
        author: testUser._id
      }
    ]);
  });

  describe('POST /api/images/generate-enhanced', () => {
    it('should generate image with user context and memory summary', async () => {
      const imageRequest = {
        title: 'New Memory',
        content: 'This is a new memory about my day',
        date: new Date('2024-01-20'),
        userId: testUser._id.toString()
      };

      const response = await request(app)
        .post('/api/images/generate-enhanced')
        .set('Authorization', `Bearer ${token}`)
        .send(imageRequest)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.url).toBeDefined();
      expect(response.body.data.url).toContain('s3.amazonaws.com');
    });

    it('should handle missing user profile gracefully', async () => {
      // Create user with minimal profile
      const minimalUser = {
        email: 'minimal@example.com',
        password: 'password123',
        firstName: 'Minimal',
        lastName: 'User',
        age: 25
      };

      await User.create(minimalUser);
      const minimalToken = await getAuthToken();

      const minimalUserDoc = await User.findOne({ email: 'minimal@example.com' });
      if (!minimalUserDoc) {
        throw new Error('Minimal user not found');
      }
      
      const imageRequest = {
        title: 'New Memory',
        content: 'This is a new memory',
        date: new Date('2024-01-20'),
        userId: (minimalUserDoc._id as any).toString()
      };

      const response = await request(app)
        .post('/api/images/generate-enhanced')
        .set('Authorization', `Bearer ${minimalToken}`)
        .send(imageRequest)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.url).toBeDefined();
    });

    it('should handle user with no recent memories', async () => {
      // Create user with no memories
      const newUser = {
        email: 'new@example.com',
        password: 'password123',
        firstName: 'New',
        lastName: 'User',
        age: 30,
        location: 'New York, NY'
      };

      await User.create(newUser);
      const newToken = await getAuthToken();

      const newUserDoc = await User.findOne({ email: 'new@example.com' });
      if (!newUserDoc) {
        throw new Error('New user not found');
      }
      
      const imageRequest = {
        title: 'First Memory',
        content: 'This is my first memory',
        date: new Date('2024-01-20'),
        userId: (newUserDoc._id as any).toString()
      };

      const response = await request(app)
        .post('/api/images/generate-enhanced')
        .set('Authorization', `Bearer ${newToken}`)
        .send(imageRequest)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.url).toBeDefined();
    });

    it('should require authentication', async () => {
      const imageRequest = {
        title: 'New Memory',
        content: 'This is a new memory',
        date: new Date('2024-01-20'),
        userId: testUser._id.toString()
      };

      const response = await request(app)
        .post('/api/images/generate-enhanced')
        .send(imageRequest)
        .expect(401);

      expect(response.body.status).toBe('fail');
    });

    it('should validate required fields', async () => {
      const invalidRequest = {
        title: 'New Memory',
        // Missing content and date
        userId: testUser._id.toString()
      };

      const response = await request(app)
        .post('/api/images/generate-enhanced')
        .set('Authorization', `Bearer ${token}`)
        .send(invalidRequest)
        .expect(400);

      expect(response.body.status).toBe('fail');
      expect(response.body.message).toContain('required');
    });

    it('should handle summarization service failures gracefully', async () => {
      // Mock summarization service to fail
      const { BedrockSummarizationService } = require('../services/summarizationService');
      BedrockSummarizationService.mockImplementation(() => ({
        summarizeMemories: jest.fn().mockRejectedValue(new Error('Summarization failed'))
      }));

      const imageRequest = {
        title: 'New Memory',
        content: 'This is a new memory',
        date: new Date('2024-01-20'),
        userId: testUser._id.toString()
      };

      const response = await request(app)
        .post('/api/images/generate-enhanced')
        .set('Authorization', `Bearer ${token}`)
        .send(imageRequest)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.url).toBeDefined();
    });
  });

  describe('POST /api/images/regenerate-enhanced', () => {
    it('should regenerate image with enhanced context', async () => {
      const regenerateRequest = {
        title: 'New Memory',
        content: 'This is a new memory',
        date: new Date('2024-01-20'),
        userId: testUser._id.toString(),
        previousUrl: 'https://example.com/previous-image.jpg'
      };

      const response = await request(app)
        .post('/api/images/regenerate-enhanced')
        .set('Authorization', `Bearer ${token}`)
        .send(regenerateRequest)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.url).toBeDefined();
      expect(response.body.data.url).toContain('s3.amazonaws.com');
    });
  });
});