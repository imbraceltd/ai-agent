import type { SerializedError } from '@reduxjs/toolkit';

import type { PaginationParams } from './index.types';

export interface ReduxTeamConversations extends API.TeamConversationListItem {
    team_name?: string;
    presenceTime?: string;
    deleted_at?: string;
}

export interface InitialState {
    currentRequestId?: string;
    fetchConvByIdCurrentRequestId?: string;
    viewFilterUpdateStatus: LoadingStatus;
    viewFilter: Views;
    viewFilterTeamId?: string;
    channelFilterUpdateStatus: LoadingStatus;
    channelFilter: API.ChannelType[];
    getTeamConversationsStatus: LoadingStatus;
    teamConversations: ReduxTeamConversations[];
    hasMoreTeamConversations: boolean;
    teamConversationsTotal: number;
    teamConversationsCount: number;
    teamConversationsSkip: number;
    teamConversationsLimit: number;
    getTeamConversationByIdStatus: LoadingStatus;
    teamConversation?: API.TeamConversation & { presenceTime?: string };
    teamConversationSearchQuery: string;
    joinTeamConversationStatus: LoadingStatus;
    leaveTeamConversationStatus: LoadingStatus;
    updateTeamConversationNameStatus: LoadingStatus;
    statusUpdatedEventStatus: LoadingStatus;
    updateConversationContactStatus: LoadingStatus;
    postTeamConversationUpdateStatus: LoadingStatus;
    unreadTeamConvs: string[];
    conversationJoinRequestStatus: LoadingStatus;
    getViewsCountStatus: LoadingStatus;
    getTeamConversationLabelByIdStatus: LoadingStatus;
    teamLabels: API.TeamConversationLabel[];
    getTeamConversationsByConversationIdStatus: LoadingStatus;
    postConversationVideoCallStatus: LoadingStatus;

    errors?: {
        viewCountError?: string | SerializedError;
        teamConversationsError?: string | SerializedError;
        teamConversationByIdError?: string | SerializedError;
        updateStatusError?: string | SerializedError;
        joinError?: string | SerializedError;
        statusUpdatedEventError?: string | SerializedError;
        leaveError?: string | SerializedError;
        sortConversationsError?: string | SerializedError;
        conversationCreatedEvent?: string | SerializedError;
        agentNeededEventError?: string | SerializedError;
        conversationJoinRequestError?: string | SerializedError;
        updateConversationNameError?: string | SerializedError;
        conversationJoinedEventError?: string | SerializedError;
        conversationLeftEventError?: string | SerializedError;
        conversationInvitedEventError?: string | SerializedError;
    };
}

export type Views = 'all' | 'yours' | 'team' | 'online' | API.StatusType;

export interface FetchTeamConversationPayload {
    teamConversations?: ReduxTeamConversations[];
    hasMoreTeamConversations?: boolean;
    teamConversationsTotal?: number;
    teamConversationsCount?: number;
    teamConversationsSkip?: number;
    teamConversationsLimit?: number;
    unreadTeamConvs?: string[];
    teamConversationSearchQuery?: string;
}

export interface FetchTeamConversationParams extends PaginationParams {
    channelTypes?: API.ChannelType[];
    view?: Views;
    teamId?: string;
    search?: string;
}

export interface FetchTeamConversationByIdThunkPayload {
    teamConversation: API.TeamConversation;
}
export interface FetchTeamConversationLabelByIdThunkPayload {
    items: API.TeamConversationLabel[];
    total: number;
    count: number;
    limit: number;
    skip: number;
    hasMore: boolean;
}

export interface UpdateStatusThunkParams {
    id: string;
    status: 'active' | 'closed';
}
export interface UpdateStatusThunkPayload {
    teamConversation: API.TeamConversation;
}
export interface StatusUpdatedEventThunkPayload {
    // teamConversations: ReduxTeamConversations[];
    hasMoreTeamConversations?: boolean;
    teamConversationsCount?: number;
    teamConversation?: API.TeamConversation & { presenceTime?: string };
}

export interface JoinTeamConversationThunkPayload {
    teamConversation: API.TeamConversation;
    // teamConversations: ReduxTeamConversations[];
}

export interface UpdateConversationNameThunkParams {
    id: string;
    name: string;
}

export interface ConversationJoinedEventThunkPayload {
    teamConversations?: ReduxTeamConversations[];
    teamConversation?: API.TeamConversation;
}

export interface ConversationNameUpdatedEventThunkPayload {
    teamConversation?: API.TeamConversation;
}
