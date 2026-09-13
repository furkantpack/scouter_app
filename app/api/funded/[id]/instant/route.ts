import {
  buildInternalFundedProfile,
  FUNDED_PROFILE_VERSION,
  instantScouterMatches,
  persistInternalProfile,
  type FundedCompanyProfile,
} from '@/lib/funded-intelligence/instant';
import { loadFundedReference } from '@/lib/funded-intelligence/reference';
import {
  ApiError,
  dbError,
  requireWorkspaceRole,
  uuid,
  withWorkspace,
} from '@/lib/product-api';
import {
  acquireProductActionRun,
  finishProductActionRun,
} from '@/lib/product-throttle';
import { createAdminClient } from '@/lib/supabase/admin';

function missingSchema(error: { code?: string; message?: string } | null) {
  return Boolean(
    error &&
    (error.code === '42P01' ||
      error.code === 'PGRST205' ||
      error.message?.includes('funded_company_profiles')),
  );
}

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  return withWorkspace(request, async ({ supabase, membership }) => {
    if (!uuid(params.id)) throw new ApiError('Invalid funded company id.');
    const organizationId = membership!.organization_id;
    const reference = await loadFundedReference(
      supabase,
      organizationId,
      params.id,
    );
    if (!reference) throw new ApiError('Funded company not found.', 404);
    const profileResult = await supabase
      .from('funded_company_profiles')
      .select('*')
      .eq('organization_id', organizationId)
      .eq('funded_company_id', params.id)
      .maybeSingle();
    if (missingSchema(profileResult.error)) {
      return {
        profile: null,
        matches: [],
        count: 0,
        persisted: false,
        needsRefresh: false,
        migrationRequired: true,
      };
    }
    dbError(profileResult.error);
    if (!profileResult.data) {
      return {
        profile: null,
        matches: [],
        count: 0,
        persisted: false,
        needsRefresh: true,
        migrationRequired: false,
      };
    }
    const profile = profileResult.data as FundedCompanyProfile;
    const matches = await instantScouterMatches(supabase, profile);
    return {
      profile,
      matches,
      count: matches.length,
      persisted: true,
      needsRefresh: profile.profile_version !== FUNDED_PROFILE_VERSION,
      migrationRequired: false,
      providers: {
        scouter_db: true,
        exa: false,
        scout: false,
        gemini: false,
        firecrawl: false,
      },
    };
  });
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  return withWorkspace(request, async ({ supabase, membership, user }) => {
    requireWorkspaceRole(membership);
    if (!uuid(params.id)) throw new ApiError('Invalid funded company id.');
    const organizationId = membership!.organization_id;
    const reference = await loadFundedReference(
      supabase,
      organizationId,
      params.id,
    );
    if (!reference) throw new ApiError('Funded company not found.', 404);
    const admin = createAdminClient();
    const actionRunId = await acquireProductActionRun(admin, {
      organizationId,
      userId: user!.id,
      actionType: 'funded_instant_refresh',
      resourceKey: params.id,
    });
    try {
      const profile = await buildInternalFundedProfile(admin, reference);
      const matches = await instantScouterMatches(admin, profile);
      const persistence = await persistInternalProfile(
        admin,
        organizationId,
        profile,
      );
      if (persistence.error && !missingSchema(persistence.error))
        throw new ApiError(persistence.error.message, 503);
      await finishProductActionRun(
        admin,
        actionRunId,
        persistence.persisted ? 'completed' : 'partial',
      );
      return {
        profile,
        matches,
        count: matches.length,
        persisted: persistence.persisted,
        needsRefresh: false,
        migrationRequired: missingSchema(persistence.error),
        providers: {
          scouter_db: true,
          exa: false,
          scout: false,
          gemini: false,
          firecrawl: false,
        },
      };
    } catch (error) {
      await finishProductActionRun(admin, actionRunId, 'failed');
      throw error;
    }
  });
}
