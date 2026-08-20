import { fetchMethod } from '../axios/index';

export const getMemberList = {
    api: (skip = 0, limit = 10, search = '', roles = '', sort = '', status = '') =>
        `/v1/backend/users?skip=${skip}&limit=${limit}&search=${search}&roles=${roles}&sort=${sort}&status=${status}`,
    method: fetchMethod.GET,
};

export const getMemberListOptions = {
    api: () => '/v1/backend/users?status=active&limit=0&sort=-created_at',
    method: fetchMethod.GET,
};

export const getMemberRolesCount = {
    api: '/v1/backend/users/_roles_count',
    method: fetchMethod.GET,
};

export const getMemberById = {
    api: '/v1/backend/users/{{user_id}}',
    method: fetchMethod.GET,
};

export const putMemberById = {
    api: '/v1/backend/users/{{user_id}}',
    method: fetchMethod.PUT,
};

export const postMemberRoleById = {
    api: '/v1/backend/users/_change_role',
    method: fetchMethod.POST,
};

export const postMemberArchiveById = {
    api: '/v1/backend/users/_archive',
    method: fetchMethod.POST,
};

export const postMemberReactivateById = {
    api: '/v1/backend/users/_reactivate',
    method: fetchMethod.POST,
};

export const postMemberSuspendById = {
    api: '/v1/backend/users/_suspend',
    method: fetchMethod.POST,
};

export const postMemberAvatar = {
    api: '/v1/backend/users/_fileupload',
    method: fetchMethod.POST,
};

export const inviteMembers = {
    api: '/v1/backend/users/_bulk_invite',
    method: fetchMethod.POST,
};

export const getWorkflowsByMemberId = {
    api: (userId: string) => `/v1/backend/users/${userId}/workflows`,
    method: fetchMethod.GET,
};
