import { beforeEach, describe, expect, it, vi } from 'vitest';

import { makeContext, runCheck } from '../testUtils';
import { executionChecks } from './execution';

const state = vi.hoisted(() => ({
  agentConfig: {} as any,
  builtinAgent: null as any,
  globalConfig: {} as any,
  providers: [] as any[],
  started: {} as any,
  statuses: [] as any[],
}));

const heteroDetect = vi.hoisted(() => vi.fn());

vi.mock('@lobechat/heterogeneous-agents/resolveCliCommand', () => ({
  DEFAULT_HETERO_COMMAND: { 'claude-code': 'claude', 'codex': 'codex' },
  detectHeterogeneousCliCommand: heteroDetect,
}));

vi.mock('../probes', () => ({
  probeClient: async () => ({
    agent: {
      getAgentConfigById: {
        query: async ({ agentId }: { agentId: string }) =>
          agentId === 'agt_known' ? state.agentConfig : null,
      },
      getBuiltinAgent: { query: async () => state.builtinAgent },
    },
    aiAgent: {
      execAgent: { mutate: async () => state.started },
      getOperationStatus: { query: async () => state.statuses.shift() ?? null },
    },
  }),
  probeGlobalConfig: async () => state.globalConfig,
  probeProviders: async () => state.providers,
}));

const deepContext = () => makeContext({ agent: 'agt_known', deep: true, timeoutMs: 1000 });

describe('execution.agent', () => {
  beforeEach(() => {
    state.agentConfig = { model: 'glm-5.3-flash', provider: 'lobehub', title: 'Architect' };
    state.builtinAgent = null;
    state.globalConfig = { serverConfig: { aiProvider: { lobehub: { enabled: true } } } };
    state.providers = [];
  });

  it('skips itself when no agent was named', async () => {
    const outcome = await runCheck(executionChecks, 'execution.agent', makeContext());

    expect(outcome.status).toBe('skip');
    expect(outcome.skippedBecause).toBe('--agent');
  });

  it('names the env var to set when the agent’s provider has no credential', async () => {
    state.agentConfig = { model: 'kimi-k3', provider: 'fireworksai' };

    const outcome = await runCheck(
      executionChecks,
      'execution.agent',
      makeContext({ agent: 'agt_known' }),
    );

    expect(outcome.status).toBe('fail');
    expect(outcome.fix).toContain('FIREWORKSAI_API_KEY');
  });

  it('passes when the provider is usable', async () => {
    const outcome = await runCheck(
      executionChecks,
      'execution.agent',
      makeContext({ agent: 'agt_known' }),
    );

    expect(outcome.status).toBe('ok');
    expect(outcome.detail).toContain('usable credential');
  });

  it('falls back to a slug lookup when the value is not an id', async () => {
    state.builtinAgent = { id: 'agt_known' };

    const outcome = await runCheck(
      executionChecks,
      'execution.agent',
      makeContext({ agent: 'inbox' }),
    );

    expect(outcome.status).toBe('ok');
  });

  it('fails when nothing matches', async () => {
    const outcome = await runCheck(
      executionChecks,
      'execution.agent',
      makeContext({ agent: 'nope' }),
    );

    expect(outcome.status).toBe('fail');
    expect(outcome.detail).toContain('No agent matches');
  });

  it('warns when the agent has no model pinned', async () => {
    state.agentConfig = { title: 'Architect' };

    const outcome = await runCheck(
      executionChecks,
      'execution.agent',
      makeContext({ agent: 'agt_known' }),
    );

    expect(outcome.status).toBe('warn');
  });
});

describe('execution.round-trip', () => {
  beforeEach(() => {
    state.started = { operationId: 'op_1', success: true, topicId: 'tpc_1' };
    state.statuses = [];
  });

  it('waits out the non-terminal states and reports tokens and cost', async () => {
    state.statuses = [
      { currentState: { status: 'idle' }, isCompleted: false },
      {
        currentState: { status: 'done', usage: { llm: { tokens: { total: 54_396 } } } },
        isCompleted: true,
        stats: { totalCost: 0.005_524, totalSteps: 1 },
      },
    ];

    const outcome = await runCheck(executionChecks, 'execution.round-trip', deepContext());

    expect(outcome.status).toBe('ok');
    expect(outcome.detail).toContain('54396 tokens');
    expect(outcome.detail).toContain('$0.0055');
  });

  it('reports the run error rather than the transport', async () => {
    state.statuses = [
      {
        hasError: true,
        recentEvents: [{ data: { errorType: 'InvalidProviderAPIKey' }, type: 'error' }],
      },
    ];

    const outcome = await runCheck(executionChecks, 'execution.round-trip', deepContext());

    expect(outcome.status).toBe('fail');
    expect(outcome.detail).toContain('InvalidProviderAPIKey');
  });

  it('surfaces a headless run that still stopped for human input', async () => {
    state.statuses = [{ isCompleted: false, needsHumanInput: true }];

    const outcome = await runCheck(executionChecks, 'execution.round-trip', deepContext());

    expect(outcome.status).toBe('warn');
    expect(outcome.detail).toContain('waiting for human input');
  });

  it('treats an untracked operation as finished', async () => {
    state.statuses = [];

    const outcome = await runCheck(executionChecks, 'execution.round-trip', deepContext());

    expect(outcome.status).toBe('ok');
    expect(outcome.detail).toContain('no longer tracked');
  });

  it('reports the server refusing to start the run', async () => {
    state.started = { error: 'quota exhausted', success: false };

    const outcome = await runCheck(executionChecks, 'execution.round-trip', deepContext());

    expect(outcome.status).toBe('fail');
    expect(outcome.detail).toContain('quota exhausted');
  });
});

describe('execution.hetero', () => {
  beforeEach(() => {
    heteroDetect.mockReset();
  });

  it('reports the resolved binaries', async () => {
    heteroDetect.mockImplementation(async (type: string) => ({
      available: true,
      path: `/usr/bin/${type}`,
      version: '1.2.3',
    }));

    const outcome = await runCheck(executionChecks, 'execution.hetero', makeContext());

    expect(outcome.status).toBe('ok');
    expect(outcome.detail).toContain('claude-code 1.2.3');
  });

  it('only fails on a missing agent the caller asked for', async () => {
    heteroDetect.mockImplementation(async (type: string) => ({
      available: type === 'codex',
      error: 'not found',
      path: '/usr/bin/codex',
    }));

    const ambient = await runCheck(executionChecks, 'execution.hetero', makeContext());
    const explicit = await runCheck(
      executionChecks,
      'execution.hetero',
      makeContext({ hetero: ['claude-code', 'codex'] }),
    );

    expect(ambient.status).toBe('ok');
    expect(explicit.status).toBe('fail');
  });
});
