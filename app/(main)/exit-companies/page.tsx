import { notFound } from 'next/navigation';

import { legacyDemoRoutesEnabled } from '@/lib/legacy-demo-routes';
import ProductsPage from '../products/products-page';

export default function ExitCompaniesPage() {
  if (!legacyDemoRoutesEnabled()) notFound();
  return <ProductsPage />;
}
