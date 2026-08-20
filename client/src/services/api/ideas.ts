import { fetchMethod } from '../axios/index';
export const getIdeasList = {
    api: () => '/v2/backend/ideas/products',
    method: fetchMethod.GET,
};

export const getIdeaById = {
    api: (id: string) => `/v2/backend/ideas/products/${id}`,
    method: fetchMethod.GET,
};

export const postInstallIdea = {
    api: (id: string) => `/v2/backend/ideas/products/installations/${id}`,
    method: fetchMethod.POST,
};
