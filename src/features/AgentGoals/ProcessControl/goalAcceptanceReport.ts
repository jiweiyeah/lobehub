/**
 * What the terminal Goal acceptance means to the person who owns the Goal.
 *
 * `delivered` alone cannot be rendered honestly: a round that passed and is
 * waiting for sign-off lands there, and so does one that ran out of rounds
 * without passing. The latest round's status tells them apart.
 */
export type GoalAcceptanceState =
  'accepted' | 'awaitingAcceptance' | 'awaitingDecision' | 'errored' | 'inProgress' | 'rejected';

export const goalAcceptanceState = (
  status: string,
  latestRunStatus?: string | null,
): GoalAcceptanceState | undefined => {
  switch (status) {
    case 'accepted': {
      return 'accepted';
    }
    case 'delivered': {
      return latestRunStatus === 'passed' ? 'awaitingAcceptance' : 'awaitingDecision';
    }
    case 'errored': {
      return 'errored';
    }
    case 'pending':
    case 'planned':
    case 'repairing':
    case 'verifying': {
      return 'inProgress';
    }
    case 'rejected': {
      return 'rejected';
    }
    default: {
      return undefined;
    }
  }
};

/**
 * Whether the final acceptance has earned its report view: the acceptance Task
 * finished (its node resolved) and the only thing left is the owner's sign-off,
 * or it was already signed off. Anything short of that — still running, lost,
 * failed, parked on a gate — is ordinary work and keeps the ordinary row.
 */
export const isFinalAcceptanceReady = (
  nodeStatus: string,
  state: GoalAcceptanceState | undefined,
): boolean => nodeStatus === 'resolved' && (state === 'awaitingAcceptance' || state === 'accepted');

interface ReportLike {
  content: string | null;
  passedChecks: number | null;
  summary: string | null;
  totalChecks: number | null;
}

interface CheckLike {
  required?: boolean;
  result?: {
    status?: string | null;
    toulmin?: { reasoning?: string | null } | null;
    verdict?: string | null;
  } | null;
  title: string;
}

export interface AcceptanceReportPreview {
  /** Markdown: the written report, or the round's check verdicts when none was written. */
  content: string | null;
  passedChecks: number | null;
  /** The round the report belongs to; its full view is the verify report of this run. */
  runId: string;
  totalChecks: number | null;
}

const VERDICT_MARK: Record<string, string> = { failed: '❌', passed: '✅', uncertain: '❔' };

const REASON_MAX_LENGTH = 160;

const firstSentence = (text?: string | null) => {
  const trimmed = text?.trim();
  if (!trimmed) return '';
  const sentence = /^[\s\S]*?[.。!！?？](?=\s|$)/.exec(trimmed)?.[0] ?? trimmed;
  return sentence.length > REASON_MAX_LENGTH
    ? `${sentence.slice(0, REASON_MAX_LENGTH).trimEnd()}…`
    : sentence;
};

/**
 * The final acceptance report itself — what the acceptance judged, never what
 * the acceptance Task delivered. A delivery is the product being accepted; the
 * owner signs off on the judgment of it.
 *
 * Prefers the report a round wrote. A round judged by the verifier agent often
 * writes none (the report is generated only when the settle path carries the
 * deliverable), so the same judgment is read off that round's checks instead:
 * each check's verdict and the reasoning behind it.
 */
export const pickAcceptanceReport = <Report extends ReportLike>(params: {
  checks: CheckLike[];
  rounds: RoundLike<Report>[];
}): AcceptanceReportPreview | undefined => {
  const written = latestAcceptanceReport(params.rounds);
  if (written) {
    return {
      content: written.report.content || written.report.summary,
      passedChecks: written.report.passedChecks,
      runId: written.runId,
      totalChecks: written.report.totalChecks,
    };
  }

  const latestRun = params.rounds.at(-1)?.run;
  if (!latestRun) return undefined;

  const judged = params.checks.filter((check) => check.required !== false && check.result);
  const verdictOf = (check: CheckLike) => check.result?.verdict ?? check.result?.status ?? '';
  const content = judged
    .map((check) => {
      const reason = firstSentence(check.result?.toulmin?.reasoning);
      return `- ${VERDICT_MARK[verdictOf(check)] ?? '•'} **${check.title}**${reason ? ` — ${reason}` : ''}`;
    })
    .join('\n');

  return {
    content: content || null,
    passedChecks: judged.filter((check) => verdictOf(check) === 'passed').length,
    runId: latestRun.id,
    totalChecks: judged.length,
  };
};

interface RoundLike<Report> {
  report: Report | null;
  run: { id: string; status: string | null };
}

/** Rounds arrive in round order; the newest one decides the state. */
export const latestRunStatus = <Report>(rounds: RoundLike<Report>[]): string | null | undefined =>
  rounds.at(-1)?.run.status;

/**
 * The newest round that produced a report. Not every round writes one (a round
 * repaired before it settled has none), so the latest round can be report-less
 * while an earlier one still says what the acceptance found.
 */
export const latestAcceptanceReport = <Report>(
  rounds: RoundLike<Report>[],
): { report: Report; runId: string } | undefined => {
  for (let index = rounds.length - 1; index >= 0; index--) {
    const round = rounds[index];
    if (round.report) return { report: round.report, runId: round.run.id };
  }
  return undefined;
};
