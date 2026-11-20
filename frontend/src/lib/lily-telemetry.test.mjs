// Run: npm test
import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTelemetry, getTelemetry, publishTelemetry, subscribeTelemetry } from './lily-telemetry.ts';

test('with no data the chip says standby and the readout is empty', () => {
  assert.deepEqual(formatTelemetry(null), { chip: '> STANDBY', percent: null, x: 'X_—', y: 'Y_—', z: 'Z_—' });
});

test('while the scene starts up the chip shows a rounded percentage', () => {
  const f = formatTelemetry({ progress: 0.834, azimuth: 0, elevation: 0, distance: 0 });
  assert.equal(f.chip, '> RENDERING');
  assert.equal(f.percent, '83%');
});

test('progress is clamped to 0..100 %', () => {
  assert.equal(formatTelemetry({ progress: 2, azimuth: 0, elevation: 0, distance: 0 }).chip, '> LIVE');
  assert.equal(formatTelemetry({ progress: -1, azimuth: 0, elevation: 0, distance: 0 }).percent, '0%');
});

test('when ready the chip says live and the readout shows the camera values with 4 decimals', () => {
  const f = formatTelemetry({ progress: 1, azimuth: 36.17491, elevation: -86.76764, distance: 46.6827 });
  assert.equal(f.chip, '> LIVE');
  assert.equal(f.percent, null);
  assert.deepEqual([f.x, f.y, f.z], ['X_36.1749', 'Y_-86.7676', 'Z_46.6827']);
});

test('publish notifies subscribers once per change and unsubscribe stops it', () => {
  let calls = 0;
  const off = subscribeTelemetry(() => calls++);
  publishTelemetry({ progress: 0.5, azimuth: 1, elevation: 2, distance: 3 });
  assert.equal(calls, 1);
  assert.equal(getTelemetry().progress, 0.5);
  off();
  publishTelemetry(null);
  assert.equal(calls, 1);
  assert.equal(getTelemetry(), null);
});
