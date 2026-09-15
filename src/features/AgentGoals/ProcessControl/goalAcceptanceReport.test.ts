import { describe, expect, it } from 'vitest';

import {
  goalAcceptanceState,
  latestAcceptanceReport,
  latestRunStatus,
} from './goalAcceptanceReport';

const round = (id: string, status: string, report: { summary: string } | null = null) => ({
  report,
  run: { id, status },
});

describe('goalAcceptanceState', () => {
  /**
   * Regression: the terminal acceptance only ever showed a small "待你确认" chip,
   * which read the same for a Goal awaiting sign-off and one that failed.
   */
  it('tells a passed delivery awaiting sign-off from one that needs a decision', () => {
    expect(goalAcceptanceState('delivered', 'passed')).toBe('awaitingAcceptance');
    expect(goalAcceptanceState('delivered', 'failed')).toBe('awaitingDecision');
    expect(goalAcceptanceState('delivered', undefined)).toBe('awaitingDecision');
  });

  it('maps the running and settled statuses', () => {
    expect(goalAcceptanceState('verifying')).toBe('inProgress');
    expect(goalAcceptanceState('repairing')).toBe('inProgress');
    expect(goalAcceptanceState('planned')).toBe('inProgress');
    expect(goalAcceptanceState('accepted')).toBe('accepted');
    expect(goalAcceptanceState('rejected')).toBe('rejected');
    expect(goalAcceptanceState('errored')).toBe('errored');
    expect(goalAcceptanceState('closed')).toBeUndefined();
  });
});

describe('latestAcceptanceReport', () => {
  it('returns the newest round that produced a report, with that round id', () => {
    const rounds = [
      round('r1', 'failed', { summary: 'first' }),
      round('r2', 'failed', { summary: 'second' }),
      round('r3', 'repairing'),
    ];

    expect(latestAcceptanceReport(rounds)).toEqual({ report: { summary: 'second' }, runId: 'r2' });
    expect(latestRunStatus(rounds)).toBe('repairing');
  });

  it('returns nothing before any round wrote a report', () => {
    expect(latestAcceptanceReport([round('r1', 'verifying')])).toBeUndefined();
    expect(latestRunStatus([])).toBeUndefined();
  });
});
