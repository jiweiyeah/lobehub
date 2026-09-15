import { Flexbox } from '@lobehub/ui';
import { Button, Text } from '@lobehub/ui/base-ui';
import { useTranslation } from 'react-i18next';

import AsyncError from '@/components/AsyncError';
import { useWorkspaceAwareNavigate } from '@/features/Workspace/useWorkspaceAwareNavigate';
import { useChatStore } from '@/store/chat';
import { topicSelectors } from '@/store/chat/selectors';
import { useProjectDirectoryStore } from '@/store/projectWorkingDirectory';

export function TopicProjectLink({ topicId }: { topicId?: string | null }) {
  const { t } = useTranslation('project');
  const navigate = useWorkspaceAwareNavigate();
  useChatStore((s) => s.useFetchTopicDetail)(topicId);
  const topic = useChatStore(topicSelectors.getTopicById(topicId ?? ''));
  const request = useProjectDirectoryStore((s) => s.useFetchDirectories)(
    topic?.projectId ?? undefined,
    !!topic?.projectWorkingDirectoryId,
  );
  if (!topic?.projectWorkingDirectoryId && !topic?.metadata?.projectExecution) return null;
  if (request.isLoading) return <Text>{t('loading', { ns: 'common' })}</Text>;
  if (request.error) return <AsyncError error={request.error} onRetry={request.mutate} />;
  const directory = request.data?.data.find((item) => item.id === topic.projectWorkingDirectoryId);
  return (
    <Flexbox horizontal align="center" gap={8} padding={8}>
      <Button
        disabled={!directory}
        size="small"
        onClick={() =>
          directory &&
          navigate(`/project/${directory.projectSlug ?? directory.projectId}/working-directories`)
        }
      >
        {directory
          ? t('directories.openProject', { name: directory.projectName })
          : t('directories.title')}
      </Button>
      <Text ellipsis type="secondary">
        {directory
          ? `${directory.deviceName || directory.deviceId} · ${directory.path}`
          : t('directories.unavailable')}
      </Text>
    </Flexbox>
  );
}
