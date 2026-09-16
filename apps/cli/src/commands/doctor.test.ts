import { Command } from 'commander';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { registerDoctorCommand } from './doctor';

const runDoctor = vi.hoisted(() => vi.fn());
const report = vi.hoisted(() => ({
  value: {
    checks: [],
    cli: { bin: 'lh', version: '0.0.55' },
    generatedAt: '2026-09-16T00:00:00.000Z',
    profile: 'core',
    status: 'ok',
    summary: { fail: 0, ok: 1, skip: 0, warn: 0 },
  } as any,
}));

vi.mock('../doctor', () => ({
  ALL_CHECKS: [],
  exitCodeFor: (r: any, strict: boolean) =>
    r.status === 'fail' || (strict && r.status === 'warn') ? 1 : 0,
  renderReport: () => 'rendered',
  runDoctor: (checks: unknown, options: unknown) => runDoctor(checks, options),
}));

describe('doctor command', () => {
  let exitSpy: ReturnType<typeof vi.spyOn>;
  let logSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    runDoctor.mockResolvedValue(report.value);
    exitSpy = vi.spyOn(process, 'exit').mockImplementation((() => {}) as any);
    logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    process.exitCode = 0;
    report.value.status = 'ok';
    exitSpy.mockRestore();
    logSpy.mockRestore();
    vi.clearAllMocks();
  });

  const run = async (...args: string[]) => {
    const program = new Command();
    registerDoctorCommand(program);
    await program.parseAsync(['doctor', ...args], { from: 'user' });
    return runDoctor.mock.calls.at(-1)?.[1];
  };

  it('defaults to the core profile with a 10s budget', async () => {
    expect(await run()).toMatchObject({
      deep: false,
      fix: false,
      offline: false,
      profile: 'core',
      strict: false,
      timeoutMs: 10_000,
    });
  });

  it('parses the flags into options', async () => {
    expect(
      await run(
        '--profile',
        'connect',
        '--offline',
        '--deep',
        '--fix',
        '--strict',
        '--agent',
        'inbox',
        '--timeout',
        '2500',
      ),
    ).toMatchObject({
      agent: 'inbox',
      deep: true,
      fix: true,
      offline: true,
      profile: 'connect',
      strict: true,
      timeoutMs: 2500,
    });
  });

  it('splits --hetero into a list', async () => {
    expect((await run('--hetero', 'claude-code, codex'))?.hetero).toEqual(['claude-code', 'codex']);
  });

  it('falls back to the default budget for a nonsense --timeout', async () => {
    expect((await run('--timeout', 'soon'))?.timeoutMs).toBe(10_000);
  });

  it('rejects an unknown profile before running anything', async () => {
    const program = new Command();
    registerDoctorCommand(program);
    await program.parseAsync(['doctor', '--profile', 'everything'], { from: 'user' });

    expect(runDoctor).not.toHaveBeenCalled();
    expect(exitSpy).toHaveBeenCalledWith(1);
  });

  it('prints the report as JSON when asked', async () => {
    await run('--json');

    expect(logSpy.mock.calls.at(-1)?.[0]).toContain('"profile": "core"');
  });

  it('sets a non-zero exit code only when something failed', async () => {
    // Never `process.exit()`: a piped JSON report would be truncated mid-object.
    await run();
    expect(process.exitCode).toBe(0);
    expect(exitSpy).not.toHaveBeenCalled();

    report.value.status = 'fail';
    await run();
    expect(process.exitCode).toBe(1);
    expect(exitSpy).not.toHaveBeenCalled();
  });
});
