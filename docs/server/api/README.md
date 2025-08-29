# AutoBio API Reference

Complete API documentation for the AutoBio backend server.

## Base URL
```
http://localhost:3000/api
```

## Authentication
Most endpoints require authentication via JWT token in the Authorization header:
```
Authorization: Bearer <jwt_token>
```

## Response Format
All API responses follow a consistent format:

### Success Response
```json
{
  "success": true,
  "data": {
    // Response data
  },
  "message": "Operation successful"
}
```

### Error Response
```json
{
  "success": false,
  "error": {
    "message": "Error description",
    "code": "ERROR_CODE"
  }
}
```

## Endpoints

### Authentication

#### POST /auth/register
Register a new user account.

**Request Body:**
```json
{
  "firstName": "string",
  "lastName": "string",
  "email": "string",
  "password": "string",
  "age": "number"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "string",
      "username": "string",
      "email": "string"
    },
    "token": "jwt_token"
  }
}
```

#### POST /auth/login
Authenticate user and receive JWT token.

**Request Body:**
```json
{
  "email": "string",
  "password": "string"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "string",
      "username": "string",
      "email": "string"
    },
    "token": "jwt_token"
  }
}
```

#### GET /auth/me
Get current authenticated user profile.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "user": {
      "id": "string",
      "username": "string",
      "email": "string",
      "profile": {
        "bio": "string",
        "avatar": "string"
      }
    }
  }
}
```

### Memories

#### GET /memories
Get all memories for the authenticated user.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Query Parameters:**
- `page` (number): Page number for pagination
- `limit` (number): Number of items per page
- `sort` (string): Sort field (date, title)
- `order` (string): Sort order (asc, desc)

**Response:**
```json
{
  "success": true,
  "data": {
    "memories": [
      {
        "id": "string",
        "title": "string",
        "content": "string",
        "date": "2024-01-01T00:00:00.000Z",
        "tags": ["string"],
        "images": ["string"],
        "createdAt": "2024-01-01T00:00:00.000Z",
        "updatedAt": "2024-01-01T00:00:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 100,
      "pages": 10
    }
  }
}
```

#### POST /memories
Create a new memory.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "title": "string",
  "content": "string",
  "date": "2024-01-01T00:00:00.000Z",
  "tags": ["string"],
  "images": ["string"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "memory": {
      "id": "string",
      "title": "string",
      "content": "string",
      "date": "2024-01-01T00:00:00.000Z",
      "tags": ["string"],
      "images": ["string"],
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

#### GET /memories/:id
Get a specific memory by ID.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "data": {
    "memory": {
      "id": "string",
      "title": "string",
      "content": "string",
      "date": "2024-01-01T00:00:00.000Z",
      "tags": ["string"],
      "images": ["string"],
      "createdAt": "2024-01-01T00:00:00.000Z",
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

#### PUT /memories/:id
Update an existing memory.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "title": "string",
  "content": "string",
  "date": "2024-01-01T00:00:00.000Z",
  "tags": ["string"],
  "images": ["string"]
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "memory": {
      "id": "string",
      "title": "string",
      "content": "string",
      "date": "2024-01-01T00:00:00.000Z",
      "tags": ["string"],
      "images": ["string"],
      "updatedAt": "2024-01-01T00:00:00.000Z"
    }
  }
}
```

#### DELETE /memories/:id
Delete a memory.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "success": true,
  "message": "Memory deleted successfully"
}
```

### Users

#### GET /users/profile
Get current user profile with enhanced fields.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "user": {
      "_id": "string",
      "firstName": "string",
      "lastName": "string",
      "email": "string",
      "age": "number",
      "avatar": "string",
      "bio": "string",
      "location": "string",
      "occupation": "string",
      "gender": "string",
      "interests": ["string"],
      "culturalBackground": "string",
      "preferredStyle": "string",
      "role": "string",
      "createdAt": "string",
      "updatedAt": "string"
    }
  }
}
```

#### PATCH /users/profile
Update user profile with enhanced fields.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "firstName": "string",
  "lastName": "string",
  "age": "number",
  "bio": "string",
  "location": "string",
  "avatar": "string",
  "occupation": "string",
  "gender": "string",
  "interests": ["string"],
  "culturalBackground": "string",
  "preferredStyle": "string"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "user": {
      "_id": "string",
      "firstName": "string",
      "lastName": "string",
      "email": "string",
      "age": "number",
      "avatar": "string",
      "bio": "string",
      "location": "string",
      "occupation": "string",
      "gender": "string",
      "interests": ["string"],
      "culturalBackground": "string",
      "preferredStyle": "string",
      "role": "string",
      "createdAt": "string",
      "updatedAt": "string"
    }
  }
}
```

**Enhanced Fields:**
- **location**: City, country for geographical context
- **occupation**: Job title/field for professional context
- **gender**: For personalized prompts
- **interests**: Array of hobbies and preferences
- **culturalBackground**: Cultural context
- **preferredStyle**: Artistic style preference

### Images

#### POST /images/generate
Generate AI image using AWS Bedrock with enhanced user context and memory summaries.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "title": "string",
  "content": "string", 
  "date": "string (ISO date)",
  "userId": "string (optional - for enhanced prompts)"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "url": "string"
  },
  "message": "Image generated successfully"
}
```

**Enhanced Features:**
- **User Context**: Incorporates user profile data (location, occupation, interests, etc.)
- **Memory Summaries**: Uses pre-generated memory summaries for context
- **Fallback**: Gracefully degrades to basic prompts if enhancement fails
- **Backward Compatibility**: Works with or without `userId` parameter

#### POST /images/regenerate
Regenerate AI image with enhanced context and variation request.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "title": "string",
  "content": "string",
  "date": "string (ISO date)",
  "previousUrl": "string",
  "userId": "string (optional - for enhanced prompts)"
}
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "url": "string"
  },
  "message": "Image regenerated successfully"
}
```

**Enhanced Features:**
- **Variation Generation**: Creates different variations while maintaining style
- **User Context**: Incorporates user profile data and memory summaries
- **Fallback**: Gracefully degrades to basic prompts if enhancement fails

#### POST /images/upload
Upload image to S3.

**Headers:**
```
Authorization: Bearer <jwt_token>
Content-Type: multipart/form-data
```

**Request Body:**
```
Form data with 'image' field containing file
```

**Response:**
```json
{
  "success": true,
  "data": {
    "imageUrl": "string",
    "filename": "string"
  }
}
```

## Error Codes

| Code | Description |
|------|-------------|
| `AUTHENTICATION_ERROR` | Invalid or missing authentication token |
| `AUTHORIZATION_ERROR` | User not authorized for this action |
| `VALIDATION_ERROR` | Request validation failed |
| `NOT_FOUND` | Resource not found |
| `DUPLICATE_ENTRY` | Resource already exists |
| `INTERNAL_ERROR` | Server internal error |

## Rate Limiting

API endpoints are rate-limited to prevent abuse:
- Authentication endpoints: 5 requests per minute
- Memory endpoints: 100 requests per minute
- Image generation: 10 requests per minute
- Image upload: 20 requests per minute
