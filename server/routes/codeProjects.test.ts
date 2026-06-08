import assert from 'node:assert/strict';
import test from 'node:test';
import { publicProject, safeParseProjectJson } from './codeProjects';

test('safeParseProjectJson returns fallback for invalid JSON', () => {
  assert.deepEqual(safeParseProjectJson('{broken', { '/App.tsx': { code: '' } }), { '/App.tsx': { code: '' } });
  assert.deepEqual(safeParseProjectJson('', []), []);
});

test('publicProject does not throw when stored payload JSON is corrupted', () => {
  const project = publicProject({
    id: 'project-1',
    userId: 'user-1',
    name: 'Broken payload',
    filesJson: '{broken',
    messagesJson: '[broken',
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
  }, true);

  assert.deepEqual(project.files, {});
  assert.deepEqual(project.messages, []);
});
