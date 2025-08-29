// server/src/tests/summarization.test.ts
import { IMemory } from '../../../shared/types/Memory';
import { IUser } from '../../../shared/types/User';

// Mock the summarization service since it doesn't exist yet
jest.mock('../services/summarizationService', () => ({
  BedrockSummarizationService: jest.fn().mockImplementation(() => ({
    summarizeMemories: jest.fn().mockResolvedValue('User has been enjoying outdoor activities and learning new skills.'),
    getCacheKey: jest.fn().mockReturnValue('test-cache-key')
  }))
}));

// Mock Bedrock client
jest.mock('@aws-sdk/client-bedrock-runtime', () => ({
  BedrockRuntimeClient: jest.fn().mockImplementation(() => ({
    send: jest.fn()
  })),
  InvokeModelCommand: jest.fn()
}));

describe('BedrockSummarizationService', () => {
  let summarizationService: any;
  let mockBedrockClient: any;

  const mockUser: Partial<IUser> = {
    _id: 'user123',
    firstName: 'Test',
    lastName: 'User',
    email: 'test@example.com',
    location: 'San Francisco, CA',
    age: 28,
    bio: 'Software engineer who loves hiking and photography'
  };

  const mockMemories: Partial<IMemory>[] = [
    {
      _id: 'memory1',
      title: 'Hiking in Yosemite',
      content: 'Amazing day hiking with friends in Yosemite National Park. The views were incredible and we saw some wildlife.',
      date: new Date('2024-01-15'),
      author: { _id: 'user123' } as IUser
    },
    {
      _id: 'memory2',
      title: 'Cooking Class',
      content: 'Took an Italian cooking class and learned to make authentic pasta. The instructor was fantastic.',
      date: new Date('2024-01-10'),
      author: { _id: 'user123' } as IUser
    },
    {
      _id: 'memory3',
      title: 'Photography Workshop',
      content: 'Attended a photography workshop in the city. Learned new techniques for street photography.',
      date: new Date('2024-01-05'),
      author: { _id: 'user123' } as IUser
    }
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    summarizationService = new BedrockSummarizationService();
    mockBedrockClient = summarizationService['bedrockClient'];
  });

  describe('summarizeMemories', () => {
    it('should generate a summary when memories are provided', async () => {
      const mockResponse = {
        body: new TextEncoder().encode(JSON.stringify({
          completion: 'Test user has been enjoying outdoor activities like hiking in Yosemite, learning new skills through cooking classes, and developing photography techniques through workshops.'
        }))
      };

      mockBedrockClient.send.mockResolvedValue(mockResponse);

      const result = await summarizationService.summarizeMemories(
        mockMemories as IMemory[],
        mockUser as IUser,
        { maxMemories: 5, summaryLength: 'paragraph' }
      );

      expect(result).toBe('Test user has been enjoying outdoor activities like hiking in Yosemite, learning new skills through cooking classes, and developing photography techniques through workshops.');
      expect(mockBedrockClient.send).toHaveBeenCalledTimes(1);
    });

    it('should return empty string when no memories are provided', async () => {
      const result = await summarizationService.summarizeMemories(
        [],
        mockUser as IUser,
        { maxMemories: 5, summaryLength: 'paragraph' }
      );

      expect(result).toBe('');
      expect(mockBedrockClient.send).not.toHaveBeenCalled();
    });

    it('should limit memories to maxMemories parameter', async () => {
      const manyMemories = Array.from({ length: 10 }, (_, i) => ({
        ...mockMemories[0],
        _id: `memory${i}`,
        title: `Memory ${i}`
      }));

      const mockResponse = {
        body: new TextEncoder().encode(JSON.stringify({
          completion: 'Summary of 5 memories'
        }))
      };

      mockBedrockClient.send.mockResolvedValue(mockResponse);

      await summarizationService.summarizeMemories(
        manyMemories as IMemory[],
        mockUser as IUser,
        { maxMemories: 5, summaryLength: 'paragraph' }
      );

      const callArgs = mockBedrockClient.send.mock.calls[0][0];
      const prompt = JSON.parse(callArgs.body).prompt;
      
      // Should only include 5 memories in the prompt
      expect(prompt).toContain('Memory 0');
      expect(prompt).toContain('Memory 4');
      expect(prompt).not.toContain('Memory 5');
    });

    it('should handle Bedrock API errors gracefully', async () => {
      mockBedrockClient.send.mockRejectedValue(new Error('API Error'));

      const result = await summarizationService.summarizeMemories(
        mockMemories as IMemory[],
        mockUser as IUser,
        { maxMemories: 5, summaryLength: 'paragraph' }
      );

      expect(result).toBe('no recent memories available');
    });

    it('should include user context in the prompt', async () => {
      const mockResponse = {
        body: new TextEncoder().encode(JSON.stringify({
          completion: 'Summary'
        }))
      };

      mockBedrockClient.send.mockResolvedValue(mockResponse);

      await summarizationService.summarizeMemories(
        mockMemories as IMemory[],
        mockUser as IUser,
        { maxMemories: 5, summaryLength: 'paragraph' }
      );

      const callArgs = mockBedrockClient.send.mock.calls[0][0];
      const prompt = JSON.parse(callArgs.body).prompt;
      
      expect(prompt).toContain('San Francisco, CA');
      expect(prompt).toContain('28');
      expect(prompt).toContain('Software engineer');
    });

    it('should handle missing user profile fields gracefully', async () => {
      const minimalUser = {
        _id: 'user123',
        firstName: 'Test',
        lastName: 'User',
        email: 'test@example.com',
        age: 25
      };

      const mockResponse = {
        body: new TextEncoder().encode(JSON.stringify({
          completion: 'Summary'
        }))
      };

      mockBedrockClient.send.mockResolvedValue(mockResponse);

      const result = await summarizationService.summarizeMemories(
        mockMemories as IMemory[],
        minimalUser as IUser,
        { maxMemories: 5, summaryLength: 'paragraph' }
      );

      expect(result).toBe('Summary');
      expect(mockBedrockClient.send).toHaveBeenCalledTimes(1);
    });
  });

  describe('getCacheKey', () => {
    it('should generate consistent cache keys for same inputs', () => {
      const key1 = summarizationService['getCacheKey'](
        mockMemories as IMemory[],
        mockUser as IUser,
        { maxMemories: 5, summaryLength: 'paragraph' }
      );

      const key2 = summarizationService['getCacheKey'](
        mockMemories as IMemory[],
        mockUser as IUser,
        { maxMemories: 5, summaryLength: 'paragraph' }
      );

      expect(key1).toBe(key2);
    });

    it('should generate different cache keys for different inputs', () => {
      const key1 = summarizationService['getCacheKey'](
        mockMemories as IMemory[],
        mockUser as IUser,
        { maxMemories: 5, summaryLength: 'paragraph' }
      );

      const key2 = summarizationService['getCacheKey'](
        mockMemories as IMemory[],
        mockUser as IUser,
        { maxMemories: 3, summaryLength: 'paragraph' }
      );

      expect(key1).not.toBe(key2);
    });
  });
});