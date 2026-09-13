import 'server-only';

import {
  GeminiJsonError,
  networkGeminiJson,
  type GeminiJsonDiagnostic,
} from '@/lib/network/gemini';

import {
  FUNDED_CANDIDATE_RESPONSE_SCHEMA,
  validateCandidateAssessmentResponse,
} from './candidate-validation';

export { FUNDED_CANDIDATE_BATCH_SIZE } from './candidate-validation';

export async function fundedGeminiJson<T>(
  system: string,
  input: unknown,
  context: string,
  responseSchema?: Record<string, unknown>,
) {
  const attempts = context.includes('candidate assessment') ? 1 : 2;
  let lastError: unknown;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    try {
      return await networkGeminiJson<T>(system, input, {
        context,
        responseSchema,
        models: [
          process.env.GEMINI_MODEL,
          'gemini-3.8-flash',
          'gemini-3.1-flash-lite',
          'gemini-3.6-flash',
          'gemini-3.5-flash',
        ].filter((model): model is string => Boolean(model)),
      });
    } catch (error) {
      lastError = error;
      const temporary =
        error instanceof Error &&
        /\b(429|503)\b|high demand|temporar/i.test(error.message);
      if (!temporary || attempt === attempts) throw error;
      await new Promise((resolve) => setTimeout(resolve, 1500));
    }
  }
  throw lastError;
}

export async function fundedCandidateAssessmentJson(
  system: string,
  input: unknown,
) {
  const result = await fundedGeminiJson<unknown>(
    system,
    input,
    'funded-company candidate assessment',
    FUNDED_CANDIDATE_RESPONSE_SCHEMA,
  );
  const validation = validateCandidateAssessmentResponse(result.data);
  if (!validation.rootValid)
    throw new GeminiJsonError(
      'Gemini returned schema-invalid funded-company candidate assessment.',
      {
        ...result.diagnostic,
        failureType: 'schema_mismatch',
        validationError: validation.rejected[0]?.reason,
      },
    );
  return { ...result, ...validation };
}

export function safeGeminiDiagnostic(error: unknown) {
  if (!(error instanceof GeminiJsonError)) return null;
  return error.diagnostic satisfies GeminiJsonDiagnostic;
}
