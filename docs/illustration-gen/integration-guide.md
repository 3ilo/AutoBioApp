# Integration Guide

## Overview

This guide outlines how to integrate the new illustration generation system with the existing AutoBio application. The integration involves updating the current image generation workflow to use the enhanced SDXL + IP-Adapter + LoRA pipeline while maintaining backward compatibility.

## Current System Analysis

### Existing Image Generation Flow
```
User Input → Memory Creation → Bedrock API → Generated Image → Memory Storage
```

### Enhanced Flow
```
User Input → Memory Creation → Enhanced Prompt → SDXL Service → Generated Image → Memory Storage
                ↓
        Subject Reference Management
                ↓
        Style LoRA Application
```

## Backend Integration

### 1. Update Image Controller

```typescript
// server/src/controllers/imageController.ts
import { IllustrationGenerationService } from '../services/illustrationGenerationService';
import { SubjectReferenceService } from '../services/subjectReferenceService';

export class ImageController {
  private illustrationService: IllustrationGenerationService;
  private subjectReferenceService: SubjectReferenceService;

  constructor() {
    this.illustrationService = new IllustrationGenerationService();
    this.subjectReferenceService = new SubjectReferenceService();
  }

  async generateIllustration(req: Request, res: Response) {
    try {
      const { prompt, userId, memoryContext } = req.body;

      // 1. Get user's subject references
      const subjectReferences = await this.subjectReferenceService.getUserReferences(userId);

      // 2. Enhance prompt with memory context
      const enhancedPrompt = await this.enhancePrompt(prompt, memoryContext);

      // 3. Generate illustration with new pipeline
      const result = await this.illustrationService.generate({
        prompt: enhancedPrompt,
        subjectReferences,
        userId,
        memoryContext
      });

      // 4. Store generated image
      const imageUrl = await this.storeGeneratedImage(result.image, userId);

      res.json({
        success: true,
        imageUrl,
        generationId: result.generationId,
        metadata: result.metadata
      });

    } catch (error) {
      // Fallback to existing Bedrock approach
      return this.fallbackToBedrock(req, res);
    }
  }

  private async fallbackToBedrock(req: Request, res: Response) {
    // Existing Bedrock implementation
    // ... existing code ...
  }
}
```

### 2. New Services

#### Illustration Generation Service
```typescript
// server/src/services/illustrationGenerationService.ts
export class IllustrationGenerationService {
  private sdxlServiceUrl: string;

  constructor() {
    this.sdxlServiceUrl = process.env.SDXL_SERVICE_URL || 'http://localhost:8000';
  }

  async generate(params: {
    prompt: string;
    subjectReferences: SubjectReference[];
    userId: string;
    memoryContext?: MemoryContext;
  }): Promise<IllustrationResult> {
    
    const request = {
      prompt: params.prompt,
      subject_references: params.subjectReferences.map(ref => ({
        name: ref.name,
        image_url: ref.imageUrl
      })),
      user_id: params.userId,
      memory_context: params.memoryContext,
      style_scale: 0.8,
      content_scale: 1.0
    };

    const response = await fetch(`${this.sdxlServiceUrl}/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request)
    });

    if (!response.ok) {
      throw new Error(`SDXL service error: ${response.statusText}`);
    }

    return await response.json();
  }
}
```

#### Subject Reference Service
```typescript
// server/src/services/subjectReferenceService.ts
export class SubjectReferenceService {
  async getUserReferences(userId: string): Promise<SubjectReference[]> {
    // Query database for user's subject reference images
    const references = await SubjectReference.find({ userId });
    return references.map(ref => ({
      name: ref.name,
      imageUrl: ref.imageUrl,
      createdAt: ref.createdAt
    }));
  }

  async storeReference(userId: string, name: string, imageFile: Express.Multer.File): Promise<SubjectReference> {
    // Upload image to S3
    const imageUrl = await this.uploadToS3(imageFile, userId);
    
    // Store reference in database
    const reference = new SubjectReference({
      userId,
      name,
      imageUrl,
      createdAt: new Date()
    });

    return await reference.save();
  }
}
```

### 3. Database Schema Updates

```typescript
// server/src/models/SubjectReference.ts
import mongoose from 'mongoose';

const subjectReferenceSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  name: {
    type: String,
    required: true
  },
  imageUrl: {
    type: String,
    required: true
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

// Compound index for efficient queries
subjectReferenceSchema.index({ userId: 1, name: 1 });

export const SubjectReference = mongoose.model('SubjectReference', subjectReferenceSchema);
```

## Frontend Integration

### 1. Update API Service

```typescript
// client/src/services/api.ts
export class ApiService {
  // ... existing methods ...

  async generateIllustration(params: {
    prompt: string;
    memoryContext?: {
      title: string;
      content: string;
      date: string;
    };
  }): Promise<{ imageUrl: string; generationId: string }> {
    const response = await fetch(`${this.baseUrl}/api/illustrations/generate`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${this.getToken()}`
      },
      body: JSON.stringify(params)
    });

    if (!response.ok) {
      throw new Error('Failed to generate illustration');
    }

    return await response.json();
  }

  async uploadSubjectReference(name: string, imageFile: File): Promise<{ imageUrl: string }> {
    const formData = new FormData();
    formData.append('name', name);
    formData.append('image', imageFile);

    const response = await fetch(`${this.baseUrl}/api/subject-references`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${this.getToken()}`
      },
      body: formData
    });

    if (!response.ok) {
      throw new Error('Failed to upload subject reference');
    }

    return await response.json();
  }

  async getSubjectReferences(): Promise<SubjectReference[]> {
    const response = await fetch(`${this.baseUrl}/api/subject-references`, {
      headers: {
        'Authorization': `Bearer ${this.getToken()}`
      }
    });

    if (!response.ok) {
      throw new Error('Failed to fetch subject references');
    }

    return await response.json();
  }
}
```

### 2. Enhanced Contribute Page

```typescript
// client/src/pages/Contribute.tsx
import { useState, useEffect } from 'react';
import { SubjectReferenceSelector } from '../components/illustration/SubjectReferenceSelector';
import { StylePreferences } from '../components/illustration/StylePreferences';

export const Contribute: React.FC = () => {
  const [subjectReferences, setSubjectReferences] = useState<SubjectReference[]>([]);
  const [selectedReferences, setSelectedReferences] = useState<string[]>([]);
  const [stylePreferences, setStylePreferences] = useState<StylePreferences>({
    artisticStyle: 'watercolor',
    colorPalette: 'warm',
    mood: 'nostalgic'
  });

  useEffect(() => {
    loadSubjectReferences();
  }, []);

  const loadSubjectReferences = async () => {
    try {
      const references = await apiService.getSubjectReferences();
      setSubjectReferences(references);
    } catch (error) {
      console.error('Failed to load subject references:', error);
    }
  };

  const handleGenerateIllustration = async () => {
    try {
      setIsGenerating(true);
      
      const result = await apiService.generateIllustration({
        prompt: memoryForm.title + ': ' + memoryForm.content,
        memoryContext: {
          title: memoryForm.title,
          content: memoryForm.content,
          date: memoryForm.date
        }
      });

      setGeneratedImageUrl(result.imageUrl);
    } catch (error) {
      console.error('Failed to generate illustration:', error);
      // Fallback to existing generation method
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="contribute-page">
      {/* Existing memory form */}
      
      {/* New illustration controls */}
      <div className="illustration-section">
        <h3>Illustration Settings</h3>
        
        <SubjectReferenceSelector
          references={subjectReferences}
          selected={selectedReferences}
          onSelectionChange={setSelectedReferences}
        />
        
        <StylePreferences
          preferences={stylePreferences}
          onPreferencesChange={setStylePreferences}
        />
        
        <button 
          onClick={handleGenerateIllustration}
          disabled={isGenerating}
        >
          {isGenerating ? 'Generating...' : 'Generate Illustration'}
        </button>
      </div>
      
      {/* Generated image display */}
      {generatedImageUrl && (
        <div className="generated-image">
          <img src={generatedImageUrl} alt="Generated illustration" />
        </div>
      )}
    </div>
  );
};
```

### 3. New Components

#### Subject Reference Selector
```typescript
// client/src/components/illustration/SubjectReferenceSelector.tsx
interface SubjectReferenceSelectorProps {
  references: SubjectReference[];
  selected: string[];
  onSelectionChange: (selected: string[]) => void;
}

export const SubjectReferenceSelector: React.FC<SubjectReferenceSelectorProps> = ({
  references,
  selected,
  onSelectionChange
}) => {
  const handleToggle = (referenceId: string) => {
    const newSelected = selected.includes(referenceId)
      ? selected.filter(id => id !== referenceId)
      : [...selected, referenceId];
    onSelectionChange(newSelected);
  };

  return (
    <div className="subject-reference-selector">
      <h4>Subject References</h4>
      <div className="reference-grid">
        {references.map(reference => (
          <div 
            key={reference.id}
            className={`reference-item ${selected.includes(reference.id) ? 'selected' : ''}`}
            onClick={() => handleToggle(reference.id)}
          >
            <img src={reference.imageUrl} alt={reference.name} />
            <span>{reference.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
};
```

#### Style Preferences
```typescript
// client/src/components/illustration/StylePreferences.tsx
interface StylePreferencesProps {
  preferences: StylePreferences;
  onPreferencesChange: (preferences: StylePreferences) => void;
}

export const StylePreferences: React.FC<StylePreferencesProps> = ({
  preferences,
  onPreferencesChange
}) => {
  const updatePreference = (key: keyof StylePreferences, value: string) => {
    onPreferencesChange({
      ...preferences,
      [key]: value
    });
  };

  return (
    <div className="style-preferences">
      <h4>Style Preferences</h4>
      
      <div className="preference-group">
        <label>Artistic Style</label>
        <select 
          value={preferences.artisticStyle}
          onChange={(e) => updatePreference('artisticStyle', e.target.value)}
        >
          <option value="watercolor">Watercolor</option>
          <option value="digital">Digital Art</option>
          <option value="sketch">Sketch</option>
          <option value="painting">Oil Painting</option>
        </select>
      </div>
      
      <div className="preference-group">
        <label>Color Palette</label>
        <select 
          value={preferences.colorPalette}
          onChange={(e) => updatePreference('colorPalette', e.target.value)}
        >
          <option value="warm">Warm</option>
          <option value="cool">Cool</option>
          <option value="neutral">Neutral</option>
          <option value="vibrant">Vibrant</option>
        </select>
      </div>
      
      <div className="preference-group">
        <label>Mood</label>
        <select 
          value={preferences.mood}
          onChange={(e) => updatePreference('mood', e.target.value)}
        >
          <option value="nostalgic">Nostalgic</option>
          <option value="joyful">Joyful</option>
          <option value="peaceful">Peaceful</option>
          <option value="energetic">Energetic</option>
        </select>
      </div>
    </div>
  );
};
```

## Migration Strategy

### Phase 1: Parallel Implementation
- Deploy new SDXL service alongside existing Bedrock service
- Implement feature flags to control which service is used
- Add new UI components while keeping existing functionality

### Phase 2: Gradual Migration
- Enable new service for a subset of users
- Monitor performance and quality metrics
- Gather user feedback and iterate

### Phase 3: Full Migration
- Switch all users to new service
- Maintain Bedrock as fallback option
- Optimize performance and costs

### Phase 4: Enhancement
- Train and deploy custom LoRA
- Implement InstantStyle features
- Add advanced style controls

## Configuration Management

### Environment Variables
```bash
# New SDXL service configuration
SDXL_SERVICE_URL=http://localhost:8000
SDXL_SERVICE_TIMEOUT=30000
SDXL_FALLBACK_ENABLED=true

# Subject reference storage
S3_BUCKET_NAME=autobio-subject-references
S3_REGION=us-east-1

# Feature flags
ENABLE_ENHANCED_ILLUSTRATION=true
ENABLE_SUBJECT_REFERENCES=true
ENABLE_STYLE_PREFERENCES=true
```

### Feature Flags
```typescript
// server/src/config/featureFlags.ts
export const FEATURE_FLAGS = {
  ENHANCED_ILLUSTRATION: process.env.ENABLE_ENHANCED_ILLUSTRATION === 'true',
  SUBJECT_REFERENCES: process.env.ENABLE_SUBJECT_REFERENCES === 'true',
  STYLE_PREFERENCES: process.env.ENABLE_STYLE_PREFERENCES === 'true',
  SDXL_FALLBACK: process.env.SDXL_FALLBACK_ENABLED === 'true'
};
```

## Testing Strategy

### Unit Tests
- Test new services in isolation
- Mock external dependencies
- Validate error handling and fallbacks

### Integration Tests
- Test full pipeline from API to SDXL service
- Validate subject reference management
- Test style preference application

### End-to-End Tests
- Test complete user workflow
- Validate image generation quality
- Test fallback mechanisms

### Performance Tests
- Load test SDXL service
- Measure generation latency
- Test concurrent request handling

## Monitoring and Observability

### Metrics to Track
- Generation success rate
- Average generation time
- User satisfaction scores
- Cost per generation
- Fallback usage rate

### Logging
```typescript
// Enhanced logging for illustration generation
logger.info('Illustration generation started', {
  userId,
  prompt,
  subjectReferences: selectedReferences.length,
  stylePreferences,
  timestamp: new Date()
});

logger.info('Illustration generation completed', {
  userId,
  generationId,
  generationTime,
  success: true,
  imageUrl
});
```

### Alerts
- SDXL service downtime
- High error rates
- Generation time spikes
- Cost threshold exceeded

## Rollback Plan

### Immediate Rollback
- Feature flags to disable new service
- Automatic fallback to Bedrock
- Database rollback scripts

### Data Migration
- Export subject references
- Backup generated images
- Preserve user preferences

### Communication
- User notification of service changes
- Status page updates
- Support documentation updates
