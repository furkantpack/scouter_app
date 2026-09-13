import assert from 'node:assert/strict';
import test from 'node:test';
import { networkMatch, passesNetworkGates } from '../lib/network/scoring.ts';
import type { NetworkAssessment, NetworkCandidate } from '../lib/network/types.ts';

const assessment: NetworkAssessment = {
  candidate_name: 'Jane Doe', founder_state: 'Founder Formation', founder_archetype: 'Technical Founder',
  dimensions: { structural_pattern_fit: 90, founder_quality: 80, founder_transition: 85, timing: 80, evidence_confidence: 90 },
  visibility: 'very_low', why_now: 'Recently formed.', pattern_match_summary: 'Strong analogue.', match_reasons: ['Technical Founder'], key_difference: 'Earlier stage.', risks: [], supporting_evidence: [],
};
const candidate: NetworkCandidate = { founderId: 'founder-id', name: 'Jane Doe', company: 'Stealth', role: 'Founder', profileText: '', scouterScore: 96, sourceMix: ['scouter_db'], evidence: [], identityStatus: 'confirmed' };

test('calculates the ZIP engine weights deterministically', () => {
  assert.equal(networkMatch(assessment), 86);
});

test('hard gates reject ambiguous identities and noise', () => {
  assert.equal(passesNetworkGates(assessment, candidate), true);
  assert.equal(passesNetworkGates(assessment, { ...candidate, identityStatus: 'ambiguous' }), false);
  assert.equal(passesNetworkGates({ ...assessment, founder_state: 'Noise' }, candidate), false);
});

