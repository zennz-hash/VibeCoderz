import assert from 'node:assert/strict';
import test from 'node:test';
import { getCodeModelAttempts, getPrdModelAttempts, ROUTER9_MODEL_MAP } from './aiModels';

test('getPrdModelAttempts PRD Thinking returns Gemini Flash only', () => {
  const attempts = getPrdModelAttempts('PRD Thinking');

  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].model, ROUTER9_MODEL_MAP['PRD Thinking']);
  assert.equal(attempts[0].isPowerModel, false);
});

test('getPrdModelAttempts PRD Thinking Standard returns GPT-5.5 + Gemini fallback', () => {
  const attempts = getPrdModelAttempts('PRD Thinking Standard');

  assert.equal(attempts[0].model, ROUTER9_MODEL_MAP['PRD Thinking Standard']);
  assert.equal(attempts[0].model, 'cx/gpt-5.5');
  assert.equal(attempts[0].isPowerModel, true);
  assert.equal(attempts[1].model, ROUTER9_MODEL_MAP['PRD Thinking']);
});

test('getPrdModelAttempts PRD Thinking Max returns Sonnet, Opus, Gemini fallback chain', () => {
  const attempts = getPrdModelAttempts('PRD Thinking Max');

  assert.equal(attempts[0].model, 'kr/claude-sonnet-4.5');
  assert.equal(attempts[1].model, 'kr/claude-opus-4.7');
  assert.equal(attempts[2].model, ROUTER9_MODEL_MAP['PRD Thinking']);
  assert.equal(attempts[0].isPowerModel, true);
  assert.equal(attempts[1].isPowerModel, true);
  assert.equal(attempts[2].isPowerModel, false);
});

test('getPrdModelAttempts unknown label falls back to PRD Thinking', () => {
  const attempts = getPrdModelAttempts('Unknown Model');

  assert.equal(attempts[0].model, ROUTER9_MODEL_MAP['PRD Thinking']);
});

test('getCodeModelAttempts falls back from premium code providers to configured fast model', () => {
  const attempts = getCodeModelAttempts('Claude Opus 4.6');

  assert.equal(attempts[0].model, ROUTER9_MODEL_MAP['Claude Opus 4.6']);
  assert.equal(attempts[1].model, ROUTER9_MODEL_MAP['Gemini 3.5 Flash']);
});

test('getCodeModelAttempts does not duplicate fallback for default code model', () => {
  const attempts = getCodeModelAttempts('Gemini 3.5 Flash');

  assert.equal(attempts.length, 1);
  assert.equal(attempts[0].model, ROUTER9_MODEL_MAP['Gemini 3.5 Flash']);
});
