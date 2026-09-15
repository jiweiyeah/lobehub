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

interface DocumentArtifactLike {
  agentDocumentId?: string;
  createdAt: Date;
  resourceId: string | null;
  title: string | null;
  type: string;
}

interface FindingLike {
  createdAt: Date;
  description: string | null;
  id: string;
  resolvedAt?: Date | null;
  title: string;
}

export type FinalDelivery =
  | {
      /** The full Markdown report, else its short summary. */
      content: string | null;
      kind: 'report';
      passedChecks: number | null;
      runId: string;
      totalChecks: number | null;
    }
  | { agentDocumentId?: string; documentId: string; kind: 'document'; title: string | null }
  | { content: string | null; kind: 'finding'; nodeId: string; title: string };

/**
 * What the final acceptance delivered, in the order a reader trusts it: the
 * acceptance report when a round produced one, else the document the acceptance
 * Task registered, else its own final delivery (the newest finding it produced).
 *
 * The report is not guaranteed: it is written only when the settle path carries
 * the deliverable, and a round judged by the verifier agent often has none. The
 * acceptance Task's own delivery is still the Goal's final report in substance —
 * its contract is to return one auditable final delivery — so it stands in
 * rather than leaving the owner with an empty placeholder.
 */
export const pickFinalDelivery = <Report extends ReportLike>(params: {
  artifacts: DocumentArtifactLike[];
  findings: FindingLike[];
  rounds: RoundLike<Report>[];
}): FinalDelivery | undefined => {
  const latest = latestAcceptanceReport(params.rounds);
  if (latest) {
    return {
      content: latest.report.content || latest.report.summary,
      kind: 'report',
      passedChecks: latest.report.passedChecks,
      runId: latest.runId,
      totalChecks: latest.report.totalChecks,
    };
  }

  const document = params.artifacts
    .filter((artifact) => artifact.type === 'document' && artifact.resourceId)
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())[0];
  if (document?.resourceId) {
    return {
      agentDocumentId: document.agentDocumentId,
      documentId: document.resourceId,
      kind: 'document',
      title: document.title,
    };
  }

  const finding = [...params.findings].sort(
    (a, b) => (b.resolvedAt ?? b.createdAt).getTime() - (a.resolvedAt ?? a.createdAt).getTime(),
  )[0];
  if (finding) {
    return {
      content: finding.description,
      kind: 'finding',
      nodeId: finding.id,
      title: finding.title,
    };
  }
  return undefined;
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
