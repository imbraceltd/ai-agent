import { fetchMethod } from '../axios';

export const getMenuSetting = {
    api: '/v1/backend/app/_menu_settings',
    method: fetchMethod.GET,
};

export const getOrgJourneys = {
    api: '/v2/backend/apps',
    method: fetchMethod.GET,
};

export const putApp = {
    api: (appId: string) => `/v2/backend/apps/${appId}`,
    method: fetchMethod.PUT,
};

export const getAppById = {
    api: (appId: string) => `/v2/backend/apps/${appId}`,
    method: fetchMethod.GET,
};

export const deleteApp = {
    api: (appId: string) => `/v2/backend/apps/${appId}`,
    method: fetchMethod.DELETE,
};

export const getEmailSenders = {
    api: '/v2/backend/apps/email-senders',
    method: fetchMethod.GET,
};
export const postEmailSender = {
    api: '/v2/backend/apps/email-senders',
    method: fetchMethod.POST,
};
export const putEmailSender = {
    api: (senderId: string) => `/v2/backend/apps/email-senders/${senderId}`,
    method: fetchMethod.PUT,
};
export const deleteEmailSender = {
    api: (senderId: string) => `/v2/backend/apps/email-senders/${senderId}`,
    method: fetchMethod.DELETE,
};

export const getEmailTemplates = {
    api: () => '/v2/backend/marketplaces/email-templates/search',
    method: fetchMethod.GET,
};

export const postEmailTemplate = {
    api: () => '/v2/backend/marketplaces/email-templates',
    method: fetchMethod.POST,
};
export const putEmailTemplate = {
    api: (templateId: string) => `/v2/backend/marketplaces/email-templates/${templateId}`,
    method: fetchMethod.PUT,
};

export const deleteEmailTemplate = {
    api: (templateId: string) => `/v2/backend/marketplaces/email-templates/${templateId}`,
    method: fetchMethod.DELETE,
};

export const getEmailTemplateCategories = {
    api: (appId: string) => `/v2/backend/marketplaces/categories?apply_to=email-template&app_id=${appId}`,
    method: fetchMethod.GET,
};
export const getEmailTemplateCategoriesV2 = {
    api: () => '/v2/backend/marketplaces/categories?apply_to=email-template',
    method: fetchMethod.GET,
};
export const postEmailTemplateCategory = {
    api: () => '/v2/backend/marketplaces/categories',
    method: fetchMethod.POST,
};

export const putEmailTemplateCategory = {
    api: (categoryId: string) => `/v2/backend/marketplaces/categories/${categoryId}`,
    method: fetchMethod.PUT,
};
export const deleteEmailTemplateCategory = {
    api: (categoryId: string) => `/v2/backend/marketplaces/categories/${categoryId}`,
    method: fetchMethod.DELETE,
};

export const patchActivateApp = {
    api: (appId: string) => `/v2/backend/apps/activate/${appId}`,
    method: fetchMethod.PATCH,
};

export const patchDeactivateApp = {
    api: (appId: string) => `/v2/backend/apps/de-activate/${appId}`,
    method: fetchMethod.PATCH,
};

export const getOrgMembersEmail = {
    api: () => 'v2/backend/apps/org-members-email',
    method: fetchMethod.GET,
};

export const deleteForm = {
    api: (id: string) => `/v2/backend/apps/forms/${id}`,
    method: fetchMethod.DELETE,
};

export const getForms = {
    api: () => '/v2/backend/apps/forms',
    method: fetchMethod.GET,
};

export const getFormById = {
    api: (id: string) => `/v2/backend/apps/forms/${id}`,
    method: fetchMethod.GET,
};



