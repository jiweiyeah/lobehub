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
import { useChatStore } from '@/store/chat';
import { useDeviceStore } from '@/store/device';
import { useProjectStore } from '@/store/project';
import { useProjectDirectoryStore } from '@/store/projectWorkingDirectory';

import { openCreateProjectModal } from '../CreateProjectModal';
import { openEnvironmentModal } from './EnvironmentModal';

export interface BindDirectoryOptions {
  agentId?: string;
  deviceId: string;
  environmentId?: string;
  path: string;
  projectId?: string;
  repositoryUrl?: string;
  topicIds?: string[];
}
const CREATE = '__create__';
function BindDirectoryContent(options: BindDirectoryOptions) {
  const { t } = useTranslation('project');
  const { close } = useModalContext();
  const [environmentId, setEnvironmentId] = useState(options.environmentId ?? '');
  const [projectId, setProjectId] = useState(options.projectId ?? '');
  const [name, setName] = useState(options.path.split(/[\\/]/).findLast(Boolean) ?? '');
  const [includeTopics, setIncludeTopics] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>();
  const projects = useProjectStore((s) => s.useFetchProjectList)();
  const devices = useDeviceStore((s) => s.devices);
  const deviceName =
    devices.find((d) => d.deviceId === options.deviceId)?.friendlyName ?? options.deviceId;
  const environments = useProjectDirectoryStore((s) => s.useFetchEnvironments)();
  const bind = useProjectDirectoryStore((s) => s.bind);
  const save = async () => {
    setPending(true);
    setError(undefined);
    try {
      await bind({
        agentId: options.agentId,
        environmentId,
        deviceId: options.deviceId,
        name,
        path: options.path,
        projectId,
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
        <Text>{deviceName}</Text>
        <Text style={{ overflowWrap: 'anywhere' }} type="secondary">
          {options.path}
        </Text>
        <Text>{t('directories.project')}</Text>
        {projects.error ? (
          <AsyncError error={projects.error} onRetry={projects.mutate} />
        ) : (
          <Select
            aria-label={t('directories.project')}
            disabled={pending || !!options.projectId}
            placeholder={t('directories.project')}
            value={projectId}
            options={[
              ...(projects.data?.data ?? []).map((project) => ({
                label: project.name,
                value: project.id,
              })),
              { label: t('directories.createProject'), value: CREATE },
            ]}
            onChange={(value) =>
              value === CREATE
                ? openCreateProjectModal({ onCreated: (project) => setProjectId(project.id) })
                : setProjectId(value ?? '')
            }
          />
        )}
        <Text>{t('directories.environment')}</Text>
        {environments.error ? (
          <AsyncError error={environments.error} onRetry={environments.mutate} />
        ) : (
          <Select
            aria-label={t('directories.environment')}
            disabled={pending}
            placeholder={t('directories.environment')}
            value={environmentId}
            options={[
              ...(environments.data?.data ?? []).map((env) => ({ label: env.name, value: env.id })),
              { label: t('directories.newEnvironment'), value: CREATE },
            ]}
            onChange={(value) =>
              value === CREATE
                ? openEnvironmentModal({
                    name,
                    repositoryUrl: options.repositoryUrl,
                    deviceId: options.deviceId,
                    path: options.path,
                    onSaved: (env) => setEnvironmentId(env.id),
                  })
                : setEnvironmentId(value ?? '')
            }
          />
        )}
        <Input
          aria-label={t('directories.name')}
          disabled={pending}
          placeholder={t('directories.name')}
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
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
            onRetry={save}
          />
        ) : null}
      </Flexbox>
      <ModalFooter>
        <Button disabled={pending} onClick={close}>
          {t('cancel', { ns: 'common' })}
        </Button>
        <Button
          disabled={!projectId || !environmentId || !name.trim()}
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
export const openBindDirectoryModal = (options: BindDirectoryOptions) =>
  createModal({
    title: t('directories.bind', { ns: 'project' }),
    content: <BindDirectoryContent {...options} />,
    footer: null,
    width: 520,
  });
