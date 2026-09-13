import { requestJson } from './request-json';
export async function saveOnboardingStep(
  step: number,
  answers: Record<number, string | string[]>,
  completed = false,
) {
  await requestJson('/api/onboarding', {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ step, answers, completed }),
  });
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

export async function createOnboardingOrganization(name: string) {
  const response = await fetch('/api/organizations', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      name,
      slug: `${slugify(name)}-${crypto.randomUUID().slice(0, 6)}`,
      websiteUrl: null,
    }),
  });
  const result = await response.json();
  if (!response.ok) {
    throw new Error(result.error || 'Organization could not be created.');
  }
  return result;
}
