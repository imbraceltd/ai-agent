import { env } from '@/env';

const workflowDomainFromHelper = (organizationPartition: number, organizationId: string) => {
    const appN8nDomain = env.VITE_APP_N8N_DOMAIN;
    return env.VITE_IS_MULTI_TENANCY
        ? `${appN8nDomain?.replace('{{org}}', organizationPartition === 0 ? 'org-default' : organizationId.replace('org_', 'org-'))}`
        : appN8nDomain;
};

export { workflowDomainFromHelper };
