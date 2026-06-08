import assert from 'node:assert/strict';
import test from 'node:test';
import {
  ValidationError,
  asObject,
  readBoolean,
  readChatMessages,
  readString,
  readStringRecord,
} from './validation';

test('asObject accepts plain objects only', () => {
  assert.deepEqual(asObject({ ok: true }), { ok: true });
  assert.equal(asObject(null), null);
  assert.equal(asObject([]), null);
});

test('readString trims and validates required text', () => {
  assert.equal(readString({ name: '  VibeCoderz  ' }, 'name', { required: true }), 'VibeCoderz');
  assert.throws(() => readString({ name: '   ' }, 'name', { required: true }), ValidationError);
  assert.throws(() => readString({ name: 'abcdef' }, 'name', { max: 3 }), ValidationError);
});

test('readBoolean rejects non-boolean values', () => {
  assert.equal(readBoolean({ enabled: true }, 'enabled'), true);
  assert.equal(readBoolean({}, 'enabled', true), true);
  assert.throws(() => readBoolean({ enabled: 'true' }, 'enabled'), ValidationError);
});

test('readStringRecord accepts string values only', () => {
  assert.deepEqual(readStringRecord({ stack: { frontend: ' React ' } }, 'stack'), { frontend: 'React' });
  assert.throws(() => readStringRecord({ stack: { frontend: 123 } }, 'stack'), ValidationError);
});

test('readChatMessages validates message shape and size', () => {
  assert.deepEqual(readChatMessages({
    messages: [{ role: 'user', content: 'Build a dashboard' }],
  }), [{ role: 'user', content: 'Build a dashboard' }]);

  assert.throws(() => readChatMessages({ messages: [] }), ValidationError);
  assert.throws(() => readChatMessages({ messages: [{ role: 'tool', content: 'x' }] }), ValidationError);
});
