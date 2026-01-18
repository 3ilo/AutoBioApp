/**
 * Cost calculation utilities for AI API calls
 * Pricing based on current public rates (as of 2025)
 */

// AWS Bedrock Nova Micro pricing (On-Demand, per 1,000 tokens)
const BEDROCK_NOVA_MICRO_INPUT_COST_PER_1K = 0.000035; // $0.000035 per 1,000 input tokens
const BEDROCK_NOVA_MICRO_OUTPUT_COST_PER_1K = 0.00014; // $0.00014 per 1,000 output tokens

// OpenAI GPT-image-1.5 pricing (per 1 million tokens)
const OPENAI_TEXT_INPUT_COST_PER_1M = 5.0; // $5.00 per 1M text input tokens
const OPENAI_IMAGE_INPUT_COST_PER_1M = 8.0; // $8.00 per 1M image input tokens
const OPENAI_TEXT_OUTPUT_COST_PER_1M = 10.0; // $10.00 per 1M text output tokens
const OPENAI_IMAGE_OUTPUT_COST_PER_1M = 32.0; // $32.00 per 1M image output tokens

// OpenAI Images API per-image pricing (approximate, based on quality and size)
const OPENAI_IMAGE_COSTS: Record<string, Record<string, number>> = {
  low: {
    '1024x1024': 0.009,
    '1024x1536': 0.013,
    '1536x1024': 0.013,
  },
  medium: {
    '1024x1024': 0.034,
    '1024x1536': 0.05,
    '1536x1024': 0.05,
  },
  high: {
    '1024x1024': 0.133,
    '1024x1536': 0.20,
    '1536x1024': 0.20,
  },
};

export interface BedrockTokenUsage {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  cacheReadInputTokens?: number;
  cacheWriteInputTokens?: number;
}

export interface CostEstimate {
  inputCost: number;
  outputCost: number;
  totalCost: number;
  cacheSavings?: number;
}

/**
 * Calculate cost for Bedrock API call based on token usage
 * Uses Nova Micro pricing (most common model in this codebase)
 */
export function calculateBedrockCost(usage: BedrockTokenUsage): CostEstimate {
  const inputTokens = usage.inputTokens || 0;
  const outputTokens = usage.outputTokens || 0;
  const cacheReadTokens = usage.cacheReadInputTokens || 0;
  const cacheWriteTokens = usage.cacheWriteInputTokens || 0;

  // Calculate costs
  // Cache read tokens are typically billed at a lower rate, but for simplicity
  // we'll use the same rate and note cache savings separately
  const inputCost = ((inputTokens - cacheReadTokens) / 1000) * BEDROCK_NOVA_MICRO_INPUT_COST_PER_1K;
  const outputCost = (outputTokens / 1000) * BEDROCK_NOVA_MICRO_OUTPUT_COST_PER_1K;
  const cacheSavings = cacheReadTokens > 0 
    ? (cacheReadTokens / 1000) * BEDROCK_NOVA_MICRO_INPUT_COST_PER_1K 
    : undefined;

  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
    cacheSavings,
  };
}

/**
 * Estimate cost for OpenAI Images API call based on quality and size
 * Since token usage isn't returned, we use per-image pricing estimates
 */
export function estimateOpenAIImageCost(
  quality: 'low' | 'medium' | 'high',
  size: string
): number {
  const qualityKey = quality.toLowerCase();
  const sizeKey = size.toLowerCase();
  
  if (OPENAI_IMAGE_COSTS[qualityKey] && OPENAI_IMAGE_COSTS[qualityKey][sizeKey]) {
    return OPENAI_IMAGE_COSTS[qualityKey][sizeKey];
  }
  
  // Fallback to medium quality 1024x1024 if size/quality not found
  return OPENAI_IMAGE_COSTS.medium['1024x1024'];
}

/**
 * Format cost for display (rounds to 6 decimal places for small amounts)
 */
export function formatCost(cost: number): string {
  if (cost < 0.000001) {
    return `$${cost.toFixed(8)}`;
  } else if (cost < 0.01) {
    return `$${cost.toFixed(6)}`;
  } else {
    return `$${cost.toFixed(4)}`;
  }
}
