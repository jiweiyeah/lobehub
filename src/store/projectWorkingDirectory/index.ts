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

const createActions = () => ({
  bind: async (input: BindProjectDirectoryInput) => {
    const result = await projectWorkingDirectoryService.bind(input);
    await Promise.all([
      mutate(directoryKey(getCacheScope())),
      mutate(directoryKey(getCacheScope(), input.projectId)),
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
