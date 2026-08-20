import { fetchMethod } from '../axios';

export const activeLicense = {
    api: '/v1/backend/license/active',
    method: fetchMethod.POST,
};