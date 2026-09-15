'use client';

import { Flexbox, Icon, Markdown } from '@lobehub/ui';
import { Button, Tag, Text } from '@lobehub/ui/base-ui';
import { createStaticStyles, cssVar } from 'antd-style';
import { FileText } from 'lucide-react';
import type { MouseEvent, ReactNode } from 'react';
import { useTranslation } from 'react-i18next';

import { useAcceptanceBundle } from '@/features/Acceptance/hooks';
import { useClientDataSWR } from '@/libs/swr';
import { portalKeys } from '@/libs/swr/keys';
import { documentService } from '@/services/document';
import { useChatStore } from '@/store/chat';

import {
  goalAcceptanceState,
  isFinalAcceptanceReady,
  latestRunStatus,
  pickFinalDelivery,
} from './goalAcceptanceReport';
import type { GoalNodeView } from './goalGraphViewModel';

/**
 * The Goal's final acceptance document, in place of the task list.
 *
 * Once every task ran through and the final acceptance passed, nothing is left
 * to advance: what the owner reads next is what the Goal concluded. So the list
 * gives way to that document — its title and a preview of its content — and the
 * full text opens in the side Portal, like every other drill-down on this page.
 *
 * Until that point (see `isFinalAcceptanceReady`) the list stays exactly as it
 * was: a document view over work that is still running or failing would claim a
 * finish that has not happened.
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
  goalId: string;
  /** The Goal's resolved final acceptance task, when there is one. */
  view?: GoalNodeView;
}

// The tag and the button are their own actions, not "open the document".
const stop = (event: MouseEvent) => event.stopPropagation();

const FinalAcceptanceDocument = ({
  acceptance,
  children,
  goalId,
  view,
}: GoalFinalAcceptanceProps & {
  acceptance: NonNullable<GoalNodeView['acceptance']>;
  view: GoalNodeView;
}) => {
  const { t } = useTranslation('chat');
  const openAcceptance = useChatStore((s) => s.openAcceptance);
  const openDocument = useChatStore((s) => s.openDocument);
  const openGoalNode = useChatStore((s) => s.openGoalNode);
  const openVerifyReport = useChatStore((s) => s.openVerifyReport);

  const { data } = useAcceptanceBundle(acceptance.id);
  const rounds = data?.rounds ?? [];
  const state = goalAcceptanceState(acceptance.status, latestRunStatus(rounds));
  const ready = !!data && isFinalAcceptanceReady(view.node.status, state);
  const delivery = ready
    ? pickFinalDelivery({ artifacts: view.artifacts, findings: view.findings, rounds })
    : undefined;

  // A registered document carries only its id on the graph; its content is read
  // with the same key the document Portal uses, so opening it is instant.
  const documentId = delivery?.kind === 'document' ? delivery.documentId : null;
  const { data: document } = useClientDataSWR(
    documentId ? portalKeys.documentHeader(documentId) : null,
    () => documentService.getDocumentById(documentId!),
  );

  if (!ready) return <>{children}</>;

  const title =
    delivery?.kind === 'finding'
      ? delivery.title
      : delivery?.kind === 'document'
        ? document?.title || delivery.title || t('goalProcess.goalAcceptance.reportTitle')
        : t('goalProcess.goalAcceptance.reportTitle');
  const content = delivery?.kind === 'document' ? document?.content : delivery?.content;

  const open = () => {
    if (!delivery) return openAcceptance(acceptance.id);
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
            {title}
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
        {delivery?.kind === 'report' && typeof delivery.totalChecks === 'number' && (
          <Text fontSize={12} type={'secondary'}>
            {t('goalProcess.goalAcceptance.checks', {
              passed: delivery.passedChecks ?? 0,
              total: delivery.totalChecks,
            })}
          </Text>
        )}
        {content ? (
          <div className={styles.preview}>
            <Markdown fontSize={13} variant={'chat'}>
              {content}
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

export const GoalFinalAcceptance = ({ children, goalId, view }: GoalFinalAcceptanceProps) => {
  if (!view?.acceptance) return <>{children}</>;
  return (
    <FinalAcceptanceDocument acceptance={view.acceptance} goalId={goalId} view={view}>
      {children}
    </FinalAcceptanceDocument>
  );
};
