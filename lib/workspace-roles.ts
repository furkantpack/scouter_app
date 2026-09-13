export const WORKSPACE_ROLES = ['owner', 'admin', 'member', 'viewer'] as const;
export type WorkspaceRole = (typeof WORKSPACE_ROLES)[number];

export const ANALYSIS_MUTATION_ROLES = ['owner', 'admin'] as const;

export function allowedWorkspaceRole(
  membership: { role?: unknown } | null | undefined,
  allowedRoles: readonly WorkspaceRole[] = ANALYSIS_MUTATION_ROLES,
) {
  const role = membership?.role;
  return typeof role === 'string' &&
    allowedRoles.includes(role as WorkspaceRole)
    ? (role as WorkspaceRole)
    : null;
}
