'use client';

import * as React from 'react';

import { startGoogleOAuth } from '@/lib/auth/google-oauth';
import { createClient } from '@/lib/supabase/client';

export function GoogleAuthButton({
  disabled = false,
  onPendingChange,
}: {
  disabled?: boolean;
  onPendingChange?: (pending: boolean) => void;
}) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState('');
  const inFlight = React.useRef(false);

  async function handleGoogleAuth() {
    if (disabled || inFlight.current) return;
    inFlight.current = true;
    setPending(true);
    setError('');
    onPendingChange?.(true);

    try {
      const { error: oauthError } = await startGoogleOAuth(
        createClient(),
        window.location.origin,
      );
      if (oauthError) throw oauthError;
    } catch {
      setError('Google sign-in could not be started. Please try again.');
      inFlight.current = false;
      setPending(false);
      onPendingChange?.(false);
    }
  }

  return (
    <div className='space-y-3'>
      <button
        type='button'
        disabled={disabled || pending}
        onClick={() => void handleGoogleAuth()}
        className='flex h-10 w-full items-center justify-center gap-2.5 rounded-[10px] bg-bg-white-0 px-3.5 text-label-sm text-text-strong-950 shadow-fancy-buttons-stroke transition hover:bg-bg-weak-50 disabled:pointer-events-none disabled:text-text-disabled-300 disabled:shadow-none'
      >
        <img
          src='/images/social/google.svg'
          width={20}
          height={20}
          alt=''
          className='size-5 shrink-0'
        />
        {pending ? 'Redirecting to Google…' : 'Continue with Google'}
      </button>

      {error && (
        <p role='alert' className='text-paragraph-sm text-error-base'>
          {error}
        </p>
      )}

      <div className='flex items-center gap-3' aria-hidden='true'>
        <span className='h-px flex-1 bg-stroke-soft-200' />
        <span className='text-paragraph-xs text-text-soft-400'>or</span>
        <span className='h-px flex-1 bg-stroke-soft-200' />
      </div>
    </div>
  );
}
