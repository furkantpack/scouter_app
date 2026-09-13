import { ApiError, withWorkspace } from '@/lib/product-api';
import { loadProgramFitSummary } from '@/lib/program-fit-summary';
import { PROGRAM_BY_ID } from '@/lib/program-registry';

export async function GET(request: Request) {
  return withWorkspace(request, async () => {
    try {
      const summaries = await loadProgramFitSummary();
      return {
        programs: summaries.map((row) => ({
          ...row,
          ...(PROGRAM_BY_ID.get(String(row.program_id)) || {}),
        })),
      };
    } catch {
      throw new ApiError(
        'Program summaries are temporarily unavailable. Please try again shortly.',
        503,
      );
    }
  });
}
