import { Flexbox } from '@lobehub/ui';
import { Button, Select, Text } from '@lobehub/ui/base-ui';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import AsyncError from '@/components/AsyncError';
import { useProjectDirectoryStore } from '@/store/projectWorkingDirectory';

import { openBindDirectoryModal } from './BindDirectoryModal';
import { openEnvironmentModal } from './EnvironmentModal';

export function ProjectWorkingDirectories({ projectId }: { projectId: string }) {
  const { t } = useTranslation('project');
  const linked = useProjectDirectoryStore((s) => s.useFetchEnvironments)(projectId);
  const available = useProjectDirectoryStore((s) => s.useFetchEnvironments)();
  const directories = useProjectDirectoryStore((s) => s.useFetchDirectories)(projectId);
  const attach = useProjectDirectoryStore((s) => s.attachEnvironment);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<unknown>();
  const [failedEnvironmentId, setFailedEnvironmentId] = useState<string>();
  const link = async (id: string) => {
    setFailedEnvironmentId(id);
    setPending(true);
    setError(undefined);
    try {
      await attach(projectId, id);
      setFailedEnvironmentId(undefined);
    } catch (error) {
      console.error('Failed to associate environment', error);
      setError(error);
    } finally {
      setPending(false);
    }
  };
  return (
    <Flexbox gap={24} paddingBlock={24}>
      <Text fontSize={24} weight={600}>
        {t('settings.title')}
      </Text>
      <Flexbox gap={16}>
        <Flexbox horizontal align="center" gap={12} justify="space-between">
          <Text fontSize={18} style={{ whiteSpace: 'nowrap' }} weight={600}>
            {t('settings.environments')}
          </Text>
          <Flexbox flex="none" width={240}>
            <Select
              aria-label={t('settings.addEnvironment')}
              disabled={pending}
              placeholder={t('settings.addEnvironment')}
              value=""
              options={[
                ...(available.data?.data ?? [])
                  .filter((env) => !linked.data?.data.some((e) => e.id === env.id))
                  .map((env) => ({ label: env.name, value: env.id })),
                { label: t('directories.newEnvironment'), value: '__create__' },
              ]}
              onChange={(id) =>
                id === '__create__'
                  ? openEnvironmentModal({ onSaved: (env) => link(env.id) })
                  : id && void link(id)
              }
            />
          </Flexbox>
        </Flexbox>
        <Text type="secondary">{t('settings.environmentDescription')}</Text>
        {error || linked.error || available.error || directories.error ? (
          <AsyncError
            error={error || linked.error || available.error || directories.error}
            onRetry={() =>
              failedEnvironmentId
                ? link(failedEnvironmentId)
                : Promise.all([linked.mutate(), available.mutate(), directories.mutate()])
            }
          />
        ) : null}
        {linked.isLoading ? (
          <Text>{t('loading', { ns: 'common' })}</Text>
        ) : !linked.data?.data.length ? (
          <Text type="secondary">{t('settings.noEnvironments')}</Text>
        ) : (
          linked.data.data.map((env) => (
            <Flexbox gap={8} key={env.id} paddingBlock={12}>
              <Flexbox horizontal align="center" justify="space-between">
                <Text weight={600}>{env.name}</Text>
                <Button
                  onClick={() =>
                    openEnvironmentModal({
                      id: env.id,
                      name: env.name,
                      repositoryUrl: env.configuration.sources?.find((s) => s.kind === 'git')?.url,
                      onSaved: () => {},
                    })
                  }
                >
                  {t('directories.editEnvironment')}
                </Button>
              </Flexbox>
              {env.configuration.sources?.map((source) =>
                source.kind === 'git' ? (
                  <a href={source.url} key={source.url} rel="noreferrer" target="_blank">
                    {source.url}
                  </a>
                ) : null,
              )}
              {(directories.data?.data ?? [])
                .filter((d) => d.environmentId === env.id)
                .map((d) => (
                  <Text key={d.id} type="secondary">
                    {d.deviceName || d.deviceId} · {d.path}
                  </Text>
                ))}
            </Flexbox>
          ))
        )}
        {(directories.data?.data ?? [])
          .filter((d) => !d.instanceId)
          .map((d) => (
            <Flexbox horizontal justify="space-between" key={d.id}>
              <Text>
                {d.name} · {d.path}
              </Text>
              <Button
                onClick={() =>
                  openBindDirectoryModal({ projectId, deviceId: d.deviceId, path: d.path })
                }
              >
                {t('directories.bind')}
              </Button>
            </Flexbox>
          ))}
      </Flexbox>
    </Flexbox>
  );
}
