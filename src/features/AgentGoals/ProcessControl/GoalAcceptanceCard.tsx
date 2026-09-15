'use client';

import { Flexbox, Icon } from '@lobehub/ui';
import { Button, Tag, Text } from '@lobehub/ui/base-ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { FileText } from 'lucide-react';
import type { MouseEvent } from 'react';
import { useTranslation } from 'react-i18next';

import { useAcceptanceBundle } from '@/features/Acceptance/hooks';
import { useChatStore } from '@/store/chat';

import {
  goalAcceptanceState,
  isFinalAcceptanceReady,
  latestRunStatus,
  pickFinalDelivery,
} from './goalAcceptanceReport';
import type { GoalNodeView } from './goalGraphViewModel';

/**
 * The Goal's final acceptance once everything ran through: instead of one more
 * finished task row it says the Goal awaits its owner's sign-off, with the final
 * acceptance report right under it as a preview. The full text opens in the
 * side Portal, like every other drill-down on this page, so the reader never
 * leaves the Goal to read what it concluded.
 *
 * Both parts render nothing until that point (see `isFinalAcceptanceReady`): a
 * report view on an acceptance that is still running or failing would claim a
 * finish that has not happened.
 */

const styles = createStaticStyles(({ css }) => ({
  card: css`
    cursor: pointer;

    display: flex;
    flex-direction: column;
    gap: 6px;

    width: 100%;
    padding-block: 10px;
    padding-inline: 12px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadius};

    text-align: start;

    background: ${cssVar.colorFillQuaternary};

    &:hover {
      border-color: ${cssVar.colorBorder};
    }

    &:focus-visible {
      outline: 2px solid ${cssVar.colorPrimary};
      outline-offset: -2px;
    }
  `,
  summary: css`
    overflow: hidden;
    display: -webkit-box;
    -webkit-box-orient: vertical;
    -webkit-line-clamp: 3;

    font-size: 13px;
    line-height: 1.6;
    color: ${cssVar.colorTextSecondary};
    white-space: pre-line;
  `,
}));

type Acceptance = NonNullable<GoalNodeView['acceptance']>;

// Everything here is its own action; none of it should also open the row's task.
const stop = (event: MouseEvent) => event.stopPropagation();

const useFinalAcceptance = (acceptance: Acceptance, nodeStatus: string) => {
  const { data } = useAcceptanceBundle(acceptance.id);
  const rounds = data?.rounds ?? [];
  const state = goalAcceptanceState(acceptance.status, latestRunStatus(rounds));
  return {
    ready: !!data && isFinalAcceptanceReady(nodeStatus, state),
    rounds,
    state,
  };
};

export const GoalAcceptanceTag = ({
  acceptance,
  nodeStatus,
}: {
  acceptance: Acceptance;
  nodeStatus: string;
}) => {
  const { t } = useTranslation('chat');
  const openAcceptance = useChatStore((s) => s.openAcceptance);
  const { ready, state } = useFinalAcceptance(acceptance, nodeStatus);
  if (!ready) return null;

  return (
    <Tag
      color={state === 'accepted' ? 'success' : 'warning'}
      size={'small'}
      style={{ cursor: 'pointer' }}
      onClick={(event) => {
        stop(event);
        openAcceptance(acceptance.id);
      }}
    >
      {t(
        state === 'accepted'
          ? 'goalProcess.goalAcceptance.state.accepted'
          : 'goalProcess.goalAcceptance.state.awaitingAcceptance',
      )}
    </Tag>
  );
};

export const GoalAcceptanceReportCard = ({
  acceptance,
  goalId,
  view,
}: {
  acceptance: Acceptance;
  goalId: string;
  view: GoalNodeView;
}) => {
  const { t } = useTranslation('chat');
  const openAcceptance = useChatStore((s) => s.openAcceptance);
  const openDocument = useChatStore((s) => s.openDocument);
  const openGoalNode = useChatStore((s) => s.openGoalNode);
  const openVerifyReport = useChatStore((s) => s.openVerifyReport);
  const { ready, rounds, state } = useFinalAcceptance(acceptance, view.node.status);
  if (!ready) return null;

  const delivery = pickFinalDelivery({
    artifacts: view.artifacts,
    findings: view.findings,
    rounds,
  });
  if (!delivery) {
    return (
      <Text fontSize={12} type={'secondary'}>
        {t('goalProcess.goalAcceptance.reportPending')}
      </Text>
    );
  }

  const open = () => {
    switch (delivery.kind) {
      case 'report': {
        openVerifyReport(delivery.runId);
        break;
      }
      case 'document': {
        openDocument(delivery.documentId, delivery.agentDocumentId);
        break;
      }
      case 'finding': {
        openGoalNode(goalId, delivery.nodeId);
        break;
      }
    }
  };
  const summary = delivery.kind === 'document' ? delivery.title : delivery.summary;

  return (
    <Flexbox gap={8} onClick={stop}>
      <div
        className={styles.card}
        role={'button'}
        tabIndex={0}
        onClick={open}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          open();
        }}
      >
        <Flexbox horizontal align={'center'} gap={8}>
          <Icon icon={FileText} size={14} />
          <Text fontSize={13} weight={500}>
            {t('goalProcess.goalAcceptance.reportTitle')}
          </Text>
          {delivery.kind === 'report' && typeof delivery.totalChecks === 'number' && (
            <Text fontSize={12} type={'secondary'}>
              {t('goalProcess.goalAcceptance.checks', {
                passed: delivery.passedChecks ?? 0,
                total: delivery.totalChecks,
              })}
            </Text>
          )}
          <Flexbox flex={1} />
          <Text fontSize={12} type={'secondary'}>
            {t('goalProcess.goalAcceptance.viewFull')}
          </Text>
        </Flexbox>
        {summary && <div className={styles.summary}>{summary}</div>}
      </div>
      {state === 'awaitingAcceptance' && (
        <Flexbox horizontal>
          <Button size={'small'} type={'primary'} onClick={() => openAcceptance(acceptance.id)}>
            {t('goalProcess.goalAcceptance.review')}
          </Button>
        </Flexbox>
      )}
    </Flexbox>
  );
};
