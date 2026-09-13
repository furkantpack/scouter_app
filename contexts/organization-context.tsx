'use client';

import * as React from 'react';
import { usePathname } from 'next/navigation';

import { requestJson } from '@/lib/request-json';

type WorkspaceContextValue = {
  loading: boolean;
  error: string;
  dataScope: number;
  user: any;
  profile: any;
  membership: any;
  memberships: any[];
  switchOrganization: (organizationId: string) => Promise<void>;
  refresh: () => Promise<void>;
};

const WorkspaceContext = React.createContext<WorkspaceContextValue | null>(
  null,
);

export function WorkspaceProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<
    Omit<
      WorkspaceContextValue,
      'loading' | 'error' | 'dataScope' | 'switchOrganization' | 'refresh'
    >
  >({
    user: null,
    profile: null,
    membership: null,
    memberships: [],
  });
  const [loading, setLoading] = React.useState(true);
  const pathname = usePathname();
  const [error, setError] = React.useState('');
  const [dataScope, setDataScope] = React.useState(0);
  const started = React.useRef(false);
  const resolvedIdentity = React.useRef<string | null>(null);
  const hasResolved = React.useRef(false);

  const refresh = React.useCallback(async () => {
    try {
      setError('');
      const next = await requestJson<any>('/api/workspace/context', {
        requestIdentity: 'workspace-context',
      });
      const nextIdentity = `${next.user?.id || 'anonymous'}:${next.membership?.organization_id || 'none'}`;
      if (hasResolved.current && resolvedIdentity.current !== nextIdentity)
        setDataScope((value) => value + 1);
      resolvedIdentity.current = nextIdentity;
      hasResolved.current = true;
      setState(next);
    } catch (cause) {
      setError(
        cause instanceof Error ? cause.message : 'Workspace unavailable.',
      );
      if (hasResolved.current && resolvedIdentity.current !== 'unavailable')
        setDataScope((value) => value + 1);
      resolvedIdentity.current = 'unavailable';
      hasResolved.current = true;
      setState({
        user: null,
        profile: null,
        membership: null,
        memberships: [],
      });
    } finally {
      setLoading(false);
    }
  }, []);
  React.useEffect(() => {
    if (
      [
        '/login',
        '/register',
        '/verification',
        '/reset-password',
        '/update-password',
      ].includes(pathname)
    ) {
      setLoading(false);
      return;
    }
    if (started.current) return;
    started.current = true;
    setLoading(true);
    void refresh();
  }, [refresh, pathname]);

  const switchOrganization = React.useCallback(
    async (organizationId: string) => {
      const response = await fetch('/api/workspace/active-organization', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ organizationId }),
      });
      if (!response.ok) throw new Error('Organization could not be selected.');
      await refresh();
    },
    [refresh],
  );

  return (
    <WorkspaceContext.Provider
      value={{
        ...state,
        loading,
        error,
        dataScope,
        refresh,
        switchOrganization,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const value = React.useContext(WorkspaceContext);
  if (!value)
    throw new Error('useWorkspace must be used inside WorkspaceProvider');
  return value;
}
