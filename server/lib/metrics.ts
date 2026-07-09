type MetricsState = {
  totalRequests: number;
  errors: number;
  clientErrors4xx: number;
  serverErrors5xx: number;
  totalResponseTimeMs: number;
  healthChecks: number;
  authenticatedRequests: number;
  rejectedRequests: number;
};

const state: MetricsState = {
  totalRequests: 0,
  errors: 0,
  clientErrors4xx: 0,
  serverErrors5xx: 0,
  totalResponseTimeMs: 0,
  healthChecks: 0,
  authenticatedRequests: 0,
  rejectedRequests: 0,
};

const REJECTED_STATUS_CODES = new Set([401, 403, 429]);

export type RequestMetricInput = {
  statusCode: number;
  durationMs: number;
  authenticated?: boolean;
};

export function recordRequestMetrics(input: RequestMetricInput): void {
  state.totalRequests += 1;
  state.totalResponseTimeMs += input.durationMs;

  if (input.authenticated) {
    state.authenticatedRequests += 1;
  }

  if (input.statusCode >= 400 && input.statusCode < 500) {
    state.clientErrors4xx += 1;
    if (REJECTED_STATUS_CODES.has(input.statusCode)) {
      state.rejectedRequests += 1;
    }
  }

  if (input.statusCode >= 500) {
    state.serverErrors5xx += 1;
    state.errors += 1;
  }
}

export function recordHealthCheck(): void {
  state.healthChecks += 1;
}

export function getMetricsSnapshot() {
  return {
    totalRequests: state.totalRequests,
    errors: state.errors,
    clientErrors4xx: state.clientErrors4xx,
    serverErrors5xx: state.serverErrors5xx,
    averageResponseTimeMs:
      state.totalRequests > 0
        ? Math.round(state.totalResponseTimeMs / state.totalRequests)
        : 0,
    healthChecks: state.healthChecks,
    authenticatedRequests: state.authenticatedRequests,
    rejectedRequests: state.rejectedRequests,
  };
}
