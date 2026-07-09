let ready = false;

export function markApplicationReady(): void {
  ready = true;
}

export function isApplicationReady(): boolean {
  return ready;
}

export function getReadinessStatus(): 'ready' | 'starting' {
  return ready ? 'ready' : 'starting';
}
