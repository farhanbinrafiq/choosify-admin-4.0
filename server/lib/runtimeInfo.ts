import os from 'os';

export function getAppVersion(): string {
  return process.env.APP_VERSION || process.env.npm_package_version || '0.0.0';
}

export function getAppName(): string {
  return process.env.APP_NAME || 'choosify-admin';
}

export function getEnvironment(): string {
  return process.env.NODE_ENV || 'development';
}

export function getNodeVersion(): string {
  return process.version;
}

export function getMemoryUsageSummary() {
  const memory = process.memoryUsage();
  return {
    rssBytes: memory.rss,
    heapTotalBytes: memory.heapTotal,
    heapUsedBytes: memory.heapUsed,
    externalBytes: memory.external,
    arrayBuffersBytes: memory.arrayBuffers,
  };
}

export function getCpuUsageSummary() {
  const usage = process.cpuUsage();
  return {
    userMicros: usage.user,
    systemMicros: usage.system,
  };
}

export function getSystemSummary() {
  return {
    platform: process.platform,
    arch: process.arch,
    hostname: os.hostname(),
    loadAverage: os.loadavg(),
    freeMemoryBytes: os.freemem(),
    totalMemoryBytes: os.totalmem(),
  };
}
