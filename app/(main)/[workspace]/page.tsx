import { notFound } from 'next/navigation';

import { PageProducts } from '../products/products-page';

export default function WorkspacePage({
  params,
}: {
  params: { workspace: string };
}) {
  if (
    decodeURIComponent(params.workspace).toLocaleLowerCase('tr-TR') !==
    'portföy'
  ) {
    notFound();
  }

  return <PageProducts portfolio />;
}
