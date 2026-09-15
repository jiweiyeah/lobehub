import { useState } from 'react';

import { useHomeStore } from '@/store/home';
import { homeAgentListSelectors } from '@/store/home/selectors';

export const useDirectoryAgent = (coordinatorAgentId: string) => {
  const [agentId, setAgentId] = useState(coordinatorAgentId);
  const agentName = useHomeStore((s) => homeAgentListSelectors.getAgentById(agentId)(s)?.title);

  return { agentId, agentName, setAgentId };
};
