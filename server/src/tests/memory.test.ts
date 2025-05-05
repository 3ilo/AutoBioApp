import request from 'supertest';
import app from '../index';
import { User } from '../models/User';
import { Memory } from '../models/Memory';
import { getAuthToken } from './setup';
import { describe, beforeEach, it, expect, beforeAll, afterAll } from '@jest/globals';

describe('Memory Routes', () => {
  let testUser: any;
  let token: string;
  let testMemory: any;

  beforeEach(async () => {
    // Clear collections
    await User.deleteMany({});
    await Memory.deleteMany({});

    // Get auth token (this will create the test user)
    token = await getAuthToken();
    testUser = await User.findOne({ email: 'test@example.com' });

    // Create test memory
    testMemory = {
      title: 'Test Memory',
      content: 'This is a test memory',
      date: new Date(),
      images: [],
      tags: ['test'],
      isPublic: true,
    };
  });

  describe('POST /api/memories', () => {
    it('should create a new memory', async () => {
      const response = await request(app)
        .post('/api/memories')
        .set('Authorization', `Bearer ${token}`)
        .send(testMemory)
        .expect(201);

      expect(response.body.status).toBe('success');
      expect(response.body.data.memory.title).toBe(testMemory.title);
      expect(response.body.data.memory.author.toString()).toBe(testUser._id.toString());
    });

    it('should not create memory without authentication', async () => {
      const response = await request(app)
        .post('/api/memories')
        .send(testMemory)
        .expect(401);

      expect(response.body.status).toBe('fail');
    });
  });

  describe('GET /api/memories', () => {
    beforeEach(async () => {
      // Create some test memories
      await Memory.create([
        { ...testMemory, author: testUser._id },
        { ...testMemory, title: 'Public Memory', isPublic: true, author: testUser._id },
        { ...testMemory, title: 'Private Memory', isPublic: false, author: testUser._id },
      ]);
    });

    it('should fail for unauthenticated user', async () => {
      const response = await request(app)
        .get('/api/memories')
        .expect(401);

      expect(response.body.status).toBe('fail');
    });

    it('should get all memories for authenticated user', async () => {
      const response = await request(app)
        .get('/api/memories')
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.length).toBe(3); // All memories including private ones
    });
  });

  describe('GET /api/memories/:id', () => {
    let memoryId: string;

    beforeEach(async () => {
      const memory = await Memory.create({
        ...testMemory,
        author: testUser._id,
      });
      memoryId = memory._id.toString();
    });

    it('should deny unauthorized user', async () => {
      const response = await request(app)
        .get(`/api/memories/${memoryId}`)
        .expect(401);

      expect(response.body.status).toBe('fail');
    });

    it('should get a memory with authentication', async () => {

      const response = await request(app)
        .get(`/api/memories/${memoryId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.memory._id).toBe(memoryId);
    });
  });

  describe('PATCH /api/memories/:id', () => {
    let memoryId: string;

    beforeEach(async () => {
      const memory = await Memory.create({
        ...testMemory,
        author: testUser._id,
      });
      memoryId = memory._id.toString();
    });

    it('should update a memory', async () => {
      const updateData = {
        title: 'Updated Memory',
        content: 'Updated content',
      };

      const response = await request(app)
        .patch(`/api/memories/${memoryId}`)
        .set('Authorization', `Bearer ${token}`)
        .send(updateData)
        .expect(200);

      expect(response.body.status).toBe('success');
      expect(response.body.data.memory.title).toBe(updateData.title);
      expect(response.body.data.memory.content).toBe(updateData.content);
    });

    it('should not update another user\'s memory', async () => {
      const otherUser = await User.create({
        email: 'other@example.com',
        password: 'password123',
        firstName: 'Other',
        lastName: 'User',
        age: 30,
      });

      const otherMemory = await Memory.create({
        ...testMemory,
        author: otherUser._id,
      });

      console.log("Other memory: ", otherMemory.toObject()._id);

      const response = await request(app)
        .patch(`/api/memories/${otherMemory.toObject()._id}`)
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 'Updated Memory' })
        .expect(404);

      expect(response.body.status).toBe('fail');
    });
  });

  describe('DELETE /api/memories/:id', () => {
    let memoryId: string;

    beforeEach(async () => {
      const memory = await Memory.create({
        ...testMemory,
        author: testUser._id,
      });
      memoryId = memory._id.toString();
    });

    it('should delete a memory', async () => {
      const response = await request(app)
        .delete(`/api/memories/${memoryId}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(204);

      // Verify memory is deleted
      const deletedMemory = await Memory.findById(memoryId);
      expect(deletedMemory).toBeNull();
    });

    it('should not delete another user\'s memory', async () => {
      const otherUser = await User.create({
        email: 'other@example.com',
        password: 'password123',
        firstName: 'Other',
        lastName: 'User',
        age: 30,
      });

      const otherMemory = await Memory.create({
        ...testMemory,
        author: otherUser._id,
      });

      const response = await request(app)
        .delete(`/api/memories/${otherMemory._id}`)
        .set('Authorization', `Bearer ${token}`)
        .expect(404);

      expect(response.body.status).toBe('fail');
    });
  });
}); 