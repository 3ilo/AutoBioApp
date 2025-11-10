# AutoBio Server

Backend API server for the AutoBio application, providing authentication, memory management, user profiles, and AI-powered image generation services.

## Features

- **Authentication**: JWT-based user authentication and authorization
- **Memory Management**: CRUD operations for user memories with rich content
- **User Profiles**: User account management and profile customization
- **AI Integration**: AWS Bedrock integration for AI-powered image generation
- **File Storage**: AWS S3 integration for image and media storage
- **RESTful API**: Clean, documented API endpoints
- **Testing**: Comprehensive test suite with Jest
- **Logging**: Structured logging with Winston
- **Error Handling**: Centralized error handling and validation

## Tech Stack

- **Runtime**: Node.js with TypeScript
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (jsonwebtoken)
- **File Upload**: Multer
- **AI Services**: AWS Bedrock Runtime
- **Storage**: AWS S3
- **Testing**: Jest with Supertest
- **Logging**: Winston
- **Development**: ts-node-dev for hot reloading

## Project Structure

```
server/
├── src/
│   ├── controllers/     # Request handlers
│   ├── models/         # MongoDB schemas
│   ├── routes/         # API route definitions
│   ├── utils/          # Utility functions
│   ├── middleware/     # Express middleware
│   ├── tests/          # Test files
│   └── index.ts        # Application entry point
├── config/             # Configuration files
├── logs/               # Application logs
└── package.json        # Dependencies and scripts
```

## Quick Start

### Prerequisites

- Node.js (v14 or higher)
- MongoDB instance
- AWS account (for AI and storage services)

### Installation

1. Install dependencies:
```bash
npm install
```

2. Set up environment variables:
```bash
cp .env.example .env
```

3. Configure your `.env` file with required values:
```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/autobio
JWT_SECRET=your-secret-key
JWT_EXPIRES_IN=7d
# Backend AWS Credentials (for local development only)
# Note: Lambda uses IAM role - these are only for local dev
BACKEND_AWS_KEY=your-backend-aws-access-key
BACKEND_AWS_SECRET=your-backend-aws-secret-key
AWS_CLIENT_REGION=us-east-1
AWS_S3_BUCKET=your-s3-bucket
```

4. Start development server:
```bash
npm run dev
```

The server will be available at `http://localhost:3000`

## Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build TypeScript to JavaScript
- `npm run start` - Start production server
- `npm run lint` - Run ESLint
- `npm run type-check` - Run TypeScript type checking
- `npm run test` - Run test suite
- `npm run test:watch` - Run tests in watch mode
- `npm run test:coverage` - Run tests with coverage report

## API Documentation

### Authentication Endpoints
- `POST /api/auth/register` - User registration
- `POST /api/auth/login` - User login
- `GET /api/auth/me` - Get current user profile

### Memory Endpoints
- `GET /api/memories` - Get user memories
- `POST /api/memories` - Create new memory
- `GET /api/memories/:id` - Get specific memory
- `PUT /api/memories/:id` - Update memory
- `DELETE /api/memories/:id` - Delete memory

### User Endpoints
- `GET /api/users/:id` - Get user profile
- `PUT /api/users/:id` - Update user profile

### Image Endpoints
- `POST /api/images/generate` - Generate AI image
- `POST /api/images/upload` - Upload image

## Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `PORT` | Server port | No (default: 3000) |
| `MONGODB_URI` | MongoDB connection string | Yes |
| `JWT_SECRET` | JWT signing secret | Yes |
| `JWT_EXPIRES_IN` | JWT token expiration | No (default: 7d) |
| `BACKEND_AWS_KEY` | Backend AWS access key (local dev only) | No (only for local dev) |
| `BACKEND_AWS_SECRET` | Backend AWS secret key (local dev only) | No (only for local dev) |
| `AWS_CLIENT_REGION` | AWS region | Yes |
| `AWS_S3_BUCKET` | S3 bucket name | Yes |
| `NODE_ENV` | Environment (development/production) | No |

## Testing

The server includes comprehensive tests for all major functionality:

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run specific test file
npm run test:suite --test=auth
```

## Deployment

### Production Build

1. Build the application:
```bash
npm run build
```

2. Start the production server:
```bash
npm start
```

### Docker Deployment

```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY dist ./dist
EXPOSE 3000
CMD ["npm", "start"]
```

## Contributing

1. Follow the existing code style and patterns
2. Add tests for new functionality
3. Update documentation for API changes
4. Ensure all tests pass before submitting

## License

This project is licensed under the MIT License.
