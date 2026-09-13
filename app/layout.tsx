import { cn } from '@/utils/cn';

import './globals.css';

import type { Metadata } from 'next';

import localFont from 'next/font/local';

import { SearchMenu } from '@/components/search';
import { Providers } from '@/app/providers';

const inter = localFont({
  src: '../assets/font/InterVariable.woff2',
  display: 'swap',
  weight: '100 900',

  variable: '--font-inter',
});

const interVar = localFont({
  src: '../assets/font/InterVariable.woff2',
  display: 'swap',
  variable: '--font-inter-var',
  weight: '100 900',
});

export const metadata: Metadata = {
  title: 'Scouter',
  description: 'Founder Intelligence by Scouter',
  icons: {
    icon: '/images/brand/scouter-mark.webp',
    shortcut: '/images/brand/scouter-mark.webp',
    apple: '/images/brand/scouter-mark.webp',
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang='en'
      suppressHydrationWarning
      className={cn(inter.variable, interVar.variable, 'antialiased')}
    >
      <body className='bg-bg-white-0'>
        <Providers>
          {children}
          <SearchMenu />
        </Providers>
      </body>
    </html>
  );
}
