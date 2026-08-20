import { fetchMethod } from '../axios';

export const getFile = {
    api: (fileId: string) => `/api/files/${fileId}`,
    method: fetchMethod.GET,
};

export const postFile = {
    api: '/api/files',
    method: fetchMethod.POST,
};

export const deleteFile = {
    api: (fileId: string) => `/api/files/${fileId}`,
    method: fetchMethod.DELETE,
};

export const getTemplates = {
    api: '/v2/backend/templates',
    method: fetchMethod.GET,
};

export const deleteUseCaseById = {
    api: (useCaseId: string) => `v2/backend/templates/${useCaseId}`,
    method: fetchMethod.DELETE,
};

export const createCustomUseCase = {
    api: '/v2/backend/templates/custom',
    method: fetchMethod.POST,
};

export const updateCustomUseCaseById = {
    api: (useCaseId: string) => `/v2/backend/templates/${useCaseId}/custom`,
    method: fetchMethod.PATCH,
};

export const updateUseCaseById = {
    api: (useCaseId: string) => `/v2/backend/templates/${useCaseId}`,
    method: fetchMethod.PATCH,
};
