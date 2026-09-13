import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  googleOAuthRedirectTo,
  startGoogleOAuth,
} from '../lib/auth/google-oauth.ts';

const read = (path: string) =>
  readFileSync(new URL(path, import.meta.url), 'utf8');

test('Google OAuth uses the provider whitelist and dynamic callback origin', async () => {
  const calls: unknown[] = [];
  const client = {
    auth: {
      async signInWithOAuth(options: unknown) {
        calls.push(options);
        return { error: null };
      },
    },
  };

  await startGoogleOAuth(client, 'https://app.scouter.so');
  assert.deepEqual(calls, [
    {
      provider: 'google',
      options: {
        redirectTo: 'https://app.scouter.so/auth/callback',
      },
    },
  ]);
  assert.equal(
    googleOAuthRedirectTo('http://localhost:3000'),
    'http://localhost:3000/auth/callback',
  );
});

test('login and register render Google auth without changing email/password APIs', () => {
  const login = read('../app/(auth)/login/page.tsx');
  const register = read('../app/(auth)/register/page.tsx');
  const button = read('../components/google-auth-button.tsx');

  assert.match(login, /<GoogleAuthButton/);
  assert.match(register, /<GoogleAuthButton/);
  assert.match(button, /Continue with Google/);
  assert.match(button, /inFlight\.current/);
  assert.match(button, /disabled=\{disabled \|\| pending\}/);
  assert.match(login, /requestJson\('\/api\/auth\/login'/);
  assert.match(register, /requestJson\('\/api\/auth\/register'/);
  assert.doesNotMatch(`${login}\n${register}`, /alignui/i);
});

test('callback exchanges the code and enters shared onboarding flow', () => {
  const callback = read('../app/auth/callback/route.ts');

  assert.match(callback, /exchangeCodeForSession\(code\)/);
  assert.match(
    callback,
    /`\/auth\/continue\?next=\$\{encodeURIComponent\(next\)\}`/,
  );
  assert.match(callback, /next === '\/update-password'/);
});

test('frontend contains no Google client credentials', () => {
  const sources = [
    read('../lib/auth/google-oauth.ts'),
    read('../components/google-auth-button.tsx'),
    read('../app/(auth)/login/page.tsx'),
    read('../app/(auth)/register/page.tsx'),
  ].join('\n');

  assert.doesNotMatch(
    sources,
    /NEXT_PUBLIC_GOOGLE|GOOGLE_CLIENT_(?:ID|SECRET)|client_secret/i,
  );
});
