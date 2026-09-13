import 'server-only';
import type { SourcePage, ThesisAnalysis } from '@/lib/thesis/types';

const systemInstruction = `You are Scouter's Venture Thesis Intelligence Engine. Convert only the supplied primary-source website evidence into a structured investment thesis. Never invent facts. Separate direct stated claims from observed portfolio patterns and lower-confidence inference. Every important conclusion must be traceable to a supplied URL. Use stated only for explicit investor language, observed only for patterns supported by supplied portfolio/company evidence, and inferred only for reasonable analytical conclusions. Use null or empty arrays when evidence is insufficient. Avoid duplicate or synonymous dimension values. Keep evidence excerpts short and factual. Do not search the web.`;

const outputContract = `Return one JSON object with exactly these top-level fields: fund_summary, stated_thesis, observed_thesis, dimensions, investment_preferences, anti_thesis, portfolio_patterns, portfolio_companies, evidence, quality. fund_summary has name, website, thesis_summary, confidence. stated_thesis and observed_thesis each have summary and confidence. dimensions has arrays stages, sectors, business_models, geographies, founder_traits, company_traits, technologies; every item has value, weight, confidence, claim_type. investment_preferences has check_size {min,max,currency,confidence}, ownership_preference, lead_or_follow, primary_stage. anti_thesis items have value, weight, confidence, claim_type. portfolio_patterns items have pattern and confidence. portfolio_companies items have company_name, company_url, description, sector, stage, geography, source_url. evidence items have dimension, value, claim_type, source_url, source_title, evidence_text, confidence. quality has source_coverage, evidence_strength, portfolio_coverage, overall_confidence. All weights/confidences are numbers from 0 to 1. claim_type is stated, observed, or inferred. Use null and [] for unknowns.`;

function apiKey() {
  const value = process.env.GEMINI_API_KEY;
  if (!value) throw new Error('Gemini is not configured.');
  return value;
}

export async function analyzeThesis(sourceUrl: string, pages: SourcePage[]): Promise<{ analysis: ThesisAnalysis; model: string }> {
  const evidencePackage = pages.map(({ url, title, pageType, content }) => ({ url, title, page_type: pageType, content: content.slice(0, 24_000) }));
  const requestBody = JSON.stringify({
    systemInstruction: { parts: [{ text: systemInstruction }] },
    contents: [{ role: 'user', parts: [{ text: `${outputContract}\n\nEVIDENCE PACKAGE:\n${JSON.stringify({ website: sourceUrl, pages: evidencePackage })}` }] }],
    generationConfig: { responseMimeType: 'application/json', temperature: 0.1, maxOutputTokens: 12_000 },
  });
  const models = Array.from(new Set([process.env.GEMINI_MODEL, 'gemini-3.6-flash', 'gemini-3.5-flash', 'gemini-flash-latest'].filter((model): model is string => Boolean(model))));
  let result: any = null;
  let selectedModel = '';
  let lastFailure = 'Unknown response';
  let lastStatus = 503;
  for (const model of models) {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
      method: 'POST', headers: { 'x-goog-api-key': apiKey(), 'content-type': 'application/json' },
      body: requestBody, signal: AbortSignal.timeout(120_000), cache: 'no-store',
    });
    result = await response.json().catch(() => null);
    if (response.ok) { selectedModel = model; break; }
    lastStatus = response.status;
    lastFailure = String(result?.error?.message || 'Unknown response').slice(0, 400);
    result = null;
    if (![429, 503].includes(response.status)) throw new Error(`Gemini analysis failed (${response.status}): ${lastFailure}`);
  }
  if (!result) throw new Error(`Gemini analysis failed (${lastStatus}): ${lastFailure}`);
  const text = result?.candidates?.[0]?.content?.parts?.map((part: { text?: string }) => part.text || '').join('');
  if (!text) throw new Error('Gemini returned no structured analysis.');
  let analysis: ThesisAnalysis;
  try { analysis = JSON.parse(text) as ThesisAnalysis; } catch { throw new Error('Gemini returned malformed structured analysis.'); }
  if (!analysis?.fund_summary?.thesis_summary || !analysis.dimensions || !Array.isArray(analysis.evidence)) throw new Error('Gemini returned an incomplete thesis analysis.');
  const clamp = (value: unknown) => Math.max(0, Math.min(1, Number(value) || 0));
  const claim = (value: unknown) => value === 'stated' || value === 'observed' || value === 'inferred' ? value : 'inferred';
  for (const key of ['stages', 'sectors', 'business_models', 'geographies', 'founder_traits', 'company_traits', 'technologies'] as const) {
    const values = Array.isArray(analysis.dimensions[key]) ? analysis.dimensions[key] : [];
    analysis.dimensions[key] = values.filter((item) => typeof item?.value === 'string' && item.value.trim()).slice(0, 8).map((item) => ({ value: item.value.trim(), weight: clamp(item.weight), confidence: clamp(item.confidence), claim_type: claim(item.claim_type) }));
  }
  analysis.anti_thesis = (Array.isArray(analysis.anti_thesis) ? analysis.anti_thesis : []).filter((item) => typeof item?.value === 'string' && item.value.trim()).slice(0, 8).map((item) => ({ value: item.value.trim(), weight: clamp(item.weight), confidence: clamp(item.confidence), claim_type: claim(item.claim_type) }));
  analysis.portfolio_patterns = (Array.isArray(analysis.portfolio_patterns) ? analysis.portfolio_patterns : []).filter((item) => typeof item?.pattern === 'string').slice(0, 8).map((item) => ({ pattern: item.pattern.trim(), confidence: clamp(item.confidence) }));
  const knownUrls = new Set(pages.map((page) => page.url));
  analysis.evidence = analysis.evidence.filter((item) => knownUrls.has(item.source_url) && typeof item.evidence_text === 'string' && typeof item.value === 'string').slice(0, 60).map((item) => ({ ...item, claim_type: claim(item.claim_type), confidence: clamp(item.confidence), evidence_text: item.evidence_text.slice(0, 500) }));
  analysis.portfolio_companies = (analysis.portfolio_companies || []).filter((item) => knownUrls.has(item.source_url));
  analysis.quality = { source_coverage: clamp(analysis.quality?.source_coverage), evidence_strength: clamp(analysis.quality?.evidence_strength), portfolio_coverage: clamp(analysis.quality?.portfolio_coverage), overall_confidence: clamp(analysis.quality?.overall_confidence) };
  if (!analysis.evidence.length) throw new Error('Gemini analysis contained no verifiable source evidence.');
  return { analysis, model: selectedModel };
}
