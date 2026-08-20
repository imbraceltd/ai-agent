import { fetchMethod } from '../axios/index';

export const putUser = {
    api: '/v1/backend/users/{{user_id}}',
    method: fetchMethod.PUT,
};

export const getUserById = {
    api: '/v1/backend/users/{{user_id}}',
    method: fetchMethod.GET,
};

export const changeUserRole = {
    api: '/v1/backend/users/_change_role',
    method: fetchMethod.POST,
};

export const deactivateUser = {
    api: '/v1/backend/users/_deactivate',
    method: fetchMethod.POST,
};

export const reactivateUser = {
    api: '/v1/backend/users/_reactivate',
    method: fetchMethod.POST,
};

export const getMembers = {
    api: '/v1/backend/users/_all',
    method: fetchMethod.GET,
};
