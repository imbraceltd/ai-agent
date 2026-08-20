import { fetchMethod } from "../axios";

export const getAIAssistant = {
    api: () => `/v3/ai/accounts/assistants`,
    method: fetchMethod.GET,
};

export const getAIAssistantById = {
    api: (id: string) => `/v3/ai/assistants/${id}`,
    method: fetchMethod.GET,
};

export const getAIAssistantLLMModels = {
    api: () => `/v2/ai/workflow-agent/models`,
    method: fetchMethod.GET,
};

export const getAIAssistantAgents = {
    api: () => '/v3/ai/assistants/agents',
    method: fetchMethod.GET,
};

export const patchAIAssistantInstructions = {
    api: (id: string ) => `/v3/ai/assistants/${id}/instructions`,
    method: fetchMethod.PATCH,
};

export const postAIAssistant = {
    api: () => `/v3/ai/assistant_apps`,
    method: fetchMethod.POST,
};

export const putAIAssistant = {
    api: (id: string) => `/v3/ai/assistant_apps/${id}`,
    method: fetchMethod.PUT,
};

export const deleteAiAssistant = {
    api: (id: string) => `/v3/ai/assistant_apps/${id}`,
    method: fetchMethod.DELETE,
};

export const updateAiAssistant = {
    api: (id: string) => `/v3/ai/assistant_apps/${id}`,
    method: fetchMethod.PUT,
};