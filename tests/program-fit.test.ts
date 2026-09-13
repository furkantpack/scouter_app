import assert from 'node:assert/strict';
import test from 'node:test';

import { programFitLabels } from '../lib/program-fit.ts';

test('formats persisted Program Fit match fields without exposing raw JSON', () => {
  assert.deepEqual(
    programFitLabels({
      historical: [
        { feature: 'founder.technical_depth' },
        { feature: 'company.ai_native' },
      ],
      current_intent: [{ label: 'Vertical AI' }],
    }),
    ['technical depth', 'ai native', 'Vertical AI'],
  );
});

test('ignores unsupported Program Fit explanation values', () => {
  assert.deepEqual(programFitLabels({ internal_metadata: { confidence: 0.9 } }), []);
});
