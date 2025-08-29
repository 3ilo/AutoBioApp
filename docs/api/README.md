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
  "username": "string",
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

#### GET /users/:id
Get user profile by ID.

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
      "profile": {
        "bio": "string",
        "avatar": "string"
      }
    }
  }
}
```

#### PUT /users/:id
Update user profile.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "username": "string",
  "profile": {
    "bio": "string",
    "avatar": "string"
  }
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
      "profile": {
        "bio": "string",
        "avatar": "string"
      }
    }
  }
}
```

### Images

#### POST /images/generate
Generate AI image using AWS Bedrock.

**Headers:**
```
Authorization: Bearer <jwt_token>
```

**Request Body:**
```json
{
  "prompt": "string",
  "style": "string"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "imageUrl": "string",
    "prompt": "string"
  }
}
```

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
