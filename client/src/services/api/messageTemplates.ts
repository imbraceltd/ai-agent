import { fetchMethod } from '../axios/index';

export const getMessagesById = {
    api: (id: string) => `/v1/backend/message_templates/${id}`,
    method: fetchMethod.GET,
};

export const putMessagesById = {
    api: (id: string) => `/v1/backend/message_templates/${id}`,
    method: fetchMethod.PUT,
};

export const deleteMessagesById = {
    api: (id: string) => `/v1/backend/message_templates/${id}`,
    method: fetchMethod.DELETE,
};

export const postMessages = {
    api: '/v1/backend/message_templates',
    method: fetchMethod.POST,
};

export const getMessageTemplateLists = {
    api: ({ businessId, limit = 10, skip = 0 }: { businessId: string; limit: number; skip: number }) =>
        `/v1/backend/message_templates?type=business_unit_id&q=${businessId}&skip=${skip}&limit=${limit}`,
    method: fetchMethod.GET,
};

export const getMessageTemplates = {
    api: () => '/v1/backend/message_templates?type=business_unit_id',
    method: fetchMethod.GET,
};

export const getSearchMessageTemplates = {
    api: () => '/v1/backend/message_templates/_search?type=text',
    method: fetchMethod.GET,
};

export const getMessageTemplatesListV2 = {
    api: () => '/v2/backend/message_templates',
    method: fetchMethod.GET,
};

export const getSearchMessageTemplateLists = {
    api: ({
        businessId,
        field,
        search,
        limit = 10,
        skip = 0,
    }: {
        businessId: string;
        field?: string;
        search?: string;
        limit: number;
        skip: number;
    }) => `/v1/backend/message_templates/_search?business_unit_id=${businessId}&type=text&q=${search}&field=${field}&skip=${skip}&limit=${limit}`,
    method: fetchMethod.GET,
};

export const getTemplateCategories = {
    api: '/v1/backend/categories',
    method: fetchMethod.GET,
};

export const postTemplateCategory = {
    api: '/v1/backend/categories',
    method: fetchMethod.POST,
};

export const putTemplateCategory = {
    api: (id: string) => `/v1/backend/categories/${id}`,
    method: fetchMethod.PUT,
};

export const deleteTemplateCategory = {
    api: (id: string) => `/v1/backend/categories/${id}`,
    method: fetchMethod.DELETE,
};
