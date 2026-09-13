type GoogleOAuthClient = {
  auth: {
    signInWithOAuth(options: {
      provider: 'google';
      options: { redirectTo: string };
    }): Promise<{ error: unknown }>;
  };
};

export function googleOAuthRedirectTo(origin: string) {
  return new URL('/auth/callback', origin).toString();
}

export function startGoogleOAuth(client: GoogleOAuthClient, origin: string) {
  return client.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: googleOAuthRedirectTo(origin),
    },
  });
}
