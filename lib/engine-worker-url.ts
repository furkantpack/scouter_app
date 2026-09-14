const WORKER_PATH = '/api/internal/engine-worker';

type WorkerEnvironment = {
  VERCEL_PROJECT_PRODUCTION_URL?: string;
  VERCEL_BRANCH_URL?: string;
  VERCEL_URL?: string;
  NODE_ENV?: string;
};

function vercelOrigin(host: string | undefined) {
  const value = host?.trim();
  if (!value || !/^[a-z0-9.-]+$/i.test(value)) return null;
  try {
    return new URL(`https://${value}`).origin;
  } catch {
    return null;
  }
}

export function resolveEngineWorkerUrl(
  requestUrl: string,
  environment: WorkerEnvironment = process.env,
) {
  const production = vercelOrigin(environment.VERCEL_PROJECT_PRODUCTION_URL);
  if (production)
    return {
      url: new URL(WORKER_PATH, production).toString(),
      source: 'production' as const,
    };

  const branch = vercelOrigin(environment.VERCEL_BRANCH_URL);
  if (branch)
    return {
      url: new URL(WORKER_PATH, branch).toString(),
      source: 'branch' as const,
    };

  const deployment = vercelOrigin(environment.VERCEL_URL);
  if (deployment)
    return {
      url: new URL(WORKER_PATH, deployment).toString(),
      source: 'deployment' as const,
    };

  if (environment.NODE_ENV !== 'production') {
    const request = new URL(requestUrl);
    if (['localhost', '127.0.0.1', '[::1]'].includes(request.hostname))
      return {
        url: new URL(WORKER_PATH, request.origin).toString(),
        source: 'local' as const,
      };
  }

  return null;
}
