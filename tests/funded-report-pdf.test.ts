import assert from 'node:assert/strict';
import test from 'node:test';

import { createReportPdf } from '../lib/funded-intelligence/pdf.ts';

const input = {
  company: {
    name: 'Sono',
    investorName: 'Example VC',
    stage: 'Pre-seed',
  },
  analysis: {
    completed_at: '2026-09-12T00:00:00Z',
    reference_company_json: {
      executive_summary: 'Evidence-backed investment insight.',
      evidence_pack: {
        sources: [
          {
            url: 'https://example.com/source',
            title: 'Primary source',
          },
        ],
        company_identity: {
          exact_name: {
            value: 'Sono',
            source_urls: ['https://example.com/source'],
          },
        },
        founders: [{ name: 'Ada Founder', background: 'Repeat AI founder' }],
      },
    },
    original_wedge_json: {
      problem: 'Missed calls create revenue loss.',
      wedge: 'A workflow-integrated voice agent.',
      buyer: 'Service operators',
      why_it_worked: 'Direct operational ROI.',
    },
    founder_dna_json: { composition: 'Technical and commercial team.' },
    investor_pattern_json: {
      thesis: 'Vertical workflow ownership.',
      strategic_complementarity: {
        incumbent_owned: 'Distribution',
        target_owned: 'Agentic workflow',
        combined_structure: 'Distribution plus intelligence',
      },
    },
    customer_pattern_json: { target: 'Service businesses' },
    category_evolution_json: {
      early_market: 'IVR',
      reference_company_wedge: 'Voice agent',
      category_evolution: 'Autonomous task execution',
      current_opportunity_layer: 'Orchestration',
    },
    value_chain_json: {
      branches: [{ layer: 'Agentic layer', status: 'Emerging' }],
    },
    maturity_map_json: {
      stages: [{ 0: 'P', 1: 'r', 2: 'e', 3: '-', 4: 's', 5: 'e', 6: 'e', 7: 'd' }],
    },
    historical_validators_json: Array.from({ length: 3 }, (_, index) => ({
      name: `Validator ${index + 1}`,
      event: `External event ${index + 1}`,
      pattern: 'Voice AI validation',
      similarity: index ? 'Medium' : 'Strong',
      what_it_proves: 'External category evidence.',
      source_urls: ['https://example.com/source'],
    })),
    missing_layers_json: [
      { valuable_missing_layer: 'Regulated-industry infrastructure' },
    ],
    final_insight_json: {
      summary: 'One-line thesis.',
      repeating_historical_pattern: 'Vertical-first entry.',
      market_layer_becoming_interesting_now: 'Agentic orchestration.',
      strongest_pre_announcement_founder_signal: 'Forward-deployed work.',
      why_contact_now: 'Formation is newly visible.',
    },
    excluded_candidates_json: [
      { name: 'Excluded Person', company: 'Example', reasons: ['Noise'] },
    ],
  },
  candidates: Array.from({ length: 3 }, (_, index) => ({
    rank: index + 1,
    founder_name: `Founder ${index + 1}`,
    company_name: `Company ${index + 1}`,
    founder_state: 'Founder Now',
    pattern_match_score: 90 - index,
    scouter_score: 95 - index,
    why_now: 'Recent evidence-backed formation signal.',
    visibility: 'low',
  })),
};

test('renders a structured A4 report with all major sections', () => {
  const bytes = createReportPdf(input);
  const pdf = Buffer.from(bytes).toString('latin1');
  assert.match(pdf, /^%PDF-1\.4/);
  assert.match(pdf, /\/MediaBox \[0 0 595\.28 841\.89\]/);
  for (const section of [
    'Executive Summary',
    'Verified Reference Company',
    'Original Wedge',
    'Founder DNA',
    'Category Evolution',
    'Value-Chain Tree',
    'Maturity Tree',
    'Historical Pattern Validation',
    'Missing-Layer Map',
    'Emerging Founder Ranking',
    'Candidate Detail',
    'Excluded Candidates',
    'Final Scouter Insight',
    'Source Appendix',
  ])
    assert.match(pdf, new RegExp(section.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
});

test('keeps scores separate and renders only supported missing-layer content', () => {
  const pdf = Buffer.from(createReportPdf(input)).toString('latin1');
  assert.match(pdf, /SCOUTER/);
  assert.match(pdf, /PATTERN/);
  assert.match(pdf, /Regulated-industry infrastructure/);
  assert.doesNotMatch(pdf, /\(0\) Tj[\s\S]*\(1\) Tj[\s\S]*\(2\) Tj/);
});
