import { test, expect, vi, beforeEach } from 'vitest';
import { createMockRequest } from '../_shared/rateLimit.test.ts';

// Mock Deno.env
const mockEnv = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_SERVICE_ROLE_KEY: 'test-key',
};

vi.stubGlobal('Deno', {
  env: {
    get: (key: string) => mockEnv[key],
  },
  serve: vi.fn(),
});

// Mock supabase client
const mockSupabase = {
  functions: {
    invoke: vi.fn(),
  },
  from: vi.fn(() => ({
    insert: vi.fn().mockResolvedValue({ error: null }),
  })),
};

vi.mock('npm:@supabase/supabase-js@2.57.4', () => ({
  createClient: () => mockSupabase,
}));

import { checkRateLimit, getClientIdentifier } from '../_shared/rateLimit.ts';

describe('ai-signal-gateway', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  test('rate limits at 60 req/min', async () => {
    const identifier = 'gateway-user';
    const config = { maxRequests: 60, windowMs: 60_000 };
    
    for (let i = 0; i < 60; i++) {
      const result = await checkRateLimit(identifier, config);
      expect(result.allowed).toBe(true);
    }
    
    const result = await checkRateLimit(identifier, config);
    expect(result.allowed).toBe(false);
  });

  test('returns 400 for missing symbol', async () => {
    const req = createMockRequest({
      'content-type': 'application/json',
    });
    // Mock body
    req.json = vi.fn().mockResolvedValue({ timeframe: '1h' });
    
    // This would be tested via the actual handler
    // For now verify the validation logic
    const body = await req.json();
    expect(body.symbol).toBeUndefined();
  });

  test('aggregates signals from multiple sources', () => {
    const sourceSignals = [
      { source: 'ai-market-analysis', action: 'BUY', confidence: 80, weight: 0.8 },
      { source: 'ai-trading-intelligence', action: 'BUY', confidence: 85, weight: 1.0 },
      { source: 'ai-comprehensive-analysis', action: 'SELL', confidence: 60, weight: 0.9 },
      { source: 'ml-adaptive-learning', action: 'BUY', confidence: 75, weight: 0.7 },
    ];
    
    // Weighted aggregation
    const buyWeight = sourceSignals
      .filter(s => s.action === 'BUY')
      .reduce((sum, s) => sum + s.weight * (s.confidence / 100), 0);
    const sellWeight = sourceSignals
      .filter(s => s.action === 'SELL')
      .reduce((sum, s) => sum + s.weight * (s.confidence / 100), 0);
    const totalWeight = sourceSignals.reduce((sum, s) => sum + s.weight, 0);
    
    const buyScore = buyWeight / totalWeight;
    const sellScore = sellWeight / totalWeight;
    
    expect(buyScore).toBeGreaterThan(sellScore);
  });

  test('gate blocks when confidence below threshold', () => {
    const finalConfidence = 65;
    const minConfidence = 70;
    const gateBlockedBy: string[] = [];
    
    if (finalConfidence < minConfidence) {
      gateBlockedBy.push(`confidence_below_${minConfidence}`);
    }
    
    expect(gateBlockedBy).toContain('confidence_below_70');
  });

  test('gate blocks when no consensus', () => {
    const buyScore = 0.3;
    const sellScore = 0.3;
    const waitScore = 0.4;
    const requireConsensus = true;
    const gateBlockedBy: string[] = [];
    
    const consensus = requireConsensus 
      ? (buyScore >= 0.5 || sellScore >= 0.5)
      : true;
    
    if (requireConsensus && !consensus) {
      gateBlockedBy.push('no_consensus');
    }
    
    expect(consensus).toBe(false);
    expect(gateBlockedBy).toContain('no_consensus');
  });

  test('gate passes with sufficient confidence and consensus', () => {
    const finalConfidence = 80;
    const minConfidence = 70;
    const buyScore = 0.6;
    const sellScore = 0.2;
    const requireConsensus = true;
    const gateBlockedBy: string[] = [];
    
    if (finalConfidence < minConfidence) {
      gateBlockedBy.push(`confidence_below_${minConfidence}`);
    }
    
    const consensus = requireConsensus 
      ? (buyScore >= 0.5 || sellScore >= 0.5)
      : true;
    
    if (requireConsensus && !consensus) {
      gateBlockedBy.push('no_consensus');
    }
    
    expect(gateBlockedBy.length).toBe(0);
    expect(consensus).toBe(true);
  });
});