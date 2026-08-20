import { fetchMethod } from '../axios';

export const getJourneyLibraries = {
    api: '/v2/backend/marketplaces/products',
    method: fetchMethod.GET,
};

export const getProductById = {
    api: (productId: string) => `/v2/backend/marketplaces/products/${productId}`,
    method: fetchMethod.GET,
};

export const installProduct = {
    api: (productId: string) => `/v2/backend/marketplaces/installations/${productId}`,
    method: fetchMethod.POST,
};

export const postMarketPlaceFile = {
    api: () => '/v2/backend/marketplaces/files',
    method: fetchMethod.POST,
};
export const deleteMarketPlaceFile = {
    api: (fileId: string) => `/v2/backend/marketplaces/files/${fileId}`,
    method: fetchMethod.DELETE,
};
export const getMarketPlaceFile = {
    api: (fileId: string) => `/v2/backend/marketplaces/file-details/${fileId}`,
    method: fetchMethod.GET,
};

export const downloadMarketPlaceFile = {
    api: (shortPath: string) => `/v2/backend/marketplaces/download/${shortPath}`,
    method: fetchMethod.GET,
};

export const getAiAssistantById = {
    api: (assistantId: string) => `/v3/ai/assistants/${assistantId}`,
    method: fetchMethod.GET,
};

export const getCheckAiAssistantName = {
    api: () => '/v3/ai/assistants/check-name',
    method: fetchMethod.GET,
};

export const postAiAssistant = {
    api: () => '/v3/ai/assistant_apps',
    method: fetchMethod.POST,
};

export const putAiAssistant = {
    api: (assistantId: string) => `/v3/ai/assistant_apps/${assistantId}`,
    method: fetchMethod.PUT,
};

export const putAiAssistantWorkflow = {
    api: (assistantId: string) => `/v3/ai/assistant_apps/${assistantId}/workflow`,
    method: fetchMethod.PUT,
};

export const getAiFile = {
    api: (fileId: string) => `/v2/ai/rag/files/${fileId}`,
    method: fetchMethod.GET,
};

export const postAiFile = {
    api: () => '/v2/ai/rag/files',
    method: fetchMethod.POST,
};

export const deleteAiFile = {
    api: (fileId: string) => `/v2/ai/rag/files/${fileId}`,
    method: fetchMethod.DELETE,
};

export const postChannelWorkflows = {
    api: () => '/v2/backend/marketplaces/channel-workflows',
    method: fetchMethod.POST,
};
