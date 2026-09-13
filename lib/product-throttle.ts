import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import { ApiError } from '@/lib/product-api';
import {
  PRODUCT_ACTION_LIMITS,
  type ProductActionType,
} from '@/lib/product-throttle-policy';

type AcquireRow = {
  allowed: boolean;
  action_run_id: string | null;
  retry_after_seconds: number;
  reason: string | null;
};

export async function acquireProductActionRun(
  supabase: SupabaseClient,
  input: {
    organizationId: string;
    userId: string;
    actionType: ProductActionType;
    resourceKey?: string | null;
  },
) {
  const limit = PRODUCT_ACTION_LIMITS[input.actionType];
  const result = await supabase.rpc('acquire_product_action_run', {
    p_organization_id: input.organizationId,
    p_user_id: input.userId,
    p_action_type: input.actionType,
    p_resource_key: input.resourceKey || null,
    p_user_cooldown_seconds: limit.userCooldownSeconds,
    p_organization_cooldown_seconds: limit.organizationCooldownSeconds,
    p_max_concurrent_organization: limit.maxConcurrentOrganization,
    p_lease_seconds: limit.leaseSeconds,
  });
  if (result.error)
    throw new ApiError('Application throttling is unavailable.', 503);
  const row = (
    Array.isArray(result.data) ? result.data[0] : result.data
  ) as AcquireRow | null;
  if (!row?.allowed || !row.action_run_id) {
    const retryAfter = Math.max(1, Number(row?.retry_after_seconds) || 1);
    throw new ApiError(
      'This analysis was started recently. Please try again shortly.',
      429,
      'rate_limited',
      retryAfter,
    );
  }
  return row.action_run_id;
}

export async function finishProductActionRun(
  supabase: SupabaseClient,
  actionRunId: string,
  status: 'completed' | 'failed' | 'partial',
) {
  const result = await supabase
    .from('product_action_runs')
    .update({
      status,
      completed_at: new Date().toISOString(),
    })
    .eq('id', actionRunId)
    .eq('status', 'active');
  return !result.error;
}
