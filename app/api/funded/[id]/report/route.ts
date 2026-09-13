import { createReportPdf } from '@/lib/funded-intelligence/pdf';
import { loadFundedReference } from '@/lib/funded-intelligence/reference';
import { ApiError, dbError, uuid, withWorkspace } from '@/lib/product-api';

export async function GET(
  request: Request,
  { params }: { params: { id: string } },
) {
  let response: Response | null = null;
  const wrapped = await withWorkspace(
    request,
    async ({ supabase, membership }) => {
      if (!uuid(params.id)) throw new ApiError('Invalid funded company id.');
      const company = await loadFundedReference(
        supabase,
        membership!.organization_id,
        params.id,
      );
      if (!company) throw new ApiError('Funded company not found.', 404);
      const analysis = await supabase
        .from('funded_company_analyses')
        .select('*')
        .eq('organization_id', membership!.organization_id)
        .eq('funded_company_id', params.id)
        .in('status', ['completed', 'partial'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      dbError(analysis.error);
      if (!analysis.data)
        throw new ApiError('The detail report is not ready yet.', 409);
      const [candidates, signals] = await Promise.all([
        supabase
          .from('funded_company_candidates')
          .select('*')
          .eq('analysis_id', analysis.data.id)
          .order('rank', { ascending: true }),
        supabase
          .from('funded_company_signals')
          .select('*')
          .eq('analysis_id', analysis.data.id)
          .order('signal_date', { ascending: false, nullsFirst: false }),
      ]);
      dbError(candidates.error);
      dbError(signals.error);
      const bytes = createReportPdf({
        company,
        analysis: analysis.data,
        candidates: candidates.data || [],
        signals: signals.data || [],
      });
      const filename = `${
        company.name
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .replace(/^-|-$/g, '') || 'funded-company'
      }-detail-report.pdf`;
      response = new Response(bytes, {
        headers: {
          'content-type': 'application/pdf',
          'content-disposition': `attachment; filename="${filename}"`,
          'cache-control': 'private, no-store',
        },
      });
      return { ok: true };
    },
  );
  return response || wrapped;
}
