import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';

import { useDirectoryAgent } from './useDirectoryAgent';

vi.mock('@/store/home', () => ({
  useHomeStore: (selector: (state: unknown) => unknown) => selector({}),
}));
vi.mock('@/store/home/selectors', () => ({
  homeAgentListSelectors: {
    getAgentById: (id: string) => () =>
      id === 'selected-agent' ? { title: 'Selected Agent' } : undefined,
  },
}));
vi.mock('@/store/agent', () => ({
  useAgentStore: (selector: (state: unknown) => unknown) => selector({ agentMap: {} }),
}));

describe('useDirectoryAgent', () => {
  it('uses list metadata for the selected agent before its detail has been loaded', () => {
    const { result } = renderHook(() => useDirectoryAgent('coordinator'));
    expect(result.current.agentId).toBe('coordinator');
    act(() => result.current.setAgentId('selected-agent'));
    expect(result.current.agentId).toBe('selected-agent');
    expect(result.current.agentName).toBe('Selected Agent');
  });
});
