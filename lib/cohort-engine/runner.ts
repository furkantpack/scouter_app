import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import path from 'node:path';

import type { CohortEngineResult, CohortProfile } from './types';

const TIMEOUT_MS = 15_000;
const MAX_OUTPUT_BYTES = 5 * 1024 * 1024;
const ENGINE_RUNNER = path.join(
  process.cwd(),
  'engine',
  'cohort',
  'runner.py',
);

export class CohortEngineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CohortEngineError';
  }
}

function pythonExecutable() {
  if (process.env.SCOUTER_PYTHON_EXECUTABLE)
    return process.env.SCOUTER_PYTHON_EXECUTABLE;
  const bundled = process.env.USERPROFILE
    ? path.join(
        process.env.USERPROFILE,
        '.cache',
        'codex-runtimes',
        'codex-primary-runtime',
        'dependencies',
        'python',
        'python.exe',
      )
    : '';
  return bundled && existsSync(bundled)
    ? bundled
    : process.platform === 'win32'
      ? 'python.exe'
      : 'python3';
}

function isNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function validResult(value: unknown): value is CohortEngineResult {
  if (!value || typeof value !== 'object') return false;
  const result = value as Partial<CohortEngineResult>;
  return (
    result.engine === 'Scouter Cohort DNA Engine' &&
    typeof result.version === 'string' &&
    Boolean(result.semantics && typeof result.semantics === 'object') &&
    Array.isArray(result.current_program_ranking) &&
    Array.isArray(result.historical_nearest_batches) &&
    Array.isArray(result.program_subcohort_ranking) &&
    result.current_program_ranking.every(
      (row) =>
        row &&
        typeof row.program === 'string' &&
        typeof row.program_id === 'string' &&
        isNumber(row.current_program_fit) &&
        !('acceptance_probability' in row),
    ) &&
    !('acceptance_probability' in result)
  );
}

export function getCohortPythonExecutable() {
  return pythonExecutable();
}

export async function runCohortEngine(
  profile: CohortProfile,
): Promise<CohortEngineResult> {
  if (!existsSync(ENGINE_RUNNER))
    throw new CohortEngineError('Cohort engine is not installed.');

  return new Promise((resolve, reject) => {
    const child = spawn(pythonExecutable(), [ENGINE_RUNNER], {
      cwd: path.dirname(ENGINE_RUNNER),
      shell: false,
      windowsHide: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });
    const stdout: Buffer[] = [];
    const stderr: Buffer[] = [];
    let stdoutBytes = 0;
    let stderrBytes = 0;
    let settled = false;

    const finish = (error?: Error, result?: CohortEngineResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (error) reject(error);
      else resolve(result!);
    };
    const timer = setTimeout(() => {
      child.kill();
      finish(new CohortEngineError('Cohort engine timed out.'));
    }, TIMEOUT_MS);

    child.on('error', () =>
      finish(new CohortEngineError('Python runtime is unavailable.')),
    );
    child.stdout.on('data', (chunk: Buffer) => {
      stdoutBytes += chunk.length;
      if (stdoutBytes > MAX_OUTPUT_BYTES) {
        child.kill();
        finish(new CohortEngineError('Cohort engine output exceeded its limit.'));
      } else stdout.push(chunk);
    });
    child.stderr.on('data', (chunk: Buffer) => {
      stderrBytes += chunk.length;
      if (stderrBytes <= 8_192) stderr.push(chunk);
    });
    child.on('close', (code) => {
      if (settled) return;
      if (code !== 0) {
        const detail = Buffer.concat(stderr)
          .toString('utf8')
          .replace(/[\r\n]+/g, ' ')
          .slice(0, 300);
        finish(
          new CohortEngineError(
            detail
              ? `Cohort engine failed: ${detail}`
              : 'Cohort engine failed.',
          ),
        );
        return;
      }
      try {
        const parsed: unknown = JSON.parse(Buffer.concat(stdout).toString('utf8'));
        if (!validResult(parsed))
          throw new Error('Unexpected Cohort engine response.');
        finish(undefined, parsed);
      } catch {
        finish(new CohortEngineError('Cohort engine returned invalid JSON.'));
      }
    });

    child.stdin.on('error', () => undefined);
    child.stdin.end(JSON.stringify(profile));
  });
}
