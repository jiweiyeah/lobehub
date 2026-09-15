import { lambdaClient } from '@/libs/trpc/client';

type Client = typeof lambdaClient.projectWorkingDirectory;
export type BindProjectDirectoryInput = Parameters<Client['bind']['mutate']>[0];

class ProjectWorkingDirectoryService {
  bind = (input: BindProjectDirectoryInput) =>
    lambdaClient.projectWorkingDirectory.bind.mutate(input);
  list = (projectId?: string) => lambdaClient.projectWorkingDirectory.list.query({ projectId });
  listTopics = (id: string) => lambdaClient.projectWorkingDirectory.listTopics.query({ id });
  resolve = (id: string) => lambdaClient.projectWorkingDirectory.resolve.query({ id });
  startTopic = (input: Parameters<Client['startTopic']['mutate']>[0]) =>
    lambdaClient.projectWorkingDirectory.startTopic.mutate(input);
}
export const projectWorkingDirectoryService = new ProjectWorkingDirectoryService();
