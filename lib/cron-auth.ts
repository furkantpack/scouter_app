import { timingSafeEqual } from 'node:crypto';

export function hasValidCronAuthorization(
  authorization: string | null,
  secret = process.env.CRON_SECRET,
) {
  if (!secret || !authorization?.startsWith('Bearer ')) return false;
  const supplied = Buffer.from(authorization.slice('Bearer '.length));
  const expected = Buffer.from(secret);
  return (
    supplied.length === expected.length && timingSafeEqual(supplied, expected)
  );
}
