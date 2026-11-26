import { test, expect } from 'bun:test';
import { createHmac } from 'node:crypto';
import { signBybitHmac } from './hmacSignature.ts';

test('standard Bybit key signs GET parameters with HMAC-SHA256 and v2 headers', async () => {
  const signature = await signBybitHmac('test-api-key', 'test-secret', 'accountType=UNIFIED', 1700000000000, '30000');
  const expected = createHmac('sha256', 'test-secret')
    .update('1700000000000test-api-key30000accountType=UNIFIED').digest('hex');
  expect(signature).toEqual({ sign: expected, type: '2' });
});

test('standard Bybit key signs the exact POST JSON body', async () => {
  const body = '{"category":"linear","symbol":"BTCUSDT","qty":"0.001"}';
  const signature = await signBybitHmac('test-api-key', 'test-secret', body, 1700000000001, '30000');
  expect(signature.sign).toBe(createHmac('sha256', 'test-secret')
    .update(`1700000000001test-api-key30000${body}`).digest('hex'));
});

test('missing HMAC secret fails instead of falling back to RSA', async () => {
  await expect(signBybitHmac('test-api-key', '', '', 1700000000000, '30000')).rejects.toThrow('Configure');
});