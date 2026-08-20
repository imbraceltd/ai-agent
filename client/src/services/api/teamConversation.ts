import { fetchMethod } from '../axios';

export const getTeamConversationsByTextSearch = {
    api: (businessUnitId: string, search: string, skip = 0, limit = 50) =>
        `/v1/team_conversations/_search?business_unit_id=${businessUnitId}&type=text&q=${search}&limit=${limit}&skip=${skip}`,
    method: fetchMethod.GET,
};

export const getTeamConversationById = {
    api: (convId: string) => `/v1/team_conversations/${convId}`,
    method: fetchMethod.GET,
};

export const getTeamConversationByConvId = {
    api: (convId: string) => `/v1/team_conversations?type=conversation_id&q=${convId}`,
    method: fetchMethod.GET,
};

export const getTeamConversations = {
    api: (
        businessUnitId: string,
        view: keyof API.TeamConversationViewCount | 'team',
        channelTypes: API.ChannelType[],
        skip = 0,
        limit = 50,
    ) => {
        const params = new URLSearchParams();
        params.append('type', 'business_unit_id');
        params.append('q', businessUnitId);
        params.append('view', `${view}`);
        params.append('skip', `${skip}`);
        params.append('limit', `${limit}`);
        const channelTypeParams =
            channelTypes.length > 0 ? `&${channelTypes.map((channelType) => `channel_types=${channelType}`).join('&')}` : '';

        return `/v2/backend/team_conversations?${params}${channelTypeParams}`;
    },
    method: fetchMethod.GET,
};

export const getTeamConversationLabelById = {
    api: (team_id: string, limit = 50, skip = 0) => `/v1/backend/teams/${team_id}/team_labels?limit=${limit}&skip=${skip}`,
    method: fetchMethod.GET,
};

export const postJoinTeamConversation = {
    api: '/v1/backend/team_conversations/_join',
    method: fetchMethod.POST,
};

export const postLeaveTeamConversation = {
    api: '/v1/backend/team_conversations/_leave',
    method: fetchMethod.POST,
};

export const postUpdateTeamConversationName = {
    api: '/v1/backend/team_conversations/_update_name',
    method: fetchMethod.POST,
};
export const getConversationMessagesByTeamId = {
    api: (teamConvId: string, limit = 50, skip = 0) =>
        `/v1/conversation_messages?type=team_conversation_id&q=${teamConvId}&limit=${limit}&skip=${skip}`,
    method: fetchMethod.GET,
};

export const postConversationMessage = {
    api: '/v1/backend/conversation_messages',
    method: fetchMethod.POST,
};

export const postConversationMessageComment = {
    api: (convId: string, messageId: string) => `/v1/backend/conversations/${convId}/conversation_messages/${messageId}/comments`,
    method: fetchMethod.POST,
};
export const putConversationMessageComment = {
    api: (convId: string, commentId: string) => `/v1/backend/conversations/${convId}/comments/${commentId}`,
    method: fetchMethod.PUT,
};
export const deleteConversationMessageComment = {
    api: (convId: string, commentId: string) => `/v1/backend/conversations/${convId}/comments/${commentId}`,
    method: fetchMethod.DELETE,
};

export const pinConversationMessage = {
    api: (convId: string, msgId: string) => `/v1/backend/conversations/${convId}/conversation_messages/${msgId}?action=pin`,
    method: fetchMethod.GET,
};

export const unpinConversationMessage = {
    api: (convId: string, msgId: string) => `/v1/backend/conversations/${convId}/conversation_messages/${msgId}?action=unpin`,
    method: fetchMethod.GET,
};
export const postConversationFileUpload = {
    api: '/v1/backend/conversation_messages/_fileupload',
    method: fetchMethod.POST,
};

export const postTeamConversationUpdateStatus = {
    api: '/v1/backend/team_conversations/_update_status',
    method: fetchMethod.POST,
};

export const postTeamConversationJoinRequest = {
    api: '/v1/backend/team_conversations/_join_request',
    method: fetchMethod.POST,
};

export const getTeamConversationViewsCount = {
    api: (businessUnitId: string) => `/v2/backend/team_conversations/_views_count?type=business_unit_id&q=${businessUnitId}`,
    method: fetchMethod.GET,
};

export const postConversationVideoCall = {
    api: '/v1/backend/team_conversations/_init_jaas_conference',
    method: fetchMethod.POST,
};

export const getTeamConversationsByConversationId = {
    api: (conversationId: string) => `/v1/backend/team_conversations?type=conversation_id&q=${conversationId}`,
    method: fetchMethod.GET,
};

export const getOutstandingTeamConversations = {
    api: ({ businessUnitId, skip, limit }: { businessUnitId: string; skip: number; limit: number }) =>
        `/v1/backend/team_conversations/_outstanding?type=business_unit_id&q=${businessUnitId}&limit=${limit}&skip=${skip}`,
    method: fetchMethod.GET,
};

export const getTeamConversationsInvitableUser = {
    api: (teamConversationId: string) => `/v1/backend/team_conversations/${teamConversationId}/users`,
    method: fetchMethod.GET,
};

export const assignTeamAndUser = {
    api: () => '/v1/backend/team_conversations/assign_team_member',
    method: fetchMethod.POST,
};

export const removeUserFromConversation = {
    api: () => '/v1/backend/team_conversations/remove_team_member',
    method: fetchMethod.POST,
};

export const getTeamConversationsAssignableTeam = {
    api: () => '/v1/backend/assign/teams/all',
    method: fetchMethod.GET,
};

export const getTeamInvitableUser = {
    api: (teamId: string) => `/v1/backend/assign/team/${teamId}/observers`,
    method: fetchMethod.GET,
};

export const getTeamConversationUserByConversationID = {
    api: (conversationId: string) => `/v1/backend/conversations/${conversationId}`,
    method: fetchMethod.GET,
};
