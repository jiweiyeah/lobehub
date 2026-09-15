import { Flexbox, Input } from '@lobehub/ui';
import {
  Button,
  Checkbox,
  createModal,
  ModalFooter,
  Select,
  Text,
  useModalContext,
} from '@lobehub/ui/base-ui';
import { t } from 'i18next';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import AsyncError from '@/components/AsyncError';
import { deviceService } from '@/services/device';
import { useChatStore } from '@/store/chat';
import { useDeviceStore } from '@/store/device';
import { useProjectStore } from '@/store/project';
import { useProjectDirectoryStore } from '@/store/projectWorkingDirectory';

import { openCreateProjectModal } from '../CreateProjectModal';

export interface BindDirectoryOptions {
  agentId?: string;
  deviceId?: string;
  path?: string;
  projectId?: string;
  repositoryUrl?: string;
  topicIds?: string[];
}

function BindDirectoryContent(options: BindDirectoryOptions) {
  const { t } = useTranslation('project');
  const { close } = useModalContext();
  const [environmentId, setEnvironmentId] = useState('');
  const [projectId, setProjectId] = useState(options.projectId ?? '');
  const [deviceId, setDeviceId] = useState(options.deviceId ?? '');
  const [path, setPath] = useState(options.path ?? '');
  const [name, setName] = useState(options.path?.split(/[\\/]/).findLast(Boolean) ?? '');
  const [repositoryUrl, setRepositoryUrl] = useState(options.repositoryUrl ?? '');
  const [includeTopics, setIncludeTopics] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>();
  const [failedAction, setFailedAction] = useState<'detect' | 'save'>('save');
  const projects = useProjectStore((s) => s.useFetchProjectList)();
  const deviceRequest = useDeviceStore((s) => s.useFetchDevices)(true);
  const devices = useDeviceStore((s) => s.devices);
  const bind = useProjectDirectoryStore((s) => s.bind);
  const environmentRequest = useProjectDirectoryStore((s) => s.useFetchDirectories)();
  const environmentOptions = Array.from(
    new Map(
      (environmentRequest.data?.data ?? [])
        .filter((d) => d.environmentId)
        .map((d) => [
          d.environmentId!,
          { label: d.environmentName ?? d.name, value: d.environmentId! },
        ]),
    ).values(),
  );
  const detectRepository = async () => {
    setFailedAction('detect');
    setPending(true);
    setError(undefined);
    try {
      const result = await deviceService.statPath(deviceId, path);
      if (!result?.exists || !result.isDirectory) throw new Error(t('directories.unavailable'));
      setRepositoryUrl(result.repositoryUrl ?? '');
    } catch (error) {
      console.error('Failed to inspect repository', error);
      setError(error);
    } finally {
      setPending(false);
    }
  };
  const save = async () => {
    setFailedAction('save');
    setPending(true);
    setError(undefined);
    try {
      await bind({
        agentId: options.agentId,
        environmentId: environmentId || undefined,
        deviceId,
        name,
        path,
        projectId,
        repositoryUrl: repositoryUrl.trim() || undefined,
        topicIds: includeTopics ? options.topicIds : undefined,
      });
      await useChatStore.getState().refreshTopic();
      close();
    } catch (error) {
      console.error('Failed to bind project directory', error);
      setError(error);
    } finally {
      setPending(false);
    }
  };
  return (
    <>
      <Flexbox
        gap={12}
        padding={16}
        style={{ maxHeight: 'calc(100dvh - 200px)', overflowY: 'auto' }}
      >
        <Text type="secondary">{t('directories.bindDescription')}</Text>
        {projects.error ? (
          <AsyncError error={projects.error} onRetry={projects.mutate} />
        ) : (
          <Select
            aria-label={t('directories.project')}
            disabled={pending || !!options.projectId}
            placeholder={t('directories.project')}
            value={projectId}
            options={(projects.data?.data ?? []).map((project) => ({
              label: project.name,
              value: project.id,
            }))}
            onChange={(value) => setProjectId(value ?? '')}
          />
        )}
        {!options.projectId && (
          <Button
            disabled={pending}
            onClick={() =>
              openCreateProjectModal({ onCreated: (project) => setProjectId(project.id) })
            }
          >
            {t('directories.createProject')}
          </Button>
        )}
        {deviceRequest?.error && (
          <AsyncError error={deviceRequest.error} onRetry={deviceRequest.mutate} />
        )}
        <Select
          aria-label={t('directories.device')}
          disabled={pending}
          placeholder={t('directories.device')}
          value={deviceId}
          options={devices.map((device) => ({
            label: device.friendlyName || device.hostname || device.deviceId,
            value: device.deviceId,
          }))}
          onChange={(value) => setDeviceId(value ?? '')}
        />
        <Input
          aria-label={t('directories.path')}
          disabled={pending}
          placeholder={t('directories.path')}
          value={path}
          onChange={(e) => setPath(e.target.value)}
        />
        <Input
          aria-label={t('directories.name')}
          disabled={pending}
          placeholder={t('directories.name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        {!!environmentOptions.length && (
          <Select
            aria-label={t('directories.environment')}
            disabled={pending}
            options={[{ label: t('directories.newEnvironment'), value: '' }, ...environmentOptions]}
            placeholder={t('directories.newEnvironment')}
            value={environmentId}
            onChange={(value) => setEnvironmentId(value ?? '')}
          />
        )}
        <Input
          aria-label={t('directories.repository')}
          disabled={pending}
          placeholder={t('directories.repository')}
          value={repositoryUrl}
          onChange={(e) => setRepositoryUrl(e.target.value)}
        />
        <Button disabled={!deviceId || !path || pending} onClick={detectRepository}>
          {t('directories.detectRepository')}
        </Button>
        <Text type="secondary">{t('directories.repositoryHint')}</Text>
        {!!options.topicIds?.length && (
          <Checkbox
            checked={includeTopics}
            disabled={pending}
            onChange={(checked) => setIncludeTopics(checked === true)}
          >
            {t('directories.fileTopics', { count: options.topicIds.length })}
          </Checkbox>
        )}
        {error ? (
          <AsyncError
            description={error instanceof Error ? error.message : undefined}
            error={error}
            onRetry={failedAction === 'detect' ? detectRepository : save}
          />
        ) : null}
      </Flexbox>
      <ModalFooter>
        <Button disabled={pending} onClick={close}>
          {t('cancel', { ns: 'common' })}
        </Button>
        <Button
          disabled={!projectId || !deviceId || !path.trim() || !name.trim()}
          loading={pending}
          type="primary"
          onClick={save}
        >
          {t('directories.bind')}
        </Button>
      </ModalFooter>
    </>
  );
}
export const openBindDirectoryModal = (options: BindDirectoryOptions = {}) =>
  createModal({
    title: t('directories.bind', { ns: 'project' }),
    content: <BindDirectoryContent {...options} />,
    footer: null,
    width: 520,
  });
