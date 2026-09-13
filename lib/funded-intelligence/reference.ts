import 'server-only';

import type { SupabaseClient } from '@supabase/supabase-js';

import type { ReferenceRecord } from './orchestrator';

type JsonRecord = Record<string, unknown>;
const text = (value: unknown) =>
  typeof value === 'string' && value.trim() ? value.trim() : null;

export async function loadFundedReference(
  supabase: SupabaseClient,
  organizationId: string,
  fundedCompanyId: string,
): Promise<ReferenceRecord | null> {
  const evidence = await supabase
    .from('vc_thesis_evidence')
    .select('id,thesis_id,claim,source_url,evidence_text,metadata')
    .eq('id', fundedCompanyId)
    .maybeSingle();
  if (evidence.error) throw new Error(evidence.error.message);
  if (!evidence.data) return null;
  const thesis = await supabase
    .from('vc_theses')
    .select('id,name,organization_id')
    .eq('id', evidence.data.thesis_id)
    .eq('organization_id', organizationId)
    .maybeSingle();
  if (thesis.error) throw new Error(thesis.error.message);
  if (!thesis.data) return null;
  const metadata = (evidence.data.metadata || {}) as JsonRecord;
  if (metadata.record_type !== 'portfolio_company') return null;
  return {
    id: evidence.data.id,
    thesisId: thesis.data.id,
    investorName: thesis.data.name,
    name:
      text(metadata.company_name) ||
      evidence.data.claim.replace(/^Portfolio company:\s*/i, ''),
    companyUrl: text(metadata.company_url),
    description:
      text(metadata.description) || text(evidence.data.evidence_text),
    sector: text(metadata.sector),
    stage: text(metadata.stage),
    geography: text(metadata.geography),
    investmentTiming: text(metadata.investment_timing),
    investmentAmount: text(metadata.investment_amount),
    sourceUrl: text(metadata.source_url) || evidence.data.source_url,
    founders: Array.isArray(metadata.founders)
      ? metadata.founders.filter(
          (item): item is string =>
            typeof item === 'string' && Boolean(item.trim()),
        )
      : [],
    founderPattern: text(metadata.founder_pattern),
    existingPortfolioEvidence: {
      claim: evidence.data.claim,
      evidence_text: evidence.data.evidence_text,
      metadata,
    },
  };
}
