import { fetchMethod } from '../axios';

export const getBusinessUnit = {
    api: (limit: number, skip: number) => `/v1/backend/business_units?limit=${limit}&skip=${skip}`,
    method: fetchMethod.GET,
};
