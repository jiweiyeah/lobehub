import { shallow } from 'zustand/shallow';
import { createWithEqualityFn } from 'zustand/traditional';

import { mutate, useClientDataSWR } from '@/libs/swr';
import { getCacheScope, useCacheScope } from '@/libs/swr/useCacheScope';
import type { BindProjectDirectoryInput } from '@/services/projectWorkingDirectory';
import { projectWorkingDirectoryService } from '@/services/projectWorkingDirectory';

export type ProjectDirectory = Awaited<
  ReturnType<typeof projectWorkingDirectoryService.list>
>['data'][number];
const directoryKey = (scope: string, projectId?: string) =>
  ['project/directories', scope, projectId ?? 'all'] as const;
const topicsKey = (scope: string, id: string) => ['project/directoryTopics', scope, id] as const;

const environmentKey = (scope: string, projectId?: string) =>
  ['project/environments', scope, projectId ?? 'all'] as const;
const createActions = () => ({
  useFetchEnvironments: (projectId?: string) => {
    const scope = useCacheScope();
    return useClientDataSWR(environmentKey(scope, projectId), () =>
      projectWorkingDirectoryService.listEnvironments(projectId),
    );
  },
  saveEnvironment: async (
    input: Parameters<typeof projectWorkingDirectoryService.saveEnvironment>[0],
  ) => {
    const result = await projectWorkingDirectoryService.saveEnvironment(input);
    await mutate(
      (key) =>
        Array.isArray(key) &&
        ['project/environments', 'project/directories'].includes(key[0]) &&
        key[1] === getCacheScope(),
    );
    return result.data;
  },
  attachEnvironment: async (projectId: string, environmentId: string) => {
    await projectWorkingDirectoryService.attachEnvironment(projectId, environmentId);
    await mutate(environmentKey(getCacheScope(), projectId));
  },
  bind: async (input: BindProjectDirectoryInput) => {
    const result = await projectWorkingDirectoryService.bind(input);
    await Promise.all([
      mutate(directoryKey(getCacheScope())),
      mutate(directoryKey(getCacheScope(), input.projectId)),
      mutate(environmentKey(getCacheScope())),
      mutate(environmentKey(getCacheScope(), input.projectId)),
    ]);
    return result.data;
  },
  startTopic: async (id: string, agentId: string, title: string) => {
    const result = await projectWorkingDirectoryService.startTopic({ agentId, id, title });
    await mutate(topicsKey(getCacheScope(), id));
    return result.data;
  },
  useFetchDirectories: (projectId?: string, enabled = true) => {
    const scope = useCacheScope();
    return useClientDataSWR(enabled ? directoryKey(scope, projectId) : null, () =>
      projectWorkingDirectoryService.list(projectId),
    );
  },
  useFetchDirectoryTopics: (id?: string) => {
    const scope = useCacheScope();
    return useClientDataSWR(id ? topicsKey(scope, id) : null, () =>
      projectWorkingDirectoryService.listTopics(id!),
    );
  },
});
export const useProjectDirectoryStore = createWithEqualityFn<ReturnType<typeof createActions>>()(
  createActions,
  shallow,
);
