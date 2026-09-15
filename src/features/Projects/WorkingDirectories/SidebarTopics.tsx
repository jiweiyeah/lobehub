import { AGENT_CHAT_TOPIC_URL } from '@lobechat/const';
import { Flexbox } from '@lobehub/ui';
import {
  ActionIcon,
  Avatar,
  Button,
  createModal,
  ModalFooter,
  Text,
  useModalContext,
} from '@lobehub/ui/base-ui';
import { t } from 'i18next';
import { PlusIcon } from 'lucide-react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import AsyncError from '@/components/AsyncError';
import AssigneeAgentSelector from '@/features/AgentTasks/features/AssigneeAgentSelector';
import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';
import { useAgentStore } from '@/store/agent';
import { builtinAgentSelectors } from '@/store/agent/selectors';
import type { ProjectDirectory } from '@/store/projectWorkingDirectory';
import { useProjectDirectoryStore } from '@/store/projectWorkingDirectory';

import { directoryAgentName, useDirectoryAgent } from './useDirectoryAgent';

function StartDirectoryContent({
  directory,
  coordinatorAgentId,
}: {
  directory: ProjectDirectory;
  coordinatorAgentId: string;
}) {
  const { t } = useTranslation('project');
  const { close } = useModalContext();
  const navigate = useWorkspaceAwareNavigate();
  const { agentId, agentName, setAgentId } = useDirectoryAgent(coordinatorAgentId);
  const startTopic = useProjectDirectoryStore((s) => s.startTopic);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>();
  const start = async () => {
    setPending(true);
    setError(undefined);
    try {
      const topic = await startTopic(directory.id, agentId, directory.name);
      close();
      navigate(AGENT_CHAT_TOPIC_URL(agentId, topic.id));
    } catch (error) {
      console.error('Failed to start directory work', error);
      setError(error);
    } finally {
      setPending(false);
    }
  };
  return (
    <>
      <Flexbox gap={16} padding={16}>
        <Text>{directory.name}</Text>
        <Text type="secondary">
          {directory.deviceName || directory.deviceId} · {directory.path}
        </Text>
        <AssigneeAgentSelector
          currentAgentId={agentId}
          disabled={pending}
          onChange={(id) => id && setAgentId(id)}
        >
          <span>{agentName || t('directories.coordinator')}</span>
        </AssigneeAgentSelector>
        {error ? (
          <AsyncError
            description={error instanceof Error ? error.message : undefined}
            error={error}
            onRetry={start}
          />
        ) : null}
      </Flexbox>
      <ModalFooter>
        <Button disabled={pending} onClick={close}>
          {t('cancel', { ns: 'common' })}
        </Button>
        <Button loading={pending} type="primary" onClick={start}>
          {t('directories.start')}
        </Button>
      </ModalFooter>
    </>
  );
}
function DirectoryTopics({
  directory,
  coordinatorAgentId,
}: {
  directory: ProjectDirectory;
  coordinatorAgentId: string;
}) {
  const { t } = useTranslation('project');
  const navigate = useWorkspaceAwareNavigate();
  const request = useProjectDirectoryStore((s) => s.useFetchDirectoryTopics)(directory.id);
  const inboxId = useAgentStore(builtinAgentSelectors.inboxAgentId);
  const agentLabel = (topic: {
    agentId: string | null;
    agentName: string | null;
    agentTitle: string | null;
  }) =>
    directoryAgentName(
      { name: topic.agentName, title: topic.agentTitle },
      topic.agentId === inboxId,
      t('inbox.title', { ns: 'chat' }),
    ) ?? t('untitledAgent', { ns: 'chat' });
  return (
    <Flexbox gap={4} paddingBlock={8}>
      <Flexbox horizontal align="center" justify="space-between" paddingInline={8}>
        <Text ellipsis fontSize={12} type="secondary">
          {directory.name}
        </Text>
        <ActionIcon
          aria-label={t('directories.start')}
          disabled={!directory.instanceId}
          icon={PlusIcon}
          size="small"
          title={t('directories.start')}
          onClick={() =>
            createModal({
              title: t('directories.start'),
              content: (
                <StartDirectoryContent
                  coordinatorAgentId={coordinatorAgentId}
                  directory={directory}
                />
              ),
              footer: null,
              width: 440,
            })
          }
        />
      </Flexbox>
      {request.error ? (
        <AsyncError error={request.error} variant="inline" onRetry={request.mutate} />
      ) : request.isLoading ? (
        <Text>{t('loading', { ns: 'common' })}</Text>
      ) : request.data?.data.length ? (
        request.data.data.map((topic) => (
          <Button
            key={topic.id}
            style={{ height: 'auto', justifyContent: 'start', padding: 8 }}
            type="text"
            onClick={() => topic.agentId && navigate(AGENT_CHAT_TOPIC_URL(topic.agentId, topic.id))}
          >
            <Flexbox align="start" gap={4} style={{ minWidth: 0, width: '100%' }}>
              <Text ellipsis style={{ maxWidth: '100%' }}>
                {topic.title || t('directories.untitled')}
              </Text>
              <Flexbox horizontal align="center" gap={4}>
                <Avatar avatar={topic.agentAvatar || agentLabel(topic)} size={16} />
                <Text fontSize={11} type="secondary">
                  {agentLabel(topic)}
                </Text>
              </Flexbox>
            </Flexbox>
          </Button>
        ))
      ) : (
        <Text fontSize={12} style={{ paddingInline: 8 }} type="secondary">
          {t('directories.noConversations')}
        </Text>
      )}
    </Flexbox>
  );
}
export function ProjectDirectoryTopics({
  projectId,
  coordinatorAgentId,
}: {
  projectId: string;
  coordinatorAgentId: string;
}) {
  const request = useProjectDirectoryStore((s) => s.useFetchDirectories)(projectId);
  return (
    <Flexbox gap={8}>
      <Text fontSize={12} style={{ paddingInline: 8 }} type="secondary">
        {t('directories.title', { ns: 'project' })}
      </Text>
      {request.error ? (
        <AsyncError error={request.error} variant="inline" onRetry={request.mutate} />
      ) : (
        request.data?.data.map((directory) => (
          <DirectoryTopics
            coordinatorAgentId={coordinatorAgentId}
            directory={directory}
            key={directory.id}
          />
        ))
      )}
    </Flexbox>
  );
}
