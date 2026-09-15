import { describe, expect, it } from 'vitest';

import {
  goalAcceptanceState,
  isFinalAcceptanceReady,
  latestAcceptanceReport,
  latestRunStatus,
  pickFinalDelivery,
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

describe('pickFinalDelivery', () => {
  const report = {
    content: '# Final acceptance\n\nAll three checks passed.',
    passedChecks: 3,
    summary: 'All three checks passed.',
    totalChecks: 3,
  };
  const finding = (id: string, minute: number) => ({
    createdAt: new Date(2026, 8, 15, 22, minute),
    description: `结论：delivery ${id}`,
    id,
    title: `已交付 ${id}`,
  });
  const doc = (id: string, minute: number) => ({
    createdAt: new Date(2026, 8, 15, 22, minute),
    resourceId: id,
    title: `Report ${id}`,
    type: 'document',
  });

  it('prefers the acceptance report when a round produced one', () => {
    expect(
      pickFinalDelivery({
        artifacts: [doc('docs_1', 1)],
        findings: [finding('f1', 1)],
        rounds: [round('r1', 'passed', report)],
      }),
    ).toEqual({
      content: report.content,
      kind: 'report',
      passedChecks: 3,
      runId: 'r1',
      totalChecks: 3,
    });
  });

  it('previews the report summary when the round has no full report text', () => {
    expect(
      pickFinalDelivery({
        artifacts: [],
        findings: [],
        rounds: [round('r1', 'passed', { ...report, content: null })],
      }),
    ).toMatchObject({ content: report.summary, kind: 'report' });
  });

  /**
   * Regression: a final acceptance judged by the verifier agent passed with no
   * report row, so the finished Goal showed only "the report shows up here".
   */
  it('falls back to the acceptance task delivery when no round wrote a report', () => {
    expect(
      pickFinalDelivery({
        artifacts: [doc('docs_old', 1), doc('docs_new', 5)],
        findings: [finding('f1', 1)],
        rounds: [round('r1', 'passed')],
      }),
    ).toEqual({ documentId: 'docs_new', kind: 'document', title: 'Report docs_new' });

    expect(
      pickFinalDelivery({
        artifacts: [],
        findings: [finding('f_old', 1), finding('f_new', 9)],
        rounds: [round('r1', 'passed')],
      }),
    ).toEqual({
      content: '结论：delivery f_new',
      kind: 'finding',
      nodeId: 'f_new',
      title: '已交付 f_new',
    });
  });

  it('returns nothing when the acceptance has produced nothing yet', () => {
    expect(pickFinalDelivery({ artifacts: [], findings: [], rounds: [] })).toBeUndefined();
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
