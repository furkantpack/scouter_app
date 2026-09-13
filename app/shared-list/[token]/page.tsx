import { notFound } from 'next/navigation';

import { isShareToken, sanitizeSharedList } from '@/lib/shared-list';
import { createClient } from '@/lib/supabase/server';

export default async function SharedListPage({
  params,
}: {
  params: { token: string };
}) {
  if (!isShareToken(params.token)) notFound();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc('get_shared_list', {
    p_share_token: params.token,
  });
  if (error) notFound();
  const rows = sanitizeSharedList(data);
  if (rows.length === 0) notFound();
  const first = rows[0];
  const sortedRows = [...rows].sort((left, right) =>
    (right.founder.scouter_score ?? -1) - (left.founder.scouter_score ?? -1),
  );
  const title = first.list_name || 'Shared founder list';
  const description = first.list_description || '';
  return (
    <main className='mx-auto min-h-screen w-full max-w-6xl space-y-6 p-6 lg:p-10'>
      <header className='border-b border-stroke-soft-200 pb-6'>
        <p className='text-label-sm text-primary-base'>Scouter</p>
        <h1 className='mt-1 text-title-h4 text-text-strong-950'>{title}</h1>
        {description && (
          <p className='mt-2 max-w-2xl text-paragraph-sm text-text-sub-600'>
            {description}
          </p>
        )}
        <p className='mt-3 text-label-xs text-text-soft-400'>
          {rows.length} {rows.length === 1 ? 'founder' : 'founders'} · Read-only
          shared list
        </p>
      </header>
      <section className='overflow-x-auto rounded-2xl border border-stroke-soft-200 bg-bg-white-0'>
        <table className='w-full min-w-[720px] text-left'>
          <thead className='bg-bg-weak-50 text-subheading-xs uppercase text-text-soft-400'>
            <tr>
              <th className='px-4 py-3'>Founder</th>
              <th className='px-4 py-3'>Company</th>
              <th className='px-4 py-3'>Role</th>
              <th className='px-4 py-3'>Scouter Score</th>
              <th className='px-4 py-3'>Why Now</th>
            </tr>
          </thead>
          <tbody>
            {sortedRows.map((row, index) => {
              const founder = row.founder;
              return (
                <tr
                  key={`${founder.name}-${index}`}
                  className='border-t border-stroke-soft-200'
                >
                  <td className='px-4 py-4 text-label-sm text-text-strong-950'>
                    {founder.name || 'Founder'}
                  </td>
                  <td className='px-4 py-4 text-paragraph-sm text-text-sub-600'>
                    {founder.company_name || 'Stealth / pre-company'}
                  </td>
                  <td className='px-4 py-4 text-paragraph-sm text-text-sub-600'>
                    {founder.founder_role || 'Founder'}
                  </td>
                  <td className='px-4 py-4 text-label-md text-primary-base'>
                    {founder.scouter_score ?? '—'}
                  </td>
                  <td className='px-4 py-4'>
                    <p className='line-clamp-2 max-w-72 text-paragraph-sm text-text-sub-600'>
                      {founder.why_now || 'Current signal is being verified.'}
                    </p>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </section>
    </main>
  );
}
