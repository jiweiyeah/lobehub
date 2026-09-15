import { AGENT_CHAT_URL } from '@lobechat/const';
import { Flexbox } from '@lobehub/ui';
import { Button, Text } from '@lobehub/ui/base-ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import AsyncError from '@/components/AsyncError';
import AssigneeAgentSelector from '@/features/AgentTasks/features/AssigneeAgentSelector';
import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';
import type { ProjectDirectory } from '@/store/projectWorkingDirectory';
import { useProjectDirectoryStore } from '@/store/projectWorkingDirectory';

import { openBindDirectoryModal } from './BindDirectoryModal';
import { useDirectoryAgent } from './useDirectoryAgent';

function DirectoryWork({
  directory,
  coordinatorAgentId,
}: {
  directory: ProjectDirectory;
  coordinatorAgentId: string;
}) {
  const { t } = useTranslation('project');
  const navigate = useWorkspaceAwareNavigate();
  const { agentId, agentName, setAgentId } = useDirectoryAgent(coordinatorAgentId);
  const [expanded, setExpanded] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>();
  const topics = useProjectDirectoryStore((s) => s.useFetchDirectoryTopics)(
    expanded ? directory.id : undefined,
  );
  const startTopic = useProjectDirectoryStore((s) => s.startTopic);
  const start = async () => {
    setPending(true);
    setError(undefined);
    try {
      const topic = await startTopic(directory.id, agentId, directory.name);
      navigate(`${AGENT_CHAT_URL(agentId)}/${topic.id}`);
    } catch (error) {
      console.error('Failed to start project work', error);
      setError(error);
    } finally {
      setPending(false);
    }
  };
  return (
    <Flexbox gap={8} paddingBlock={16}>
      <Text weight={600}>{directory.name}</Text>
      <Text type="secondary">
        {directory.deviceName || directory.deviceId} · {directory.path}
      </Text>
      {directory.configuration?.sources?.map((source) =>
        source.kind === 'git' ? (
          <a href={source.url} key={source.url} rel="noreferrer" target="_blank">
            {source.url}
          </a>
        ) : null,
      )}
      <Flexbox horizontal gap={8} wrap="wrap">
        {!directory.instanceId && (
          <Button
            onClick={() =>
              openBindDirectoryModal({
                projectId: directory.projectId,
                deviceId: directory.deviceId,
                path: directory.path,
              })
            }
          >
            {t('directories.bind')}
          </Button>
        )}
        <AssigneeAgentSelector
          currentAgentId={agentId}
          disabled={pending}
          onChange={(id) => id && setAgentId(id)}
        >
          <span>{agentName || t('directories.coordinator')}</span>
        </AssigneeAgentSelector>
        <Button disabled={!directory.instanceId} loading={pending} onClick={start}>
          {t('directories.start')}
        </Button>
        <Button onClick={() => setExpanded(!expanded)}>{t('directories.conversations')}</Button>
      </Flexbox>
      {error ? (
        <AsyncError
          error={error}
          description={
            error instanceof Error && error.message.includes('Device is offline')
              ? t('directories.unavailable')
              : error instanceof Error
                ? error.message
                : undefined
          }
          onRetry={start}
        />
      ) : null}
      {expanded &&
        (topics.error ? (
          <AsyncError error={topics.error} onRetry={topics.mutate} />
        ) : topics.isLoading ? (
          <Text>{t('loading', { ns: 'common' })}</Text>
        ) : topics.data?.data.length ? (
          topics.data.data.map((topic) => (
            <Button
              key={topic.id}
              onClick={() =>
                topic.agentId && navigate(`${AGENT_CHAT_URL(topic.agentId)}/${topic.id}`)
              }
            >
              {topic.title || t('directories.untitled')}
            </Button>
          ))
        ) : (
          <Text type="secondary">{t('directories.noConversations')}</Text>
        ))}
    </Flexbox>
  );
}

export function ProjectWorkingDirectories({
  projectId,
  coordinatorAgentId,
}: {
  projectId: string;
  coordinatorAgentId: string;
}) {
  const { t } = useTranslation('project');
  const request = useProjectDirectoryStore((s) => s.useFetchDirectories)(projectId);
  return (
    <Flexbox gap={16} id="working-directories" paddingBlock={24}>
      <Flexbox horizontal align="center" justify="space-between">
        <Text fontSize={20} weight={600}>
          {t('directories.title')}
        </Text>
        <Button onClick={() => openBindDirectoryModal({ projectId })}>
          {t('directories.add')}
        </Button>
      </Flexbox>
      {request.error ? (
        <AsyncError error={request.error} onRetry={request.mutate} />
      ) : request.isLoading ? (
        <Text>{t('loading', { ns: 'common' })}</Text>
      ) : request.data?.data.length ? (
        request.data.data.map((directory) => (
          <DirectoryWork
            coordinatorAgentId={coordinatorAgentId}
            directory={directory}
            key={directory.id}
          />
        ))
      ) : (
        <Text type="secondary">{t('directories.empty')}</Text>
      )}
    </Flexbox>
  );
}
