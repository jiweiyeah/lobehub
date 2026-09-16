import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { findCheck, makeContext, runCheck } from '../testUtils';
import { scopeChecks } from './scope';

const state = vi.hoisted(() => ({
  identity: undefined as string | undefined,
  stored: null as any,
}));
const saveActiveWorkspace = vi.hoisted(() => vi.fn());

vi.mock('../../settings', () => ({
  loadActiveWorkspace: () => state.stored,
  resolveServerUrl: () => 'https://app.lobehub.com',
  saveActiveWorkspace,
}));

vi.mock('../../auth/identity', () => ({ resolveIdentityFingerprint: () => state.identity }));

describe('scope.workspace', () => {
  beforeEach(() => {
    state.stored = null;
    state.identity = 'user:me';
    delete process.env.LOBEHUB_WORKSPACE_ID;
    delete process.env.LOBEHUB_JWT;
  });

  afterEach(() => {
    saveActiveWorkspace.mockClear();
  });

  it('reports personal scope when nothing is selected', async () => {
    const outcome = await runCheck(scopeChecks, 'scope.workspace');

    expect(outcome.status).toBe('ok');
    expect(outcome.detail).toContain('Personal scope');
  });

  it('fails a saved scope that belongs to another account', async () => {
    state.stored = {
      identity: 'user:someone-else',
      serverUrl: 'https://app.lobehub.com',
      workspaceId: 'ws_1',
    };

    const outcome = await runCheck(scopeChecks, 'scope.workspace');

    expect(outcome.status).toBe('fail');
    expect(outcome.detail).toContain('saved under a different account');
  });

  it('fails a saved scope that belongs to another server', async () => {
    state.stored = { identity: 'user:me', serverUrl: 'https://lobe.internal', workspaceId: 'ws_1' };

    const outcome = await runCheck(scopeChecks, 'scope.workspace');

    expect(outcome.status).toBe('fail');
    expect(outcome.detail).toContain('https://lobe.internal');
  });

  it('drops the stale scope under --fix', async () => {
    state.stored = {
      identity: 'user:someone-else',
      serverUrl: 'https://app.lobehub.com',
      workspaceId: 'ws_1',
    };
    const check = findCheck(scopeChecks, 'scope.workspace');

    const action = await check.repair!(makeContext({ fix: true }), {
      detail: '',
      durationMs: 0,
      group: 'scope',
      id: 'scope.workspace',
      status: 'fail',
      title: '',
    });

    expect(saveActiveWorkspace).toHaveBeenCalledWith(null);
    expect(action).toContain('cleared');
  });

  it('warns when the env var overrides a different saved scope', async () => {
    state.stored = {
      identity: 'user:me',
      serverUrl: 'https://app.lobehub.com',
      workspaceId: 'ws_1',
    };
    process.env.LOBEHUB_WORKSPACE_ID = 'ws_2';

    const outcome = await runCheck(scopeChecks, 'scope.workspace');

    expect(outcome.status).toBe('warn');
    expect(outcome.detail).toContain('ws_2');
  });

  it('treats a dispatched run as personal, ignoring the saved scope', async () => {
    state.stored = {
      identity: 'user:me',
      serverUrl: 'https://app.lobehub.com',
      workspaceId: 'ws_1',
    };
    process.env.LOBEHUB_JWT = 'header.payload.sig';

    const outcome = await runCheck(scopeChecks, 'scope.workspace');

    expect(outcome.status).toBe('ok');
    expect(outcome.detail).toContain('deliberately ignored');
  });
});
