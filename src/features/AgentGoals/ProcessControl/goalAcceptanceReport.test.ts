import { describe, expect, it } from 'vitest';

import {
  goalAcceptanceState,
  isFinalAcceptanceReady,
  latestAcceptanceReport,
  latestRunStatus,
  pickAcceptanceReport,
} from './goalAcceptanceReport';

const round = <Report>(id: string, status: string, report: Report | null = null) => ({
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

describe('isFinalAcceptanceReady', () => {
  /**
   * Regression: the report view showed on an acceptance that was still lost and
   * retrying, next to a ledger of failed attempts. It belongs only to a Goal
   * whose final acceptance finished and waits on sign-off.
   */
  it('shows the report only once the acceptance task finished and passed', () => {
    expect(isFinalAcceptanceReady('resolved', 'awaitingAcceptance')).toBe(true);
    expect(isFinalAcceptanceReady('resolved', 'accepted')).toBe(true);
    expect(isFinalAcceptanceReady('active', 'awaitingAcceptance')).toBe(false);
    expect(isFinalAcceptanceReady('waiting', 'awaitingDecision')).toBe(false);
    expect(isFinalAcceptanceReady('resolved', 'awaitingDecision')).toBe(false);
    expect(isFinalAcceptanceReady('resolved', 'inProgress')).toBe(false);
    expect(isFinalAcceptanceReady('resolved', undefined)).toBe(false);
  });
});

describe('pickAcceptanceReport', () => {
  const report = {
    content: '# Final acceptance\n\nAll three checks passed.',
    passedChecks: 3,
    summary: 'All three checks passed.',
    totalChecks: 3,
  };
  const check = (title: string, verdict: string, reasoning?: string) => ({
    required: true,
    result: { status: verdict, toulmin: { reasoning }, verdict },
    title,
  });

  it('uses the report a round wrote', () => {
    expect(
      pickAcceptanceReport({
        checks: [check('Answer is correct', 'passed')],
        rounds: [round('r1', 'failed'), round('r2', 'passed', report)],
      }),
    ).toEqual({ content: report.content, passedChecks: 3, runId: 'r2', totalChecks: 3 });

    expect(
      pickAcceptanceReport({
        checks: [],
        rounds: [round('r1', 'passed', { ...report, content: null })],
      }),
    ).toMatchObject({ content: report.summary });
  });

  /**
   * Regression: with no written report the preview showed the acceptance Task's
   * own delivery ("已交付：1+1等于2"), which is the product being accepted, not
   * the acceptance report the owner signs off on.
   */
  it('reads the judgment off the latest round checks when no report was written', () => {
    const preview = pickAcceptanceReport({
      checks: [
        check(
          'Final reply states 1+1 in one sentence',
          'passed',
          'The reply is one sentence. It ends with 。',
        ),
        check(
          'Answer value is arithmetically correct',
          'passed',
          'The stated result is exactly 2.',
        ),
        { required: false, result: { verdict: 'failed' }, title: 'Optional polish' },
      ],
      rounds: [round('r1', 'failed'), round('r2', 'passed')],
    });

    expect(preview).toEqual({
      content:
        '- ✅ **Final reply states 1+1 in one sentence** — The reply is one sentence.\n' +
        '- ✅ **Answer value is arithmetically correct** — The stated result is exactly 2.',
      passedChecks: 2,
      runId: 'r2',
      totalChecks: 2,
    });
    expect(preview?.content).not.toContain('已交付');
  });

  it('marks a reason cut short instead of ending it mid-word', () => {
    const preview = pickAcceptanceReport({
      checks: [check('Deliverable is in the reply', 'passed', `${'word '.repeat(60)}end.`)],
      rounds: [round('r1', 'passed')],
    });

    expect(preview?.content).toMatch(/word…$/);
  });

  it('returns nothing before any round ran', () => {
    expect(pickAcceptanceReport({ checks: [], rounds: [] })).toBeUndefined();
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
