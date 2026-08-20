import { fetchMethod } from '../axios/index';

export const getTeams = {
    api: () => '/v1/backend/teams?type=business_unit_id',
    method: fetchMethod.GET,
};
export const postTeam = {
    api: '/v1/backend/teams',
    method: fetchMethod.POST,
};
export const putTeam = {
    api: (teamId: string) => `/v1/backend/teams/${teamId}`,
    method: fetchMethod.PUT,
};
export const postTeamIcon = {
    api: '/v1/backend/teams/_fileupload',
    method: fetchMethod.POST,
};
export const getTeamInviteUserList = {
    api: '/v1/backend/team_users/_invite_list?type=team_id&team_id={{teamId}}',
    method: fetchMethod.GET,
};
export const joinTeam = {
    api: '/v1/backend/teams/_join_team',
    method: fetchMethod.POST,
};
export const leaveTeam = {
    api: '/v1/backend/teams/_leave',
    method: fetchMethod.POST,
};
export const getTeamUsers = {
    api: (teamId: string, skip = 0, limit = 10, search = '') =>
        `/v1/backend/team_users?type=team_id&q=${teamId}&skip=${skip}&limit=${limit}&search=${search}`,
    method: fetchMethod.GET,
};
export const getTeamMembers = {
    api: () => '/v1/backend/team_users?type=team_id',
    method: fetchMethod.GET,
};
export const postTeamUsers = {
    api: '/v1/backend/teams/_add_users',
    method: fetchMethod.POST,
};
export const deleteTeamUsers = {
    api: '/v1/backend/teams/_remove_users',
    method: fetchMethod.POST,
};
export const getWorkflowsByTeamId = {
    api: (teamId: string) => `/v1/backend/teams/${teamId}/workflows`,
    method: fetchMethod.GET,
};
export const getMyTeams = {
    api: '/v2/backend/teams/my',
    method: fetchMethod.GET,
};
export const deleteTeam = {
    api: (teamId: string) => `/v2/backend/teams/${teamId}`,
    method: fetchMethod.DELETE,
};
export const getTeamInviteUserListV2 = {
    api: '/v2/backend/team_users/_invite_list?type=team_id&team_id={{teamId}}',
    method: fetchMethod.GET,
};
export const putTeamV2 = {
    api: (teamId: string) => `/v2/backend/teams/${teamId}`,
    method: fetchMethod.PUT,
};
export const joinTeamV2 = {
    api: '/v2/backend/teams/_join_team',
    method: fetchMethod.POST,
};
export const requestJoinTeam = {
    api: (teamId: string) => `/v2/backend/teams/${teamId}/join_request`,
    method: fetchMethod.POST,
};
export const postTeamUsersV2 = {
    api: '/v2/backend/teams/_add_users',
    method: fetchMethod.POST,
};
export const approveJoinRequest = {
    api: (teamId: string, teamUserId: string) => `/v2/backend/teams/${teamId}/user/${teamUserId}/approve`,
    method: fetchMethod.POST,
};
export const acceptJoinInvitation = {
    api: (teamId: string, teamUserId: string) => `/v2/backend/teams/${teamId}/user/${teamUserId}/accept`,
    method: fetchMethod.POST,
};
export const getTeamsV2 = {
    api: () => '/v2/backend/teams?type=business_unit_id',
    method: fetchMethod.GET,
};
export const leaveTeamV2 = {
    api: '/v2/backend/teams/_leave',
    method: fetchMethod.POST,
};
export const deleteTeamUsersV2 = {
    api: '/v2/backend/teams/_remove_users',
    method: fetchMethod.POST,
};
export const updateUserRole = {
    api: (teamId: string, teamUserId: string) => `/v2/backend/teams/${teamId}/user/${teamUserId}/role`,
    method: fetchMethod.PUT,
};
export const getAllTeamUsers = {
    api: (teamId: string) => `/v1/backend/team/${teamId}/users`,
    method: fetchMethod.GET,
};
export const getTeamMembersV2 = {
    api: () => '/v2/backend/team_users?type=team_id',
    method: fetchMethod.GET,
};
