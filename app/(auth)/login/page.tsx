'use client';

import * as React from 'react';
import Link from 'next/link';
import { requestJson } from '@/lib/request-json';
import { safeNext } from '@/lib/auth-validation';
import {
  RiEyeLine,
  RiEyeOffLine,
  RiLock2Line,
  RiMailLine,
  RiUserLine,
} from '@remixicon/react';

import { cn } from '@/utils/cn';
import * as FancyButton from '@/components/ui/fancy-button';
import * as Input from '@/components/ui/input';
import * as Label from '@/components/ui/label';
import * as LinkButton from '@/components/ui/link-button';


const PasswordInput = React.forwardRef<
  HTMLInputElement,
  React.ComponentPropsWithoutRef<typeof Input.Input>
>(function PasswordInput(props, ref) {
  const [showPassword, setShowPassword] = React.useState(false);

  return (
    <Input.Root>
      <Input.Wrapper>
        <Input.Icon as={RiLock2Line} />
        <Input.Input
          ref={ref}
          type={showPassword ? 'text' : 'password'}
          placeholder='••••••••••'
          {...props}
        />
        <button aria-label={showPassword ? 'Hide password' : 'Show password'} type='button' onClick={() => setShowPassword((s) => !s)}>
          {showPassword ? (
            <RiEyeOffLine className='size-5 text-text-soft-400 group-has-[disabled]:text-text-disabled-300' />
          ) : (
            <RiEyeLine className='size-5 text-text-soft-400 group-has-[disabled]:text-text-disabled-300' />
          )}
        </button>
      </Input.Wrapper>
    </Input.Root>
  );
});

export default function PageLogin() {
  const emailRef = React.useRef<HTMLInputElement>(null);
  const passwordRef = React.useRef<HTMLInputElement>(null);
  const [email, setEmail] = React.useState('');
  const [password, setPassword] = React.useState('');
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    const code = new URLSearchParams(window.location.search).get('error');
    if (code) setError(code === 'confirmation' ? 'Confirmation link is invalid or expired. Request a new link.' : 'Could not load your workspace. Please try signing in again.');
  }, []);
  const inFlight = React.useRef(false);
  async function signIn(form: HTMLFormElement) {
    if (inFlight.current || !form.reportValidity()) return;
    inFlight.current = true; setPending(true); setError('');
    try {
      const values = new FormData(form);
      await requestJson('/api/auth/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ email: String(values.get('email')).trim(), password: values.get('password') }) });
      const next = safeNext(new URLSearchParams(window.location.search).get('next'), '/dashboard');
      window.location.assign(next.startsWith('/invite/') ? next : '/auth/continue?next=' + encodeURIComponent(next));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Login failed.');
      inFlight.current = false; setPending(false);
    }
  }

  return (
    <form className='contents' onSubmit={(event) => { event.preventDefault(); void signIn(event.currentTarget); }}>
      <div className='flex flex-col items-center gap-2'>
        {/* icon */}
        <div
          className={cn(
            'relative flex size-[68px] shrink-0 items-center justify-center rounded-full backdrop-blur-xl lg:size-20',
            // bg
            'before:absolute before:inset-0 before:rounded-full',
            'before:bg-gradient-to-b before:from-primary-base before:to-transparent before:opacity-10',
          )}
        >
          <div
            className='relative z-10 flex size-12 items-center justify-center rounded-full bg-bg-white-0 ring-1 ring-inset ring-stroke-soft-200 lg:size-14'
            style={{
              boxShadow:
                '0 0 0 1px rgba(183, 83, 16, 0.04), 0 1px 1px 0.5px rgba(183, 83, 16, 0.04), 0 3px 3px -1.5px rgba(183, 83, 16, 0.02), 0 6px 6px -3px rgba(183, 83, 16, 0.04), 0 12px 12px -6px rgba(183, 83, 16, 0.04), 0px 24px 24px -12px rgba(183, 83, 16, 0.04), 0px 48px 48px -24px rgba(183, 83, 16, 0.04), inset 0px -1px 1px -0.5px rgba(183, 83, 16, 0.06)',
            }}
          >
            <RiUserLine className='size-6 text-warning-base lg:size-7' />
          </div>
        </div>

        <div className='space-y-1 text-center'>
          <div className='font-inter-var text-title-h6 lg:text-title-h5'>
            Login to your account
          </div>
          <div className='text-paragraph-sm text-text-sub-600 lg:text-paragraph-md'>
            Enter your details to login.
          </div>
        </div>
      </div>



      <div className='space-y-3'>
        <div className='space-y-1'>
          <Label.Root htmlFor='email'>
            Email Address <Label.Asterisk />
          </Label.Root>
          <Input.Root>
            <Input.Wrapper>
              <Input.Icon as={RiMailLine} />
              <Input.Input
                ref={emailRef}
                id='email'
                name='email'
                autoComplete='email'
                maxLength={254}
                type='email'
                placeholder='hello@alignui.com'
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                required
              />
            </Input.Wrapper>
          </Input.Root>
        </div>

        <div className='space-y-1'>
          <Label.Root htmlFor='password'>
            Password <Label.Asterisk />
          </Label.Root>
          <PasswordInput
            ref={passwordRef}
            id='password'
            name='password'
            autoComplete='current-password'
            maxLength={128}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            required
          />
        </div>
      </div>

      <div className='flex items-center justify-between gap-4'>
        <span className='text-paragraph-sm text-text-sub-600'>Secure sign-in</span>
        <LinkButton.Root variant='gray' size='medium' underline asChild>
          <Link href='/reset-password'>Forgot password?</Link>
        </LinkButton.Root>
      </div>

      {error && <p role='alert' className='text-paragraph-sm text-error-base'>{error}</p>}

      <FancyButton.Root
        variant='primary'
        size='medium'
        disabled={pending}
        type='submit'
      >
        {pending ? 'Signing in…' : 'Login'}
      </FancyButton.Root>
    </form>
  );
}
