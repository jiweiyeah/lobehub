'use client';

import { Flexbox, Icon, Markdown } from '@lobehub/ui';
import { Button, Tag, Text } from '@lobehub/ui/base-ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { FileText } from 'lucide-react';
import type { MouseEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { useAcceptanceBundle } from '@/features/Acceptance/hooks';
import { useChatStore } from '@/store/chat';

import {
  goalAcceptanceState,
  isFinalAcceptanceReady,
  latestRunStatus,
  pickAcceptanceReport,
} from './goalAcceptanceReport';
import type { GoalNodeView } from './goalGraphViewModel';

/**
 * The Goal's final acceptance report, in place of the task list.
 *
 * Once every task ran through and the final acceptance passed, nothing is left
 * to advance: what the owner reads next is the acceptance's judgment. So the
 * list gives way to that report — its title and a preview of its content — and
 * the full report opens in the side Portal, like every other drill-down here.
 * It is the report of the acceptance, not the acceptance Task's delivery: the
 * delivery is what was accepted, the report is what the owner signs off on.
 *
 * Until that point (see `isFinalAcceptanceReady`) the list stays exactly as it
 * was: a report over work that is still running or failing would claim a finish
 * that has not happened.
 */

const styles = createStaticStyles(({ css }) => ({
  document: css`
    cursor: pointer;

    display: flex;
    flex-direction: column;
    gap: 10px;

    width: 100%;
    padding-block: 16px;
    padding-inline: 18px;
    border: 1px solid ${cssVar.colorBorderSecondary};
    border-radius: ${cssVar.borderRadius};

    text-align: start;

    background: ${cssVar.colorBgContainer};

    &:hover {
      border-color: ${cssVar.colorBorder};
    }

    &:focus-visible {
      outline: 2px solid ${cssVar.colorPrimary};
      outline-offset: -2px;
    }
  `,
  preview: css`
    overflow: hidden;
    max-height: 320px;

    mask-image: linear-gradient(to bottom, #000 75%, transparent);
  `,
}));

interface GoalFinalAcceptanceProps {
  /** The task list, shown until the final acceptance has finished and passed. */
  children: ReactNode;
  /** The Goal's resolved final acceptance task, when there is one. */
  view?: GoalNodeView;
}

// The tag and the button are their own actions, not "open the report".
const stop = (event: MouseEvent) => event.stopPropagation();

const FinalAcceptanceReport = ({
  acceptance,
  children,
  view,
}: GoalFinalAcceptanceProps & {
  acceptance: NonNullable<GoalNodeView['acceptance']>;
  view: GoalNodeView;
}) => {
  const { t } = useTranslation('chat');
  const openAcceptance = useChatStore((s) => s.openAcceptance);
  const openVerifyReport = useChatStore((s) => s.openVerifyReport);

  const { data } = useAcceptanceBundle(acceptance.id);
  const rounds = data?.rounds ?? [];
  const state = goalAcceptanceState(acceptance.status, latestRunStatus(rounds));
  if (!data || !isFinalAcceptanceReady(view.node.status, state)) return <>{children}</>;

  const report = pickAcceptanceReport({ checks: data.checks, rounds });
  const open = () => (report ? openVerifyReport(report.runId) : openAcceptance(acceptance.id));

  return (
    <Flexbox gap={10}>
      <div
        className={styles.document}
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
          <Icon color={cssVar.colorTextSecondary} icon={FileText} size={16} />
          <Text ellipsis fontSize={15} style={{ flex: 1, minWidth: 0 }} weight={600}>
            {t('goalProcess.goalAcceptance.reportTitle')}
          </Text>
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
        </Flexbox>
        {typeof report?.totalChecks === 'number' && (
          <Text fontSize={12} type={'secondary'}>
            {t('goalProcess.goalAcceptance.checks', {
              passed: report.passedChecks ?? 0,
              total: report.totalChecks,
            })}
          </Text>
        )}
        {report?.content ? (
          <div className={styles.preview}>
            <Markdown fontSize={13} variant={'chat'}>
              {report.content}
            </Markdown>
          </div>
        ) : (
          <Text fontSize={12} type={'secondary'}>
            {t('goalProcess.goalAcceptance.reportPending')}
          </Text>
        )}
        <Text fontSize={12} type={'secondary'}>
          {t('goalProcess.goalAcceptance.viewFull')}
        </Text>
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

export const GoalFinalAcceptance = ({ children, view }: GoalFinalAcceptanceProps) => {
  if (!view?.acceptance) return <>{children}</>;
  return (
    <FinalAcceptanceReport acceptance={view.acceptance} view={view}>
      {children}
    </FinalAcceptanceReport>
  );
};
