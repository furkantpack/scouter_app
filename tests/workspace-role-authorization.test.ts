import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

import {
  allowedWorkspaceRole,
  WORKSPACE_ROLES,
} from '../lib/workspace-roles.ts';

test('workspace roles match the existing organization role model', () => {
  assert.deepEqual(WORKSPACE_ROLES, ['owner', 'admin', 'member', 'viewer']);
});

test('analysis mutations allow owner and admin', () => {
  assert.equal(allowedWorkspaceRole({ role: 'owner' }), 'owner');
  assert.equal(allowedWorkspaceRole({ role: 'admin' }), 'admin');
});

test('analysis mutations reject member, viewer, and unknown roles with stable 403', () => {
  for (const role of ['member', 'viewer', 'unknown', null]) {
    assert.equal(allowedWorkspaceRole({ role }), null);
  }
  const productApi = readFileSync(
    new URL('../lib/product-api.ts', import.meta.url),
    'utf8',
  );
  assert.match(
    productApi,
    /Your workspace role cannot perform this action\.[\s\S]*403/,
  );
});

const protectedRoutes = [
  '../app/api/network/route.ts',
  '../app/api/funded/[id]/route.ts',
  '../app/api/funded/[id]/instant/route.ts',
  '../app/api/thesis/generate/route.ts',
  '../app/api/internal/cohort-fit/test/route.ts',
];

test('privileged route POST handlers authorize before starting work', () => {
  for (const routePath of protectedRoutes) {
    const source = readFileSync(new URL(routePath, import.meta.url), 'utf8');
    const post = source.slice(source.indexOf('export async function POST'));
    const guard = post.indexOf('requireWorkspaceRole(membership)');
    assert.ok(guard >= 0, `${routePath} is missing the role guard`);
    for (const operation of [
      'bodyOf(request)',
      'createAdminClient()',
      'enqueueNetworkEngineJob(',
      'enqueueFundedEngineJob(',
      'enqueueThesisEngineJob(',
      'runCohortEngine(',
      'processNetworkRun(',
      'processFundedCompanyAnalysis(',
      'persistInternalProfile(',
    ]) {
      const index = post.indexOf(operation);
      if (index >= 0)
        assert.ok(guard < index, `${routePath} authorizes after ${operation}`);
    }
  }
});

test('read-only GET handlers remain free of mutation role guards', () => {
  for (const routePath of [
    '../app/api/network/route.ts',
    '../app/api/funded/[id]/route.ts',
    '../app/api/funded/[id]/instant/route.ts',
  ]) {
    const source = readFileSync(new URL(routePath, import.meta.url), 'utf8');
    const getStart = source.indexOf('export async function GET');
    const postStart = source.indexOf('export async function POST');
    assert.ok(getStart >= 0 && postStart > getStart);
    assert.doesNotMatch(
      source.slice(getStart, postStart),
      /requireWorkspaceRole/,
    );
  }
});

test('internal cohort test endpoint is production-disabled', () => {
  const source = readFileSync(
    new URL('../app/api/internal/cohort-fit/test/route.ts', import.meta.url),
    'utf8',
  );
  assert.match(source, /process\.env\.NODE_ENV === 'production'/);
  assert.match(source, /disabled in production/);
});
