import request from 'supertest';
import app from '../index';
import { User } from '../models/User';
import { getAuthToken } from './setup';
import { describe, beforeEach, it, expect } from '@jest/globals';

describe('User Routes', () => {
  let testUser: any;
  let token: string;

  beforeEach(async () => {
    // Clear collections
    await User.deleteMany({});

    // Create test user
    token = await getAuthToken();
    testUser = await User.findOne({ email: 'test@example.com' });
  });

  describe('GET /api/users/me', () => {
    it('should get current user information', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.user.email).toBe(testUser.email);
      expect(response.body.data.user.firstName).toBe(testUser.firstName);
      expect(response.body.data.user.lastName).toBe(testUser.lastName);
      expect(response.body.data.user.age).toBe(testUser.age);
      expect(response.body.data.user.password).toBeUndefined();
    });

    it('should not get user information without authentication', async () => {
      const response = await request(app)
        .get('/api/users/me')
        .expect(401);

      expect(response.body.status).toBe('fail');
    });
  });

  describe('PATCH /api/users/me', () => {
    it('should update user information', async () => {
      const updateData = {
        firstName: 'Updated',
        lastName: 'Name',
        age: 30,
      };

      const response = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.user.firstName).toBe(updateData.firstName);
      expect(response.body.data.user.lastName).toBe(updateData.lastName);
      expect(response.body.data.user.age).toBe(updateData.age);

      // Verify changes in database
      const updatedUser = await User.findById(testUser._id);
      expect(updatedUser?.firstName).toBe(updateData.firstName);
      expect(updatedUser?.lastName).toBe(updateData.lastName);
      expect(updatedUser?.age).toBe(updateData.age);
    });

    it('should not update password with wrong current password', async () => {
      const updateData = {
        currentPassword: 'wrongpassword',
        newPassword: 'newpassword123',
      };

      const response = await request(app)
        .patch('/api/users/me')
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(400);

      expect(response.body.status).toBe('fail');
    });

    it('should not update user without authentication', async () => {
      const updateData = {
        firstName: 'Updated',
      };

      const response = await request(app)
        .patch('/api/users/me')
        .send(updateData)
        .expect(401);

      expect(response.body.status).toBe('fail');
    });
  });
}); 