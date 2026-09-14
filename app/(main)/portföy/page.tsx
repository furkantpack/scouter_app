import { permanentRedirect } from 'next/navigation';

export default function LegacyPortfolioPage() {
  permanentRedirect('/portfolio');
}
