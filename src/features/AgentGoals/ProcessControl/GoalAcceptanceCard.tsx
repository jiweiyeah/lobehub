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
  latestAcceptanceReport,
  latestRunStatus,
} from './goalAcceptanceReport';
import type { GoalNodeView } from './goalGraphViewModel';

/**
 * The terminal Goal acceptance, shown as the thing waiting on its owner rather
 * than one more task row: its state says whether the Goal awaits sign-off, and
 * the final acceptance report sits right under it as a preview. The full text
 * opens in the side Portal, like every other drill-down on this page, so the
 * reader never leaves the Goal to read what it concluded.
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
  `,
}));

type Acceptance = NonNullable<GoalNodeView['acceptance']>;

const STATE_COLOR = {
  accepted: 'success',
  awaitingAcceptance: 'warning',
  awaitingDecision: 'error',
  errored: 'error',
  inProgress: 'info',
  rejected: 'error',
} as const;

// Everything here is its own action; none of it should also open the row's task.
const stop = (event: MouseEvent) => event.stopPropagation();

export const GoalAcceptanceTag = ({ acceptance }: { acceptance: Acceptance }) => {
  const { t } = useTranslation('chat');
  const openAcceptance = useChatStore((s) => s.openAcceptance);
  const { data } = useAcceptanceBundle(acceptance.id);
  const state = goalAcceptanceState(acceptance.status, latestRunStatus(data?.rounds ?? []));
  if (!state) return null;

  return (
    <Tag
      color={STATE_COLOR[state]}
      size={'small'}
      style={{ cursor: 'pointer' }}
      onClick={(event) => {
        stop(event);
        openAcceptance(acceptance.id);
      }}
    >
      {t(`goalProcess.goalAcceptance.state.${state}` as const)}
    </Tag>
  );
};

export const GoalAcceptanceReportCard = ({ acceptance }: { acceptance: Acceptance }) => {
  const { t } = useTranslation('chat');
  const openAcceptance = useChatStore((s) => s.openAcceptance);
  const openVerifyReport = useChatStore((s) => s.openVerifyReport);
  const { data } = useAcceptanceBundle(acceptance.id);
  if (!data) return null;

  const latest = latestAcceptanceReport(data.rounds);
  const state = goalAcceptanceState(acceptance.status, latestRunStatus(data.rounds));

  if (!latest) {
    return (
      <Text fontSize={12} type={'secondary'}>
        {t('goalProcess.goalAcceptance.reportPending')}
      </Text>
    );
  }

  const { report, runId } = latest;
  const openReport = () => openVerifyReport(runId);

  return (
    <Flexbox gap={8} onClick={stop}>
      <div
        className={styles.card}
        role={'button'}
        tabIndex={0}
        onClick={openReport}
        onKeyDown={(event) => {
          if (event.key !== 'Enter' && event.key !== ' ') return;
          event.preventDefault();
          openReport();
        }}
      >
        <Flexbox horizontal align={'center'} gap={8}>
          <Icon icon={FileText} size={14} />
          <Text fontSize={13} weight={500}>
            {t('goalProcess.goalAcceptance.reportTitle')}
          </Text>
          {typeof report.totalChecks === 'number' && (
            <Text fontSize={12} type={'secondary'}>
              {t('goalProcess.goalAcceptance.checks', {
                passed: report.passedChecks ?? 0,
                total: report.totalChecks,
              })}
            </Text>
          )}
          <Flexbox flex={1} />
          <Text fontSize={12} type={'secondary'}>
            {t('goalProcess.goalAcceptance.viewFull')}
          </Text>
        </Flexbox>
        {report.summary && <div className={styles.summary}>{report.summary}</div>}
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
