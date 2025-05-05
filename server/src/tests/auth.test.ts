import request from 'supertest';
import app from '../index';
import { User } from '../models/User';
import { generateTestToken, getAuthToken } from './setup';
import { describe, beforeEach, it, expect, beforeAll, afterAll } from '@jest/globals';

describe('Auth Routes', () => {
  const testUser = {
    email: 'test@example.com',
    password: 'password123',
    firstName: 'Test',
    lastName: 'User',
    age: 25,
  };

  beforeEach(async () => {
    // Clear users collection before each test
    await User.deleteMany({});
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(201);

      expect(response.body.status).toBe('success');
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.token).toBeDefined();
    });

    it('should not register a user with existing email', async () => {
      // Create a user first
      await User.create(testUser);

      const response = await request(app)
        .post('/api/auth/register')
        .send(testUser)
        .expect(400);

      expect(response.body.status).toBe('fail');
      expect(response.body.message).toContain('Email already in use');
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a user for login tests
      await User.create(testUser);
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: testUser.password,
        })
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.token).toBeDefined();
    });

    it('should not login with invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: testUser.email,
          password: 'wrongpassword',
        })
        .expect(401);

      expect(response.body.status).toBe('fail');
      expect(response.body.message).toContain('Incorrect email or password');
    });
  });

  describe('GET /api/auth/me', () => {
    it('should get current user with valid token', async () => {
      const user = await User.create(testUser);
      const token = generateTestToken(user._id);

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.user.email).toBe(testUser.email);
    });

    it('should not get current user without token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .expect(401);

      expect(response.body.status).toBe('fail');
      expect(response.body.message).toContain('You are not logged in! Please log in to get access.');
    });
  });
}); 