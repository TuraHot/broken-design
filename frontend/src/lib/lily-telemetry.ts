// Real numbers from the hero scene (start-up progress and camera angles) for the status chip and the info box.
// The scene publishes them; nothing else invents values. With nothing published the hero shows "standby" and dashes.

export interface Telemetry {
  /** Start-up progress, 0..1; 1 means the scene is running. */
  progress: number;
  /** Camera values, in degrees (azimuth, elevation) and scene units (distance). */
  azimuth: number;
  elevation: number;
  distance: number;
}

export interface TelemetryText {
  chip: string;
  /** "83%" while starting up, otherwise null. */
  percent: string | null;
  x: string;
  y: string;
  z: string;
}

let current: Telemetry | null = null;
const listeners = new Set<() => void>();

export const getTelemetry = () => current;

export function publishTelemetry(next: Telemetry | null): void {
  current = next;
  listeners.forEach((l) => l());
}

export function subscribeTelemetry(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const fixed = (n: number) => n.toFixed(4);

export function formatTelemetry(t: Telemetry | null): TelemetryText {
  if (!t) return { chip: '> STANDBY', percent: null, x: 'X_—', y: 'Y_—', z: 'Z_—' };
  const progress = Math.min(1, Math.max(0, t.progress));
  const ready = progress >= 1;
  return {
    chip: ready ? '> LIVE' : '> RENDERING',
    percent: ready ? null : `${Math.round(progress * 100)}%`,
    x: `X_${fixed(t.azimuth)}`,
    y: `Y_${fixed(t.elevation)}`,
    z: `Z_${fixed(t.distance)}`,
  };
}
