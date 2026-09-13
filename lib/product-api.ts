import { NextResponse } from 'next/server';

import { checkOrigin, readBody } from '@/lib/auth-request';
import { getWorkspace } from '@/lib/supabase/workspace';
import {
  allowedWorkspaceRole,
  ANALYSIS_MUTATION_ROLES,
  type WorkspaceRole,
} from '@/lib/workspace-roles';

export class ApiError extends Error {
  constructor(
    message: string,
    public status = 400,
    public code?: string,
    public retryAfterSeconds?: number,
  ) {
    super(message);
  }
}
export function requireWorkspaceRole(
  membership: { role?: unknown } | null | undefined,
  allowedRoles: readonly WorkspaceRole[] = ANALYSIS_MUTATION_ROLES,
) {
  const role = allowedWorkspaceRole(membership, allowedRoles);
  if (!role)
    throw new ApiError('Your workspace role cannot perform this action.', 403);
  return role;
}
export function dbError(error: { message: string; code?: string } | null) {
  if (error)
    throw new ApiError(
      error.code === '42501'
        ? 'You do not have permission to perform this action.'
        : error.message,
      error.code === '42501' ? 403 : 400,
    );
}
export const uuid = (value: unknown): value is string =>
  typeof value === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
export async function bodyOf(request: Request) {
  const body = await readBody(request);
  if (!body) throw new ApiError('Invalid JSON request.');
  return body;
}
export async function withWorkspace(
  request: Request,
  action: (
    workspace: Awaited<ReturnType<typeof getWorkspace>>,
  ) => Promise<unknown>,
) {
  try {
    if (!['GET', 'HEAD'].includes(request.method)) {
      const denied = checkOrigin(request);
      if (denied) return denied;
    }
    const workspace = await getWorkspace();
    if (!workspace.user) throw new ApiError('Please sign in to continue.', 401);
    if (!workspace.membership)
      throw new ApiError('Select or create an organization to continue.', 409);
    return NextResponse.json(await action(workspace), {
      headers: { 'Cache-Control': 'no-store' },
    });
  } catch (error) {
    const apiError = error instanceof ApiError ? error : null;
    const headers =
      apiError?.status === 429 && apiError.retryAfterSeconds
        ? { 'Retry-After': String(apiError.retryAfterSeconds) }
        : undefined;
    return NextResponse.json(
      apiError?.code
        ? {
            error: apiError.code,
            message: apiError.message,
            retry_after_seconds: apiError.retryAfterSeconds,
          }
        : {
            error:
              apiError?.message ||
              'The service is unavailable. Please try again.',
          },
      { status: apiError?.status || 503, headers },
    );
  }
}
