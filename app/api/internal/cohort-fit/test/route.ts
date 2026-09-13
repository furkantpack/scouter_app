import { loadScouterCohortProfile } from '@/lib/cohort-engine/profile-mapper';
import { CohortEngineError, runCohortEngine } from '@/lib/cohort-engine/runner';
import {
  ApiError,
  bodyOf,
  requireWorkspaceRole,
  uuid,
  withWorkspace,
} from '@/lib/product-api';
import {
  acquireProductActionRun,
  finishProductActionRun,
} from '@/lib/product-throttle';
import { createAdminClient } from '@/lib/supabase/admin';

export async function POST(request: Request) {
  return withWorkspace(request, async ({ supabase, membership, user }) => {
    requireWorkspaceRole(membership);
    if (process.env.NODE_ENV === 'production')
      throw new ApiError('This endpoint is disabled in production.', 403);
    const body = await bodyOf(request);
    if (!uuid(body.founderId)) throw new ApiError('Invalid founder id.');

    const mapped = await loadScouterCohortProfile(supabase, body.founderId);
    if (!mapped) throw new ApiError('Founder not found.', 404);

    const admin = createAdminClient();
    const actionRunId = await acquireProductActionRun(admin, {
      organizationId: membership!.organization_id,
      userId: user!.id,
      actionType: 'cohort_fit_test',
      resourceKey: body.founderId,
    });
    const started = performance.now();
    try {
      const result = await runCohortEngine(mapped.profile);
      const top = result.current_program_ranking.slice(0, 5);
      await finishProductActionRun(admin, actionRunId, 'completed');
      return {
        founderId: body.founderId,
        normalizedProfile: mapped.profile,
        topPrograms: top,
        engine: result.engine,
        engineVersion: result.version,
        warnings: [
          ...result.verification.warnings,
          ...top.flatMap((row) => row.verification_warnings),
        ],
        unmappedTaxonomy: mapped.unmappedTaxonomy,
        executionDurationMs: Math.round(performance.now() - started),
        semantics: result.semantics,
      };
    } catch (error) {
      await finishProductActionRun(admin, actionRunId, 'failed');
      if (error instanceof CohortEngineError)
        throw new ApiError(error.message, 503);
      throw error;
    }
  });
}
