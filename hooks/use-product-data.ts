'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useWorkspace } from '@/contexts/organization-context';

import { requestJson } from '@/lib/request-json';

export function useProductData<T>(url: string | null) {
  const { dataScope } = useWorkspace();
  const key = dataScope + ':' + url;
  const current = useRef(key);
  current.current = key;
  const [state, setState] = useState<{
    key: string;
    data: T | null;
    error: string;
    loading: boolean;
  }>({ key: '', data: null, error: '', loading: true });
  const reload = useCallback(async () => {
    if (!url) {
      setState({ key, data: null, error: '', loading: false });
      return;
    }
    setState({ key, data: null, error: '', loading: true });
    try {
      const data = await requestJson<T>(url, {
        requestIdentity: `product:${dataScope}`,
      });
      if (current.current === key)
        setState({ key, data, error: '', loading: false });
    } catch (error) {
      if (current.current === key)
        setState({
          key,
          data: null,
          error:
            error instanceof Error ? error.message : 'Could not load data.',
          loading: false,
        });
    }
  }, [dataScope, key, url]);
  useEffect(() => {
    void reload();
  }, [reload]);
  return {
    ...(state.key === key ? state : { data: null, error: '', loading: true }),
    reload,
  };
}
