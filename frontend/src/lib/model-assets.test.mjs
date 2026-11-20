// Run: npm test (Node's built-in runner; imports TS source via type stripping)
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildIframeSnippet,
  buildVmModelSnippet,
  DEFAULT_EMBED_ORIGIN,
  safeGlbFilename,
} from './model-assets.ts';

test('buildVmModelSnippet always includes the embed.js module script tag', () => {
  const single = buildVmModelSnippet({
    origin: 'https://lixyte.app',
    modelId: 'model-123',
    cdnBase: 'https://cdn.lixyte.app',
    embedKey: 'abc123key',
  });
  assert.ok(single.startsWith('<script type="module" src="https://lixyte.app/embed.js"></script>\n'));
  assert.ok(single.includes('model-id="model-123"'));
  assert.ok(single.includes('cdn-base="https://cdn.lixyte.app"'));
  assert.ok(single.includes(' key="abc123key"'));

  const multi = buildVmModelSnippet({
    origin: '',
    modelId: 'model-123',
    cdnBase: 'https://cdn.lixyte.app',
    multiline: true,
  });
  assert.ok(multi.startsWith(`<script type="module" src="${DEFAULT_EMBED_ORIGIN}/embed.js"></script>\n`));
  assert.ok(!multi.includes('key='));
});

test('buildIframeSnippet includes key only when provided', () => {
  const free = buildIframeSnippet({ origin: 'https://lixyte.app', modelId: 'm1' });
  assert.ok(free.includes('src="https://lixyte.app/embed/m1"'));

  const paid = buildIframeSnippet({ origin: 'https://lixyte.app', modelId: 'm1', embedKey: '  secret  ' });
  assert.ok(paid.includes('src="https://lixyte.app/embed/m1?key=secret"'));
});

test('safeGlbFilename preserves Thai and ASCII characters while stripping unsafe symbols', () => {
  assert.equal(safeGlbFilename('Cyberpunk Drone MK-II'), 'Cyberpunk_Drone_MK-II.glb');
  assert.equal(safeGlbFilename('โมเดล 3D ทดสอบ!@#'), 'โมเดล_3D_ทดสอบ.glb');
  assert.equal(safeGlbFilename('   ***   '), 'model.glb');
});
