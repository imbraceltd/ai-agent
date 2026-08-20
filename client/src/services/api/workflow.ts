import { fetchMethod } from '../axios/index';

export const n8nLogin = {
    api: () => '/v1/backend/_n8nlogin',
    method: fetchMethod.GET,
};

export const getN8nWorkflowById = {
    api: (workflowId: number) => `/v1/backend/n8n/workflows/${workflowId}`,
    method: fetchMethod.GET,
};

export const patchN8nWorkflowById = {
    api: (workflowId: number) => `/v1/backend/n8n/workflows/${workflowId}`,
    method: fetchMethod.PATCH,
};

export const putChannelWorkflowById = {
    api: (workflowId: string) => `/v1/backend/channels/workflows/${workflowId}`,
    method: fetchMethod.PUT,
};

export const deleteN8nWorkflowById = {
    api: (workflowId: string) => `/v1/backend/n8n/workflows/${workflowId}`,
    method: fetchMethod.DELETE,
};

export const deleteChannelWorkflowById = {
    api: (workflowId: string) => `/v1/backend/channels/workflows/${workflowId}`,
    method: fetchMethod.DELETE,
};

export const getN8nNewWorkflow = {
    api: () => '/v1/backend/n8n/workflows/new',
    method: fetchMethod.GET,
};

export const getAllNodes = {
    api: () => 'v1/backend/n8n/node-types?onlyLatest=false',
    method: fetchMethod.GET,
};

export const getAllWorkflows = {
    api: (params?: { tag?: string; search?: string, haveAISettings?: boolean }) => {
        const searchParams = new URLSearchParams();
        if (params?.tag) {
            searchParams.append('tag', params.tag);
        }
        if (params?.search) {
            searchParams.append('search', params.search);
        }
        if (params?.haveAISettings) {
            searchParams.append('haveAISettings', params.haveAISettings.toString());
        }
        return `v1/backend/workflows?${searchParams.toString()}`;
    },
    method: fetchMethod.GET,
};


export const getAllIPSWorkflow = {
    api: ({sort, haveAISettings, ids}: {sort?: string, haveAISettings?: boolean, ids?: string[]}) => `v1/ips/workflows/all${sort ? `?sort=${sort}` : ''}${haveAISettings ? `&haveAISettings=${haveAISettings}` : ''}${ids ? `&ids=${ids}` : ''}`,
    method: fetchMethod.GET,
};

export const getWorkflowsAutomation = {
    api: (channelsType: string) => `/v1/backend/workflows/channel_automation?channelType=${channelsType}`,
    method: fetchMethod.GET,
};

export const getCredentials = {
    api: () => '/v1/backend/credentials',
    method: fetchMethod.GET,
};

export const getCredentialParams = {
    api: (credentialName: string) => `/v1/backend/workflow/_credentialParam?type=${credentialName}`,
    method: fetchMethod.GET,
};

export const getCredentialTypes = {
    api: (type?: string) => `v1/backend/workflow/credential-types?${type ? `type=${type}` : ''}`,
    method: fetchMethod.GET,
};
export const getCredentialTypeByName = {
    api: (name: string) => `/v1/backend/workflow/credential-types/${name}`,
    method: fetchMethod.GET,
};

export const getProcessedCredentialTypes = {
    api: () => '/v1/backend/workflow/processed-credential-types',
    method: fetchMethod.GET,
};

export const getN8NCredentialTypes = {
    api: () => 'v1/backend/n8n/credential-types',
    method: fetchMethod.GET,
};

export const getCredential = {
    api: (credentialId: string) => `/v1/backend/n8n/credentials/${credentialId}?includeData=true`,
    method: fetchMethod.GET,
};

export const getChannelCredential = {
    api: (credentialId: string) => `/v1/backend/channels/credentials/${credentialId}`,
    method: fetchMethod.GET,
};

export const updateCredential = {
    api: (credentialId: string) => `/v1/backend/n8n/credentials/${credentialId}`,
    method: fetchMethod.PATCH,
};

export const updateChannelCredential = {
    api: (credentialId: string) => `/v1/backend/channels/credentials/${credentialId}`,
    method: fetchMethod.PUT,
};

export const createCredential = {
    api: () => '/v1/backend/n8n/credentials',
    method: fetchMethod.POST,
};

export const deleteN8nCredential = {
    api: (credentialId: string) => `/v1/backend/n8n/credentials/${credentialId}`,
    method: fetchMethod.DELETE,
};

export const deleteCredential = {
    api: (credential_id: string) => `/v1/backend/channels/credentials/${credential_id}`,
    method: fetchMethod.DELETE,
};

export const saveWorkflow = {
    api: () => '/v1/backend/n8n/workflows',
    method: fetchMethod.POST,
};

export const oAuth2Authorize = {
    api: (param: string) => `/v1/backend/n8n/oauth2-credential/auth?${param}`,
    method: fetchMethod.GET,
};

export const oAuth1Authorize = {
    api: (param: string) => `/v1/backend/n8n/oauth1-credential/auth?${param}`,
    method: fetchMethod.GET,
};

export const getWorkflowDetail = {
    api: (workflowId: string) => `/v1/backend/n8n/workflows/${workflowId}`,
    method: fetchMethod.GET,
};

export const saveWorkflowDetail = {
    api: (workflowId: string) => `/v1/backend/n8n/workflows/${workflowId}`,
    method: fetchMethod.PATCH,
};
