'use client';

import { TooltipProvider } from '@radix-ui/react-tooltip';
import { Provider } from 'jotai';
import { ThemeProvider } from 'next-themes';
import { WorkspaceProvider } from '@/contexts/organization-context';

export const Providers = ({ children }: { children: React.ReactNode }) => {
  return (
    <Provider>
      <ThemeProvider attribute='class'>
        <TooltipProvider
          delayDuration={100}
          skipDelayDuration={300}
          disableHoverableContent
        >
          <WorkspaceProvider>{children}</WorkspaceProvider>
        </TooltipProvider>
      </ThemeProvider>
    </Provider>
  );
};
