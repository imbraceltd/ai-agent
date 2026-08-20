import { fetchMethod } from '@/services/axios';

export const boardAutomation = {
    api: (boardId: string) => `/api/v1/crmboard/${boardId}`,
    method: fetchMethod.GET,
};

export const postBoardAutomation = {
    api: '/api/v1/crmboard',
    method: fetchMethod.POST,
};

export const updateBoardAutomation = {
    api: (id: string) => `/api/v1/crmboard/board/${id}`,
    method: fetchMethod.PUT,
};

export const deleteBoardAutomation = {
    api: (id: string) => `/api/v1/crmboard/board/${id}`,
    method: fetchMethod.DELETE,
};

export const fetchAutomationWorkflows = {
    api: '/api/v1/workflowlist',
    method: fetchMethod.GET,
};

export const checkFieldId = {
    api: (fieldId: string) => `/api/v1/crmboard/field/${fieldId}`,
    method: fetchMethod.GET,
};

export const pausedBoardAutomationWidthFieldId = {
    api: (fieldId: string) => `/api/v1/crmboard/field/${fieldId}`,
    method: fetchMethod.PUT,
};

export const pausedBoardAutomationWithWorkflowId = {
    api: (workflowId: string) => `/api/v1/crmboard/workflow/${workflowId}`,
    method: fetchMethod.PUT,
};

export const deleteBoardAutomationWithBoardId = {
    api: (boardId: string) => `/api/v1/crmboard/${boardId}`,
    method: fetchMethod.DELETE,
};
