import 'server-only';

export type GeminiJsonDiagnostic = {
  context: string;
  model: string;
  finishReason: string | null;
  responseTextLength: number;
  rawResponsePreview: string;
  failureType?: 'empty_output' | 'malformed_json' | 'schema_mismatch';
  validationError?: string;
};

export class GeminiJsonError extends Error {
  diagnostic: GeminiJsonDiagnostic;

  constructor(message: string, diagnostic: GeminiJsonDiagnostic) {
    super(message);
    this.name = 'GeminiJsonError';
    this.diagnostic = diagnostic;
  }
}

type GeminiJsonOptions = {
  context?: string;
  responseSchema?: Record<string, unknown>;
  models?: string[];
};

function key() {
  const value = process.env.GEMINI_API_KEY;
  if (!value) throw new Error('Gemini is not configured.');
  return value;
}

export async function networkGeminiJson<T>(
  system: string,
  input: unknown,
  options: GeminiJsonOptions = {},
): Promise<{ data: T; model: string; diagnostic: GeminiJsonDiagnostic }> {
  const context = options.context || 'Network analysis';
  const models = Array.from(
    new Set(
      (
        options.models || [
          process.env.GEMINI_MODEL,
          'gemini-3.6-flash',
          'gemini-3.5-flash',
          'gemini-flash-latest',
        ]
      ).filter((model): model is string => Boolean(model)),
    ),
  );
  const generationConfig: Record<string, unknown> = {
    responseMimeType: 'application/json',
    temperature: 0.1,
    maxOutputTokens: 12000,
  };
  if (options.responseSchema)
    generationConfig.responseSchema = options.responseSchema;
  const body = JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents: [{ role: 'user', parts: [{ text: JSON.stringify(input) }] }],
    generationConfig,
  });
  let lastStatus = 503;
  let lastMessage = 'No model response';
  for (const model of models) {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
      {
        method: 'POST',
        headers: {
          'x-goog-api-key': key(),
          'content-type': 'application/json',
        },
        body,
        cache: 'no-store',
        signal: AbortSignal.timeout(120_000),
      },
    );
    const result = await response.json().catch(() => null);
    if (!response.ok) {
      lastStatus = response.status;
      lastMessage = String(result?.error?.message || 'Unknown response').slice(
        0,
        300,
      );
      if (![429, 503].includes(response.status))
        throw new Error(
          `Gemini ${context} failed (${response.status}): ${lastMessage}`,
        );
      continue;
    }
    const candidate = result?.candidates?.[0];
    const responseText = candidate?.content?.parts
      ?.map((part: { text?: string }) => part.text || '')
      .join('');
    const diagnostic: GeminiJsonDiagnostic = {
      context,
      model,
      finishReason:
        typeof candidate?.finishReason === 'string'
          ? candidate.finishReason
          : null,
      responseTextLength:
        typeof responseText === 'string' ? responseText.length : 0,
      rawResponsePreview:
        typeof responseText === 'string' ? responseText.slice(0, 3000) : '',
    };
    if (!responseText)
      throw new GeminiJsonError(`Gemini returned no ${context}.`, {
        ...diagnostic,
        failureType: 'empty_output',
      });
    try {
      return { data: JSON.parse(responseText) as T, model, diagnostic };
    } catch {
      throw new GeminiJsonError(`Gemini returned malformed ${context}.`, {
        ...diagnostic,
        failureType: 'malformed_json',
      });
    }
  }
  throw new Error(`Gemini ${context} failed (${lastStatus}): ${lastMessage}`);
}
