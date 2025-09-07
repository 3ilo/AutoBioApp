# Integration Guide

## 🚀 Current Status: **PRODUCTION READY**

The illustration generation service is fully operational and ready for integration with the AutoBio application. This guide provides step-by-step instructions for integrating the current working API.

## 📡 Current API Endpoints

### 1. Memory Illustration Generation
- **Endpoint**: `POST /v1/images/memory`
- **Purpose**: Generate illustrations using user avatars as IP-Adapter input
- **Status**: ✅ **Production Ready**

### 2. Subject Illustration Generation  
- **Endpoint**: `POST /v1/images/subject`
- **Purpose**: Generate professional portraits from user photos
- **Status**: ✅ **Production Ready**

### 3. Health Check
- **Endpoint**: `GET /health/`
- **Purpose**: Service health monitoring
- **Status**: ✅ **Production Ready**

## 🔧 Integration Implementation

### Backend Integration

#### 1. Update AutoBio API Service

```typescript
// server/src/services/illustrationService.ts
export class IllustrationService {
  private sdxlServiceUrl: string;

  constructor() {
    this.sdxlServiceUrl = process.env.SDXL_SERVICE_URL || 'http://localhost:8000';
  }

  async generateMemoryIllustration(params: {
    userId: string;
    prompt: string;
    numInferenceSteps?: number;
    ipAdapterScale?: number;
    negativePrompt?: string;
    stylePrompt?: string;
  }): Promise<{ s3Uri: string }> {
    
    const request = {
      user_id: params.userId,
      prompt: params.prompt,
      num_inference_steps: params.numInferenceSteps || 50,
      ip_adapter_scale: params.ipAdapterScale || 0.33,
      negative_prompt: params.negativePrompt || "error, glitch, mistake",
      style_prompt: params.stylePrompt || "highest quality, monochrome, professional sketch, personal, nostalgic, clean"
    };

    const response = await fetch(`${this.sdxlServiceUrl}/v1/images/memory`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`SDXL service error: ${response.statusText}`);
    }

    const result = await response.json();
    return { s3Uri: result.data[0].s3_uri };
  }

  async generateSubjectIllustration(params: {
    userId: string;
    numInferenceSteps?: number;
    ipAdapterScale?: number;
    negativePrompt?: string;
    stylePrompt?: string;
  }): Promise<{ s3Uri: string }> {
    
    const request = {
      user_id: params.userId,
      num_inference_steps: params.numInferenceSteps || 50,
      ip_adapter_scale: params.ipAdapterScale || 0.33,
      negative_prompt: params.negativePrompt || "error, glitch, mistake",
      style_prompt: params.stylePrompt || "highest quality, professional sketch, monochrome"
    };

    const response = await fetch(`${this.sdxlServiceUrl}/v1/images/subject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`SDXL service error: ${response.statusText}`);
    }

    const result = await response.json();
    return { s3Uri: result.data[0].s3_uri };
  }

  async checkHealth(): Promise<{ status: string; message: string }> {
    const response = await fetch(`${this.sdxlServiceUrl}/health/`);
    
    if (!response.ok) {
      throw new Error(`Health check failed: ${response.statusText}`);
    }

    return await response.json();
  }
}
```

#### 2. Update Memory Controller

```typescript
// server/src/controllers/memoryController.ts
import { IllustrationService } from '../services/illustrationService';

export class MemoryController {
  private illustrationService: IllustrationService;

  constructor() {
    this.illustrationService = new IllustrationService();
  }

  async createMemory(req: Request, res: Response) {
    try {
      const { title, content, userId, generateIllustration } = req.body;

      // Create memory record
      const memory = await Memory.create({
        title,
        content,
        userId,
        createdAt: new Date()
      });

      // Generate illustration if requested
      if (generateIllustration) {
        try {
          const illustrationResult = await this.illustrationService.generateMemoryIllustration({
            userId,
            prompt: `${title}: ${content}`,
            numInferenceSteps: 50,
            ipAdapterScale: 0.33
          });

          // Update memory with illustration
          memory.illustrationS3Uri = illustrationResult.s3Uri;
          await memory.save();

          res.json({
            success: true,
            memory,
            illustration: {
              s3Uri: illustrationResult.s3Uri
            }
          });
        } catch (illustrationError) {
          console.error('Illustration generation failed:', illustrationError);
          
          // Return memory without illustration
          res.json({
            success: true,
            memory,
            illustration: null,
            illustrationError: 'Failed to generate illustration'
          });
        }
      } else {
        res.json({
          success: true,
          memory,
          illustration: null
        });
      }

    } catch (error) {
      console.error('Memory creation failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to create memory'
      });
    }
  }

  async generateSubjectPortrait(req: Request, res: Response) {
    try {
      const { userId } = req.params;
      const { numInferenceSteps, ipAdapterScale, stylePrompt } = req.body;

      const result = await this.illustrationService.generateSubjectIllustration({
        userId,
        numInferenceSteps,
        ipAdapterScale,
        stylePrompt
      });

      res.json({
        success: true,
        illustration: {
          s3Uri: result.s3Uri
        }
      });

    } catch (error) {
      console.error('Subject illustration generation failed:', error);
      res.status(500).json({
        success: false,
        error: 'Failed to generate subject illustration'
      });
    }
  }
}
```

#### 3. Add New Routes

```typescript
// server/src/routes/memory.ts
import express from 'express';
import { MemoryController } from '../controllers/memoryController';

const router = express.Router();
const memoryController = new MemoryController();

// Existing routes
router.post('/', memoryController.createMemory.bind(memoryController));

// New illustration routes
router.post('/:userId/illustrations/subject', memoryController.generateSubjectPortrait.bind(memoryController));

export default router;
```

### Frontend Integration

#### 1. Update API Service

```typescript
// client/src/services/api.ts
export class ApiService {
  private baseUrl: string;

  constructor() {
    this.baseUrl = process.env.REACT_APP_API_URL || 'http://localhost:3000';
  }

  async createMemory(params: {
    title: string;
    content: string;
    generateIllustration?: boolean;
  }): Promise<{ memory: any; illustration?: { s3Uri: string } }> {
    const response = await fetch(`${this.baseUrl}/api/memories`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getToken()}`
      },
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      throw new Error('Failed to create memory');
    }

    return await response.json();
  }

  async generateSubjectPortrait(userId: string, options?: {
    numInferenceSteps?: number;
    ipAdapterScale?: number;
    stylePrompt?: string;
  }): Promise<{ s3Uri: string }> {
    const response = await fetch(`${this.baseUrl}/api/memories/${userId}/illustrations/subject`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getToken()}`
      },
      body: JSON.stringify(options || {})
    });

    if (!response.ok) {
      throw new Error('Failed to generate subject portrait');
    }

    const result = await response.json();
    return { s3Uri: result.illustration.s3Uri };
  }

  private getToken(): string {
    return localStorage.getItem('authToken') || '';
  }
}
```

#### 2. Enhanced Memory Creation Component

```typescript
// client/src/components/MemoryForm.tsx
import React, { useState } from 'react';
import { ApiService } from '../services/api';

interface MemoryFormProps {
  onMemoryCreated: (memory: any) => void;
}

export const MemoryForm: React.FC<MemoryFormProps> = ({ onMemoryCreated }) => {
  const [formData, setFormData] = useState({
    title: '',
    content: '',
    generateIllustration: true
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [illustrationOptions, setIllustrationOptions] = useState({
    numInferenceSteps: 50,
    ipAdapterScale: 0.33,
    stylePrompt: 'highest quality, monochrome, professional sketch, personal, nostalgic, clean'
  });

  const apiService = new ApiService();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);

    try {
      const result = await apiService.createMemory({
        title: formData.title,
        content: formData.content,
        generateIllustration: formData.generateIllustration
      });

      onMemoryCreated(result.memory);
      
      if (result.illustration) {
        console.log('Illustration generated:', result.illustration.s3Uri);
      }

    } catch (error) {
      console.error('Failed to create memory:', error);
      alert('Failed to create memory. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="memory-form">
      <div className="form-group">
        <label htmlFor="title">Memory Title</label>
        <input
          type="text"
          id="title"
          value={formData.title}
          onChange={(e) => setFormData({ ...formData, title: e.target.value })}
          required
        />
      </div>

      <div className="form-group">
        <label htmlFor="content">Memory Content</label>
        <textarea
          id="content"
          value={formData.content}
          onChange={(e) => setFormData({ ...formData, content: e.target.value })}
          required
          rows={4}
        />
      </div>

      <div className="form-group">
        <label>
          <input
            type="checkbox"
            checked={formData.generateIllustration}
            onChange={(e) => setFormData({ ...formData, generateIllustration: e.target.checked })}
          />
          Generate Illustration
        </label>
      </div>

      {formData.generateIllustration && (
        <div className="illustration-options">
          <h4>Illustration Settings</h4>
          
          <div className="form-group">
            <label htmlFor="inferenceSteps">Inference Steps</label>
            <input
              type="number"
              id="inferenceSteps"
              min="10"
              max="100"
              value={illustrationOptions.numInferenceSteps}
              onChange={(e) => setIllustrationOptions({
                ...illustrationOptions,
                numInferenceSteps: parseInt(e.target.value)
              })}
            />
          </div>

          <div className="form-group">
            <label htmlFor="ipAdapterScale">IP Adapter Scale</label>
            <input
              type="range"
              id="ipAdapterScale"
              min="0.1"
              max="1.0"
              step="0.1"
              value={illustrationOptions.ipAdapterScale}
              onChange={(e) => setIllustrationOptions({
                ...illustrationOptions,
                ipAdapterScale: parseFloat(e.target.value)
              })}
            />
            <span>{illustrationOptions.ipAdapterScale}</span>
          </div>

          <div className="form-group">
            <label htmlFor="stylePrompt">Style Prompt</label>
            <textarea
              id="stylePrompt"
              value={illustrationOptions.stylePrompt}
              onChange={(e) => setIllustrationOptions({
                ...illustrationOptions,
                stylePrompt: e.target.value
              })}
              rows={2}
            />
          </div>
        </div>
      )}

      <button type="submit" disabled={isSubmitting}>
        {isSubmitting ? 'Creating Memory...' : 'Create Memory'}
      </button>
    </form>
  );
};
```

#### 3. Subject Portrait Generation Component

```typescript
// client/src/components/SubjectPortraitGenerator.tsx
import React, { useState } from 'react';
import { ApiService } from '../services/api';

interface SubjectPortraitGeneratorProps {
  userId: string;
}

export const SubjectPortraitGenerator: React.FC<SubjectPortraitGeneratorProps> = ({ userId }) => {
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState<string | null>(null);
  const [options, setOptions] = useState({
    numInferenceSteps: 50,
    ipAdapterScale: 0.33,
    stylePrompt: 'highest quality, professional sketch, monochrome'
  });

  const apiService = new ApiService();

  const handleGenerate = async () => {
    setIsGenerating(true);
    setGeneratedImage(null);

    try {
      const result = await apiService.generateSubjectPortrait(userId, options);
      setGeneratedImage(result.s3Uri);
    } catch (error) {
      console.error('Failed to generate subject portrait:', error);
      alert('Failed to generate subject portrait. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="subject-portrait-generator">
      <h3>Generate Subject Portrait</h3>
      
      <div className="options">
        <div className="form-group">
          <label htmlFor="inferenceSteps">Inference Steps</label>
          <input
            type="number"
            id="inferenceSteps"
            min="10"
            max="100"
            value={options.numInferenceSteps}
            onChange={(e) => setOptions({
              ...options,
              numInferenceSteps: parseInt(e.target.value)
            })}
          />
        </div>

        <div className="form-group">
          <label htmlFor="ipAdapterScale">IP Adapter Scale</label>
          <input
            type="range"
            id="ipAdapterScale"
            min="0.1"
            max="1.0"
            step="0.1"
            value={options.ipAdapterScale}
            onChange={(e) => setOptions({
              ...options,
              ipAdapterScale: parseFloat(e.target.value)
            })}
          />
          <span>{options.ipAdapterScale}</span>
        </div>

        <div className="form-group">
          <label htmlFor="stylePrompt">Style Prompt</label>
          <textarea
            id="stylePrompt"
            value={options.stylePrompt}
            onChange={(e) => setOptions({
              ...options,
              stylePrompt: e.target.value
            })}
            rows={2}
          />
        </div>
      </div>

      <button onClick={handleGenerate} disabled={isGenerating}>
        {isGenerating ? 'Generating...' : 'Generate Portrait'}
      </button>

      {generatedImage && (
        <div className="generated-image">
          <h4>Generated Portrait</h4>
          <img src={generatedImage} alt="Generated subject portrait" />
          <p>S3 URI: {generatedImage}</p>
        </div>
      )}
    </div>
  );
};
```

## 🔧 Configuration

### Environment Variables

#### AutoBio Backend (.env)
```bash
# SDXL Service Configuration
SDXL_SERVICE_URL=http://your-sdxl-service:8000
SDXL_SERVICE_TIMEOUT=60000

# S3 Configuration (for serving generated images)
AWS_ACCESS_KEY_ID=your-access-key
AWS_SECRET_ACCESS_KEY=your-secret-key
AWS_REGION=us-east-1
S3_BUCKET_NAME=auto-bio-illustrations

# Feature Flags
ENABLE_ILLUSTRATION_GENERATION=true
ENABLE_SUBJECT_PORTRAITS=true
```

#### Frontend (.env)
```bash
REACT_APP_API_URL=http://your-autobio-api:3000
REACT_APP_S3_BUCKET=auto-bio-illustrations
REACT_APP_S3_REGION=us-east-1
```

### Database Schema Updates

```sql
-- Add illustration fields to memories table
ALTER TABLE memories ADD COLUMN illustration_s3_uri VARCHAR(500);
ALTER TABLE memories ADD COLUMN illustration_generated_at TIMESTAMP;

-- Add subject references table
CREATE TABLE subject_references (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR(255) NOT NULL,
    name VARCHAR(255) NOT NULL,
    s3_uri VARCHAR(500) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_subject_references_user_id ON subject_references(user_id);
```

## 🧪 Testing Integration

### 1. Test Scripts

```bash
# Test memory illustration generation
curl -X POST "http://your-sdxl-service:8000/v1/images/memory" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test_user_123",
    "prompt": "A beautiful sunset over mountains",
    "num_inference_steps": 50,
    "ip_adapter_scale": 0.33,
    "negative_prompt": "blurry, low quality",
    "style_prompt": "highest quality, monochrome, professional sketch"
  }'

# Test subject illustration generation
curl -X POST "http://your-sdxl-service:8000/v1/images/subject" \
  -H "Content-Type: application/json" \
  -d '{
    "user_id": "test_user_123",
    "num_inference_steps": 50,
    "ip_adapter_scale": 0.33,
    "negative_prompt": "blurry, low quality",
    "style_prompt": "highest quality, professional sketch, monochrome"
  }'

# Test health check
curl -X GET "http://your-sdxl-service:8000/health/"
```

### 2. Integration Tests

```typescript
// tests/integration/illustration.test.ts
import { IllustrationService } from '../../src/services/illustrationService';

describe('Illustration Service Integration', () => {
  let illustrationService: IllustrationService;

  beforeEach(() => {
    illustrationService = new IllustrationService();
  });

  test('should generate memory illustration', async () => {
    const result = await illustrationService.generateMemoryIllustration({
      userId: 'test_user_123',
      prompt: 'A beautiful sunset over mountains',
      numInferenceSteps: 20, // Faster for testing
      ipAdapterScale: 0.33
    });

    expect(result.s3Uri).toMatch(/^s3:\/\/.+\/.+\.png$/);
  });

  test('should generate subject illustration', async () => {
    const result = await illustrationService.generateSubjectIllustration({
      userId: 'test_user_123',
      numInferenceSteps: 20, // Faster for testing
      ipAdapterScale: 0.33
    });

    expect(result.s3Uri).toMatch(/^s3:\/\/.+\/.+\.png$/);
  });

  test('should check service health', async () => {
    const health = await illustrationService.checkHealth();
    expect(health.status).toBe('healthy');
  });
});
```

## 🚀 Deployment

### 1. Deploy SDXL Service

```bash
# Build and deploy SDXL service
docker build -t illustration-gen-api .
docker run --gpus all -d \
  --name illustration-service \
  -p 8000:8000 \
  -e AWS_ACCESS_KEY_ID=your-key \
  -e AWS_SECRET_ACCESS_KEY=your-secret \
  -e S3_BUCKET_NAME=your-bucket \
  illustration-gen-api
```

### 2. Update AutoBio Backend

```bash
# Deploy updated AutoBio backend with illustration integration
docker build -t autobio-backend .
docker run -d \
  --name autobio-backend \
  -p 3000:3000 \
  -e SDXL_SERVICE_URL=http://illustration-service:8000 \
  -e AWS_ACCESS_KEY_ID=your-key \
  -e AWS_SECRET_ACCESS_KEY=your-secret \
  autobio-backend
```

### 3. Update Frontend

```bash
# Deploy updated frontend
npm run build
# Deploy to your hosting platform
```

## 📊 Monitoring

### Health Checks

```typescript
// Add to your monitoring system
const checkSDXLService = async () => {
  try {
    const response = await fetch('http://your-sdxl-service:8000/health/');
    const health = await response.json();
    
    if (health.status !== 'healthy') {
      console.error('SDXL service is unhealthy:', health);
      // Send alert
    }
  } catch (error) {
    console.error('SDXL service health check failed:', error);
    // Send alert
  }
};

// Run every 30 seconds
setInterval(checkSDXLService, 30000);
```

### Metrics Collection

```typescript
// Add metrics collection
const collectIllustrationMetrics = async (userId: string, prompt: string, generationTime: number) => {
  // Send to your metrics system
  console.log('Illustration generated', {
    userId,
    promptLength: prompt.length,
    generationTime,
    timestamp: new Date()
  });
};
```

## 🔄 Migration Strategy

### Phase 1: Parallel Deployment
1. Deploy SDXL service alongside existing system
2. Add feature flags to control illustration generation
3. Test with subset of users

### Phase 2: Gradual Rollout
1. Enable for 10% of users
2. Monitor performance and quality
3. Gradually increase to 100%

### Phase 3: Full Integration
1. Remove feature flags
2. Make illustration generation default
3. Optimize performance

## 🚨 Rollback Plan

### Immediate Rollback
```bash
# Disable illustration generation via feature flag
export ENABLE_ILLUSTRATION_GENERATION=false

# Restart AutoBio backend
docker restart autobio-backend
```

### Data Preservation
- Generated illustrations remain in S3
- Memory records preserve illustration S3 URIs
- No data loss during rollback

## 📚 Resources

- [SDXL Service API Documentation](http://your-sdxl-service:8000/docs)
- [FastAPI Documentation](https://fastapi.tiangolo.com/)
- [AWS S3 Documentation](https://docs.aws.amazon.com/s3/)
- [IP-Adapter Documentation](https://huggingface.co/docs/diffusers/en/using-diffusers/ip_adapter)