import { getTechEuRounds, TechEuError } from '@/lib/network/tech-eu';
import { ApiError, withWorkspace } from '@/lib/product-api';

function date(value: string | null) {
  if (!value) return undefined;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value))
    throw new ApiError('Invalid funding date filter.');
  return value;
}

export async function GET(request: Request) {
  return withWorkspace(request, async () => {
    const params = new URL(request.url).searchParams;
    const amount = params.get('minAmount');
    const minAmount = amount ? Number(amount) : undefined;
    if (minAmount != null && (!Number.isFinite(minAmount) || minAmount < 0))
      throw new ApiError('Invalid minimum funding amount.');
    const sort = params.get('sort') || 'newest';
    if (!['newest', 'largest'].includes(sort))
      throw new ApiError('Invalid funding sort.');
    try {
      return await getTechEuRounds({
        dateFrom: date(params.get('dateFrom')),
        dateTo: date(params.get('dateTo')),
        country: params.get('country')?.trim().slice(0, 80) || undefined,
        sector: params.get('sector')?.trim().slice(0, 80) || undefined,
        stage: params.get('stage')?.trim().slice(0, 80) || undefined,
        minAmount,
        cursor: params.get('cursor')?.trim().slice(0, 200) || undefined,
        sort: sort as 'newest' | 'largest',
      });
    } catch (error) {
      if (error instanceof TechEuError)
        throw new ApiError(
          'Funding feed temporarily unavailable. Please try again shortly.',
          503,
        );
      throw error;
    }
  });
}
