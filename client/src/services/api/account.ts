import { fetchMethod } from '../axios';

export const getAccount = {
    api: '/v1/backend/account',
    method: fetchMethod.GET,
};

export const putAccount = {
    api: '/v1/backend/account',
    method: fetchMethod.PUT,
};

export const postAccountAvatar = {
    api: '/v1/backend/account/_fileupload',
    method: fetchMethod.POST,
};
