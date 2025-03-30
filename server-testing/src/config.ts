import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.join(__dirname, '../../server/.env') });

export const API_URL = process.env.API_URL || 'http://localhost:3000/api';
export const TEST_USER = {
  email: 'test@example.com',
  password: 'password123',
  name: 'Test User',
  firstName: 'Test',
  lastName: 'User',
  age: 25
}; 