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
