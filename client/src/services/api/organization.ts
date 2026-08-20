import { fetchMethod } from '../axios/index';

export const getOrganization = {
    api: (limit: number, skip: number, is_active: boolean) => `/v2/backend/organizations?limit=${limit}&skip=${skip}&is_active=${is_active}`,
    method: fetchMethod.GET,
};

export const postOrganization = {
    api: '/v1/backend/organizations',
    method: fetchMethod.POST,
};

export const postOrganizationFullAccess = {
    api: '/v1/backend/organizations/aws',
    method: fetchMethod.POST,
};

export const getMenuSetting = {
    api: '/v1/backend/app/_menu_settings',
    method: fetchMethod.GET,
};

export const getAllOrganization = {
    api: ({is_active}: {is_active: boolean}) => `/v2/backend/organizations/_all?is_active=${is_active}`,
    method: fetchMethod.GET,
};
