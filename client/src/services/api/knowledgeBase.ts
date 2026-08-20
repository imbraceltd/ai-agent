import { fetchMethod } from '@/services/axios';

export const getKnowledgeBase = {
    api: () => '/v1/backend/knowledge',
    method: fetchMethod.GET,
};
export const postKnowledgeBaseFile = {
    api: () => '/v1/backend/knowledge/upload',
    method: fetchMethod.POST,
};
