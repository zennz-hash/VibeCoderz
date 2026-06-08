import assert from 'node:assert/strict';
import test from 'node:test';
import { calculateRemaining, getQuotaLimit, isSubscriptionExpired } from './quota';

test('getQuotaLimit returns plan-specific PRD limits', () => {
  assert.equal(getQuotaLimit('FREE', 'prd'), 1);
  assert.equal(getQuotaLimit('PRO', 'prd'), 5);
  assert.equal(getQuotaLimit('PRO_MAX', 'prd'), 999999);
});

test('getQuotaLimit returns plan-specific code limits', () => {
  assert.equal(getQuotaLimit('FREE', 'code'), 5);
  assert.equal(getQuotaLimit('PRO', 'code'), 50);
  assert.equal(getQuotaLimit('PRO_MAX', 'code'), 999999);
});

test('unknown plans fall back to FREE limits', () => {
  assert.equal(getQuotaLimit('UNKNOWN', 'prd'), 1);
  assert.equal(getQuotaLimit('UNKNOWN', 'code'), 5);
});

test('calculateRemaining never returns a negative value', () => {
  assert.equal(calculateRemaining('FREE', 0, 'prd'), 1);
  assert.equal(calculateRemaining('FREE', 1, 'prd'), 0);
  assert.equal(calculateRemaining('FREE', 10, 'prd'), 0);
});

test('isSubscriptionExpired detects past activeUntil values only', () => {
  assert.equal(isSubscriptionExpired(null), false);
  assert.equal(isSubscriptionExpired(new Date(Date.now() + 60_000)), false);
  assert.equal(isSubscriptionExpired(new Date(Date.now() - 60_000)), true);
});
