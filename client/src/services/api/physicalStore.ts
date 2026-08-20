import { fetchMethod } from '../axios/index';

export const getStores = {
    api: (businessId: string, skip = 0, limit = 10) => `/v1/backend/stores?type=business_unit_id&q=${businessId}&skip=${skip}&limit=${limit}`,
    method: fetchMethod.GET,
};

export const createStore = {
    api: '/v1/backend/stores/_create_with_fp',
    method: fetchMethod.POST,
};

export const modifyStore = {
    api: '/v1/backend/stores/_modify_with_fp',
    method: fetchMethod.POST,
};

export const deleteStore = {
    api: (storeId: string) => `/v1/backend/stores/${storeId}`,
    method: fetchMethod.DELETE,
};
