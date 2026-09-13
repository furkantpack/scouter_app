'use client';
import * as React from 'react';
import Link from 'next/link';
import * as Input from '@/components/ui/input';
import * as Label from '@/components/ui/label';
import * as FancyButton from '@/components/ui/fancy-button';
import { requestJson } from '@/lib/request-json';
export function AuthRecoveryForm({ mode }: { mode: 'reset-password' | 'update-password' | 'resend' }) {
  const [pending, setPending] = React.useState(false);
  const [error, setError] = React.useState('');
  const [message, setMessage] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [cooldown, setCooldown] = React.useState(0);
  const inFlight = React.useRef(false);
  React.useEffect(() => { if (mode === 'resend') setEmail(sessionStorage.getItem('scouter_confirmation_email') || ''); }, [mode]);
  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);
  const update = mode === 'update-password';
  const title = update ? 'Set a new password' : mode === 'resend' ? 'Confirm your email' : 'Reset password';
  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current || cooldown > 0) return;
    const data = new FormData(event.currentTarget);
    if (update && data.get('password') !== data.get('confirmPassword')) { setError('Passwords do not match.'); return; }
    inFlight.current = true; setPending(true); setError(''); setMessage('');
    try {
      await requestJson('/api/auth/' + mode, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(Object.fromEntries(data)) });
      if (update) { setMessage('Password updated. You can continue to your workspace.'); }
      else { setMessage('If this address is eligible, an email with a secure link will arrive shortly. Check your spam folder too.'); setCooldown(60); }
    } catch (cause) { setError(cause instanceof Error ? cause.message : 'Please try again.'); }
    finally { inFlight.current = false; setPending(false); }
  }
  return <form className='contents' onSubmit={submit}>
    <div className='space-y-2 text-center'><h1 className='text-title-h5'>{title}</h1><p className='text-paragraph-sm text-text-sub-600'>{update ? 'Use 8–128 characters, an uppercase letter and a number.' : mode === 'resend' ? 'Open the confirmation link in your email in this browser. You can request another link below.' : 'We will email you a secure password reset link.'}</p></div>
    {update ? <>
      <div className='space-y-2'><Label.Root htmlFor='password'>New password</Label.Root><Input.Root><Input.Wrapper><Input.Input id='password' name='password' type='password' autoComplete='new-password' required minLength={8} maxLength={128} pattern='(?=.*[A-Z])(?=.*[0-9]).{8,128}' /></Input.Wrapper></Input.Root></div>
      <div className='space-y-2'><Label.Root htmlFor='confirmPassword'>Confirm password</Label.Root><Input.Root><Input.Wrapper><Input.Input id='confirmPassword' name='confirmPassword' type='password' autoComplete='new-password' required maxLength={128} /></Input.Wrapper></Input.Root></div>
    </> : <div className='space-y-2'><Label.Root htmlFor='email'>Email address</Label.Root><Input.Root><Input.Wrapper><Input.Input id='email' name='email' type='email' autoComplete='email' value={email} onChange={e => setEmail(e.target.value)} required maxLength={254} /></Input.Wrapper></Input.Root></div>}
    {error && <p role='alert' className='text-paragraph-sm text-error-base'>{error}</p>}
    {message && <p role='status' className='text-paragraph-sm text-success-base'>{message}</p>}
    <FancyButton.Root type='submit' variant='primary' disabled={pending || cooldown > 0 || (update && Boolean(message))}>{pending ? 'Please wait…' : cooldown > 0 ? 'Try again in ' + cooldown + 's' : update ? 'Update password' : mode === 'resend' ? 'Resend confirmation link' : 'Send reset link'}</FancyButton.Root>
    {update && message && <Link className='text-center underline' href='/auth/continue'>Continue to workspace</Link>}
    <Link className='text-center text-paragraph-sm underline' href='/login'>Back to login</Link>
    {update && error && <Link href='/reset-password' className='text-center underline'>Request a new reset link</Link>}
  </form>;
}
