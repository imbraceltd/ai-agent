import type { PayloadAction } from '@reduxjs/toolkit';
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { AxiosError } from 'axios';
import i18next from 'i18next';
import { chunk } from 'lodash';
import uniqBy from 'lodash/uniqBy';
import { push } from 'redux-first-history';

import { queryClient } from '@/App';
import type { TeamConversationsQueryData, TeamConversationsQueryParams } from '@/pages/Conversations/components/ConversationList';
import {
    getTeamConversationById,
    getTeamConversationLabelById,
    postJoinTeamConversation,
    postLeaveTeamConversation,
    postTeamConversationJoinRequest,
    postTeamConversationUpdateStatus,
    postUpdateTeamConversationName,
} from '@/services/api/teamConversation';

import { FETCH_FAILED, FETCH_IN_PROGRESS, FETCH_SUCCEEDED, IDLE } from '../../constants/app';
import apiFetch from '../../services/axios/handler';
import { setContact } from './contact';
import type { AsyncThunkOptions } from './index.types';
import type {
    ConversationJoinedEventThunkPayload,
    ConversationNameUpdatedEventThunkPayload,
    FetchTeamConversationByIdThunkPayload,
    FetchTeamConversationLabelByIdThunkPayload,
    InitialState,
    JoinTeamConversationThunkPayload,
    ReduxTeamConversations,
    StatusUpdatedEventThunkPayload,
    UpdateConversationNameThunkParams,
    UpdateStatusThunkParams,
    UpdateStatusThunkPayload,
    Views,
} from './teamConversation.types';

const initialState: InitialState = {
    viewFilterUpdateStatus: IDLE,
    viewFilter: 'all',
    viewFilterTeamId: '',
    channelFilterUpdateStatus: IDLE,
    channelFilter: ['web', 'whatsapp', 'facebook', 'email', 'wechat', 'line', 'instagram'],
    getTeamConversationsStatus: IDLE,
    teamConversations: [],
    hasMoreTeamConversations: false,
    teamConversationsTotal: 0,
    teamConversationsCount: 0,
    teamConversationsSkip: 0,
    teamConversationsLimit: 10,
    teamConversationSearchQuery: '',

    getTeamConversationByIdStatus: IDLE,
    teamConversation: undefined,

    joinTeamConversationStatus: IDLE,
    leaveTeamConversationStatus: IDLE,
    updateTeamConversationNameStatus: IDLE,

    updateConversationContactStatus: IDLE,

    postTeamConversationUpdateStatus: IDLE,

    statusUpdatedEventStatus: IDLE,

    unreadTeamConvs: [],
    teamLabels: [],

    conversationJoinRequestStatus: IDLE,

    getViewsCountStatus: IDLE,

    getTeamConversationsByConversationIdStatus: IDLE,
    getTeamConversationLabelByIdStatus: IDLE,
    postConversationVideoCallStatus: IDLE,

    errors: undefined,
};

// const sortStatus = ['overdue', 'soon to be', 'rep needed', 'pending', 'unassigned'].reverse();

const serializeTeamConversation = (
    teamConvs: ReduxTeamConversations[],
    teams?: {
        [key: string]: API.Team;
    },
): ReduxTeamConversations[] => {
    return teamConvs.map((teamConv) => {
        if (teamConv.conversation) {
            const { name, status, timestamp, is_agent_joined, channel_type } = teamConv.conversation;
            return {
                ...teamConv,
                id: teamConv._id,
                name,
                status,
                timestamp,
                is_agent_joined,
                channel_type,
                team_name: teams?.[teamConv.team_id]?.name || teamConv.team_name,
            };
        }
        return {
            ...teamConv,
            team_name: teams?.[teamConv.team_id]?.name || teamConv.team_name,
        };
    });
};

/**
 * Fetch team conversation by id
 *
 * @param {string} convId - Conversation id
 */
export const fetchTeamConversationByIdThunk = createAsyncThunk<FetchTeamConversationByIdThunkPayload, string, AsyncThunkOptions>(
    'TeamConversation/fetchTeamConversationById',
    async (convId, { rejectWithValue, dispatch }) => {
        console.log('fetchTeamConversationByIdThunk', convId);
        try {
            const api = getTeamConversationById.api(convId);

            const response = await apiFetch<API.TeamConversation>(api, getTeamConversationById.method);

            const payload = {
                teamConversation: response.data,
            };
            dispatch(setContact(response.data.contact));
            // dispatch(push(`/chatroom?conv_id=${response.data.id}`));
            return payload;
        } catch (err) {
            const error = err as AxiosError;
            let message = 'Something went wrong';
            if (!error.response) {
                if (err instanceof Error) {
                    message = err.message;
                }
            } else {
                message = error.response.data;
            }
            return rejectWithValue({ message });
        }
    },
    // {
    //     condition: (convId, { getState }) => {
    //         const { TeamConversation } = getState();
    //         if (TeamConversation.teamConversation?.id === convId) {
    //             return false;
    //         }
    //     },
    // },
);

/**
 * Fetch views count
 */
export const fetchViewsCountThunk = createAsyncThunk<void, void, AsyncThunkOptions>(
    'TeamConversation/fetchViewsCount',
    async (params, { getState, rejectWithValue }) => {
        try {
            const state = getState();

            queryClient.refetchQueries({
                queryKey: ['viewsCount', state.BusinessUnit.businessUnitList[0].id],
            });
        } catch (err) {
            const error = err as AxiosError;
            let message = 'Something went wrong';
            if (!error.response) {
                if (err instanceof Error) {
                    message = err.message;
                }
            } else {
                message = error.response.data;
            }
            return rejectWithValue({ message });
        }
    },
    {
        condition: (params, { getState }) => {
            const { TeamConversation } = getState();
            if (TeamConversation.getViewsCountStatus === FETCH_IN_PROGRESS) {
                return false;
            }
        },
    },
);

/**
 * Update conversation status
 *
 * @param {string} obj.id - Team conversation id
 * @param {string} obj.status - Conversation status
 */
export const updateStatusThunk = createAsyncThunk<UpdateStatusThunkPayload, UpdateStatusThunkParams, AsyncThunkOptions>(
    'TeamConversation/updateStatus',
    async (params, { getState, rejectWithValue }) => {
        try {
            const state = getState();
            const { TeamConversation, BusinessUnit } = state;
            const { businessUnitList } = BusinessUnit;
            const { teamConversationSearchQuery, viewFilter, viewFilterTeamId, channelFilter } = TeamConversation;
            const response = await apiFetch<API.TeamConversation>(
                postTeamConversationUpdateStatus.api,
                postTeamConversationUpdateStatus.method,
                params,
            );

            const isExist = queryClient
                .getQueryData<{
                    pageParams?: number[];
                    pages?: TeamConversationsQueryData[];
                }>([
                    'teamConversations',
                    {
                        businessUnitId: businessUnitList[0].id,
                        search: teamConversationSearchQuery,
                        limit: 50,
                        view: viewFilter,
                        channelTypes: channelFilter,
                        teamId: viewFilterTeamId,
                    },
                ])
                ?.pages?.flatMap((d) => d.data)
                .some((conv) => conv.id === response.data.id);

            if (isExist) {
                queryClient.setQueryData<
                    {
                        pageParams?: number[];
                        pages?: TeamConversationsQueryData[];
                    },
                    TeamConversationsQueryParams
                >(
                    [
                        'teamConversations',
                        {
                            businessUnitId: BusinessUnit.businessUnitList[0].id,
                            search: teamConversationSearchQuery,
                            limit: 50,
                            view: viewFilter,
                            channelTypes: channelFilter,
                            teamId: viewFilterTeamId,
                        },
                    ],
                    (prev) => {
                        const allRows = prev?.pages?.flatMap((d) => d.data) || [];

                        const newRows = allRows.map((teamConv) => {
                            if (teamConv.id === response.data.id) {
                                return {
                                    ...teamConv,
                                    ...response.data,
                                };
                            }
                            return teamConv;
                        });
                        const pageDataChunk = chunk(newRows, 50);
                        return {
                            ...prev,
                            pages: prev?.pages?.map((page, index) => ({
                                ...page,
                                data: pageDataChunk[index],
                            })),
                        };
                    },
                );
            }

            const payload = {
                teamConversation: response.data,
            };

            return payload;
        } catch (err) {
            const error = err as AxiosError;
            let message = 'Something went wrong';
            if (!error.response) {
                if (err instanceof Error) {
                    message = err.message;
                }
            } else {
                message = error.response.data;
            }
            return rejectWithValue({ message });
        }
    },
);

const isInSameView = (
    current: { viewFilter: Views; viewFilterTeamId?: string; channelFilter: API.ChannelType[] },
    conversation: { status: API.StatusType; teamId?: string; isJoined?: boolean; channelType: API.ChannelType; isPresence: boolean },
) => {
    const { viewFilter, viewFilterTeamId, channelFilter } = current;
    const { status, isJoined, teamId, channelType, isPresence } = conversation;
    if (!channelFilter.includes(channelType)) {
        return false;
    }
    if (status !== 'closed' && status !== 'spam') {
        if (viewFilter === 'team' && viewFilterTeamId === teamId) {
            return true;
        }
        if (viewFilter === 'yours' && isJoined) {
            return true;
        }
        if (viewFilter === 'all') {
            return true;
        }
        if (viewFilter === 'online' && isPresence) {
            return true;
        }
        if (viewFilter === status) {
            return true;
        }
    } else if (viewFilter === status) {
        return true;
    }

    return false;
};

/**
 * Status updated event
 *
 * @param {Object} eventPayload - Payload Object from socket
 */
export const statusUpdatedEventThunk = createAsyncThunk<StatusUpdatedEventThunkPayload, ImbraceSocket.StatusUpdated, AsyncThunkOptions>(
    'TeamConversation/statusUpdatedEvent',
    async (eventPayload, { getState, rejectWithValue }) => {
        try {
            const state = getState();
            const { TeamConversation, BusinessUnit } = state;
            const { teamConversation, teamConversationSearchQuery, viewFilter, channelFilter, viewFilterTeamId } = TeamConversation;
            const { conversation } = eventPayload;

            const isExist = queryClient
                .getQueryData<{
                    pageParams?: number[];
                    pages?: TeamConversationsQueryData[];
                }>([
                    'teamConversations',
                    {
                        businessUnitId: BusinessUnit.businessUnitList[0].id,
                        search: teamConversationSearchQuery,
                        limit: 50,
                        view: viewFilter,
                        channelTypes: channelFilter,
                        teamId: viewFilterTeamId,
                    },
                ])
                ?.pages?.flatMap((d) => d.data)
                .some((conv) => conv.conversation_id === conversation.id);

            if (isExist) {
                queryClient.setQueryData<
                    {
                        pageParams?: number[];
                        pages?: TeamConversationsQueryData[];
                    },
                    TeamConversationsQueryParams
                >(
                    [
                        'teamConversations',
                        {
                            businessUnitId: BusinessUnit.businessUnitList[0].id,
                            search: teamConversationSearchQuery,
                            limit: 50,
                            view: viewFilter,
                            channelTypes: channelFilter,
                            teamId: viewFilterTeamId,
                        },
                    ],
                    (prev) => {
                        const allRows = prev?.pages?.flatMap((d) => d.data) || [];

                        const newRows = allRows.map((teamConv) => {
                            if (teamConv.conversation_id === conversation.id) {
                                return {
                                    ...teamConv,
                                    ...(teamConv.conversation && {
                                        conversation: {
                                            ...teamConv.conversation,
                                            status: conversation.status,
                                        },
                                    }),
                                    status: conversation.status,
                                };
                            }
                            return teamConv;
                        });
                        const pageDataChunk = chunk(newRows, 50);
                        return {
                            ...prev,
                            pages: prev?.pages?.map((page, index) => ({
                                ...page,
                                data: pageDataChunk[index],
                            })),
                        };
                    },
                );
            }

            const payload: StatusUpdatedEventThunkPayload = {};

            if (teamConversation && teamConversation.conversation_id === conversation.id) {
                payload.teamConversation = {
                    ...teamConversation,
                    ...(teamConversation.conversation && {
                        conversation: {
                            ...teamConversation.conversation,
                            status: conversation.status,
                        },
                    }),
                    status: conversation.status,
                };
            }

            return payload;
        } catch (err) {
            const error = err as AxiosError;
            let message = 'Something went wrong';
            if (!error.response) {
                if (err instanceof Error) {
                    message = err.message;
                }
            } else {
                message = error.response.data;
            }
            return rejectWithValue({ message });
        }
    },
);

/**
 * Join conversation
 *
 * @param {string} teamConvId - Conversation ID
 */
export const joinTeamConversationThunk = createAsyncThunk<
    JoinTeamConversationThunkPayload,
    { teamConvId: string; mode: string },
    AsyncThunkOptions
>('TeamConversation/join', async (params, { getState, rejectWithValue, dispatch }) => {
    try {
        const { teamConvId, mode } = params;

        const response = await apiFetch<API.TeamConversation>(postJoinTeamConversation.api, postJoinTeamConversation.method, {
            team_conversation_id: teamConvId,
            mode,
        });

        const payload = {
            teamConversation: response.data,
        };

        return payload;
    } catch (err) {
        const error = err as AxiosError;
        let message = 'Something went wrong';
        if (!error.response) {
            if (err instanceof Error) {
                message = err.message;
            }
        } else {
            message = error.response.data;
        }
        if (error?.response?.data?.code === 40000) {
            const notificationPayload = {
                message: 'Unable to join this conversation',
                messageType: 'noti_failed',
                variant: 'error',
            };

            // dispatch(pushNotification({ notification: notificationPayload }));
        }
        return rejectWithValue({ message });
    }
});

/**
 * Grab conversation
 *
 * grab an agent needed conversation
 * @param {string} convId - Conversation Id
 */
export const conversationJoinRequestThunk = createAsyncThunk<
    {
        success: boolean;
        joinable: boolean;
    },
    string,
    AsyncThunkOptions<{ success: boolean; joinable: boolean }>
>('TeamConversation/conversationJoinRequest', async (convId, { rejectWithValue, dispatch }) => {
    try {
        const requestBody = {
            id: convId,
        };

        await apiFetch(postTeamConversationJoinRequest.api, postTeamConversationJoinRequest.method, requestBody);

        return {
            success: true,
            joinable: false,
        };
    } catch (err) {
        const error = err as AxiosError;
        let message = 'Something went wrong';
        if (error?.response?.status === 404 || error?.response?.status === 401) {
            message = 'Sorry, this conversation is no longer available`';
            if (error.response?.status === 404) {
                message = 'Sorry, this conversation has been grabbed.';
            }
            if (error.response?.data?.message.indexOf('not allow for team admin') !== -1) {
                message = 'Team admin is not be able to grab.';
            }

            const notificationPayload = {
                message,
                messageType: 'noti_failed',
                variant: 'error',
            };
            // dispatch(pushNotification({ notification: notificationPayload }));
            return rejectWithValue({ message, success: false, joinable: false });
        }
        return rejectWithValue({ message, success: false, joinable: true });
    }
});

/**
 * Leave conversation
 *
 * @param {string} teamConvId - Conversation ID
 */
export const leaveTeamConversationThunk = createAsyncThunk<JoinTeamConversationThunkPayload, { teamConvId: string }, AsyncThunkOptions>(
    'TeamConversation/leave',
    async (params, { getState, rejectWithValue, dispatch }) => {
        try {
            const { teamConvId } = params;
            const response = await apiFetch<API.TeamConversation>(postLeaveTeamConversation.api, postJoinTeamConversation.method, {
                team_conversation_id: teamConvId,
            });

            const payload = {
                teamConversation: {
                    ...response.data,
                },
            };

            return payload;
        } catch (err) {
            const error = err as AxiosError;
            let message = 'Something went wrong';
            if (!error.response) {
                if (err instanceof Error) {
                    message = err.message;
                }
            } else {
                message = error.response.data;
            }
            if (error?.response?.data?.code === 40000) {
                const notificationPayload = {
                    message: 'Unable to leave this conversation',
                    messageType: 'noti_failed',
                    variant: 'error',
                };

                // dispatch(pushNotification({ notification: notificationPayload }));
            }
            return rejectWithValue({ message });
        }
    },
);

/**
 * Sort conversation list
 *
 * sort conversations after received message created event
 * @param {Object} eventPayload - Payload Object from socket
 */
export const sortConversationsThunk = createAsyncThunk<void, ImbraceSocket.MessageCreated, AsyncThunkOptions>(
    'TeamConversation/sortConversations',
    async (eventPayload, { getState, rejectWithValue, dispatch }) => {
        try {
            const { TeamConversation, BusinessUnit } = getState();
            const { businessUnitList } = BusinessUnit;
            const { teamConversationSearchQuery, viewFilter, viewFilterTeamId, channelFilter } = TeamConversation;
            const { conversation_id, id, type, content, created_at, from, organization_id, business_unit_id, updated_at } = eventPayload;

            const isExist = queryClient
                .getQueryData<{
                    pageParams?: number[];
                    pages?: TeamConversationsQueryData[];
                }>([
                    'teamConversations',
                    {
                        businessUnitId: businessUnitList[0].id,
                        search: teamConversationSearchQuery,
                        limit: 50,
                        view: viewFilter,
                        channelTypes: channelFilter,
                        teamId: viewFilterTeamId,
                    },
                ])
                ?.pages?.flatMap((d) => d.data)
                .some((conv) => conv.conversation_id === conversation_id);

            if (isExist) {
                queryClient.setQueryData<
                    {
                        pageParams?: number[];
                        pages?: TeamConversationsQueryData[];
                    },
                    TeamConversationsQueryParams
                >(
                    [
                        'teamConversations',
                        {
                            businessUnitId: BusinessUnit.businessUnitList[0].id,
                            search: teamConversationSearchQuery,
                            limit: 50,
                            view: viewFilter,
                            channelTypes: channelFilter,
                            teamId: viewFilterTeamId,
                        },
                    ],
                    (prev) => {
                        const allRows = prev?.pages?.flatMap((d) => d.data) || [];

                        const newRows = allRows.map((teamConv) => {
                            if (teamConv.conversation_id === conversation_id) {
                                const latestMessage = {
                                    object_name: 'message',
                                    id,
                                    type,
                                    content,
                                    created_at,
                                    from,
                                    is_bot: false,
                                    organization_id,
                                    business_unit_id,
                                    updated_at,
                                    conversation_id,
                                } as API.LatestMessage;
                                return {
                                    ...teamConv,
                                    latest_message: latestMessage,
                                    timestamp: created_at,
                                    updated_at,
                                    ...(teamConv.conversation && {
                                        conversation: {
                                            ...teamConv.conversation,
                                            timestamp: updated_at,
                                            created_at,
                                            updated_at,
                                        },
                                    }),
                                };
                            }
                            return teamConv;
                        });
                        const pageDataChunk = chunk(newRows, 50);
                        return {
                            ...prev,
                            pages: prev?.pages?.map((page, index) => ({
                                ...page,
                                data: pageDataChunk[index],
                            })),
                        };
                    },
                );
                return;
            }

            queryClient.refetchQueries({
                queryKey: [
                    'teamConversations',
                    {
                        businessUnitId: businessUnitList[0].id,
                        search: teamConversationSearchQuery,
                        limit: 50,
                        view: viewFilter,
                        channelTypes: channelFilter,
                        teamId: viewFilterTeamId,
                    },
                ],
            });
        } catch (err) {
            const error = err as AxiosError;
            let message = 'Something went wrong';
            if (!error.response) {
                if (err instanceof Error) {
                    message = err.message;
                }
            } else {
                message = error.response.data;
            }
            return rejectWithValue({ message });
        }
    },
    {
        condition: (eventPayload, { getState }) => {
            const { TeamConversation } = getState();
            const { conversation_status, channel_type } = eventPayload;
            if (
                ['all', 'yours', 'team'].includes(TeamConversation.viewFilter) &&
                (conversation_status === 'closed' || conversation_status === 'spam')
            ) {
                return false;
            }
            if (TeamConversation.viewFilter === 'spam' && conversation_status !== 'spam') {
                return false;
            }
            if (TeamConversation.viewFilter === 'closed' && conversation_status !== 'closed') {
                return false;
            }
            if (!TeamConversation.channelFilter.includes(channel_type)) {
                return false;
            }
        },
    },
);

/**
 * Conversation created event
 *
 * prepend new conversation into list
 * @param {Object} eventPayload - Payload Object from socket
 */
export const conversationCreatedEventThunk = createAsyncThunk<void, ImbraceSocket.ConversationCreated, AsyncThunkOptions>(
    'TeamConversation/conversationCreatedEvent',
    async (eventPayload, { getState, rejectWithValue, dispatch }) => {
        try {
            const state = getState();
            const { TeamConversation, BusinessUnit } = state;
            const businessUnitList = BusinessUnit.businessUnitList;
            const { viewFilter, viewFilterTeamId, channelFilter, teamConversationSearchQuery } = TeamConversation;
            const { status, channel_type, id, team_id, is_joined, team, is_presence } = eventPayload;
            if (
                isInSameView(
                    { viewFilter, viewFilterTeamId, channelFilter },
                    {
                        status,
                        teamId: team_id,
                        isJoined: is_joined,
                        channelType: channel_type,
                        isPresence: is_presence,
                    },
                )
            ) {
                // only append the room into current list if same as the status we filtering
                // only append the room into current list if same as current channel filter

                const createdTeamConv = serializeTeamConversation([eventPayload], {
                    [team_id]: team,
                });

                if (is_joined) {
                    // is_joined: true => only in grab mode
                    dispatch(push(`/chatroom?conv_id=${id}`));
                }

                queryClient.setQueryData<
                    {
                        pageParams?: number[];
                        pages?: TeamConversationsQueryData[];
                    },
                    TeamConversationsQueryParams
                >(
                    [
                        'teamConversations',
                        {
                            businessUnitId: businessUnitList[0].id,
                            search: teamConversationSearchQuery,
                            limit: 50,
                            view: viewFilter,
                            channelTypes: channelFilter,
                            teamId: viewFilterTeamId,
                        },
                    ],
                    (prev) => {
                        const allRows = prev?.pages?.flatMap((d) => d.data) || [];
                        if (allRows.some((data) => data._id === createdTeamConv[0]._id)) {
                            const newRows = uniqBy([...createdTeamConv, ...allRows], (el) => el.id);
                            const pageDataChunk = chunk(newRows, 50);
                            return {
                                ...prev,
                                pages: prev?.pages?.map((page, index) => ({
                                    ...page,
                                    data: pageDataChunk[index],
                                })),
                            };
                        }
                        const pages = prev?.pages;
                        pages?.[0].data.unshift(...createdTeamConv);
                        return {
                            ...prev,
                            pages,
                        };
                    },
                );
            }
            const data =
                queryClient.getQueryData<API.ChannelType[]>([
                    'channel_count',
                    {
                        viewFilter,
                        viewFilterTeamId,
                        countConvs: true,
                    },
                ]) || [];
            if (data.indexOf(channel_type) === -1) {
                queryClient.refetchQueries({
                    queryKey: [
                        'channel_count',
                        {
                            viewFilter,
                            viewFilterTeamId,
                            countConvs: true,
                        },
                    ],
                });
            }
        } catch (err) {
            const error = err as AxiosError;
            let message = 'Something went wrong';
            if (!error.response) {
                if (err instanceof Error) {
                    message = err.message;
                }
            } else {
                message = error.response.data;
            }
            return rejectWithValue({ message });
        }
    },
    {
        condition: (eventPayload, { getState }) => {
            const { TeamConversation } = getState();
            if (TeamConversation.teamConversationSearchQuery) {
                return false;
            }
        },
    },
);

/**
 * Agent needed event
 *
 * push an agent needed in app notification
 * @param {Object} eventPayload - Payload Object from socket
 */
export const agentNeededConversationThunk = createAsyncThunk<void, ImbraceSocket.AgentNeeded, AsyncThunkOptions>(
    'TeamConversation/agentNeededEvent',
    async (eventPayload, { rejectWithValue, dispatch }) => {
        try {
            const { id, conversation, team_id } = eventPayload;
            const notificationPayload = {
                message: 'snack_message_new_conversation',
                messageType: 'agent_needed',
                dismissed: false,
                roomName: conversation.name,
                roomId: id,
                roomChannelType: conversation.channel_type,
                teamId: team_id,
                timestamp: conversation.timestamp,
                joinable: true,
            };
            // dispatch(pushNotification({ notification: notificationPayload }));

            // dispatch(fetchNotificationsThunk({ limit: 10, skip: 0 }));
        } catch (err) {
            const error = err as AxiosError;
            let message = 'Something went wrong';
            if (!error.response) {
                if (err instanceof Error) {
                    message = err.message;
                }
            } else {
                message = error.response.data;
            }
            return rejectWithValue({ message });
        }
    },
);

/**
 * Update conversation name
 *
 * @param {string} obj.id - Conversation id
 * @param {string} obj.name - Conversation name
 */
export const updateConversationNameThunk = createAsyncThunk<void, UpdateConversationNameThunkParams, AsyncThunkOptions>(
    'TeamConversation/updateConversationName',
    async (params, { rejectWithValue }) => {
        try {
            await apiFetch<API.TeamConversation>(postUpdateTeamConversationName.api, postUpdateTeamConversationName.method, params);
        } catch (err) {
            const error = err as AxiosError;
            let message = 'Something went wrong';
            if (!error.response) {
                if (err instanceof Error) {
                    message = err.message;
                }
            } else {
                message = error.response.data;
            }
            return rejectWithValue({ message });
        }
    },
);
/**
 * Conversation Name update event
 *
 * @param {Object} eventPayload - Payload Object from socket
 */
export const conversationNameUpdatedEventThunk = createAsyncThunk<
    ConversationNameUpdatedEventThunkPayload,
    ImbraceSocket.NameUpdated,
    AsyncThunkOptions
>('TeamConversation/conversationNameUpdatedEvent', async (eventPayload, { rejectWithValue, getState }) => {
    try {
        const state = getState();
        const { TeamConversation, BusinessUnit } = state;
        const businessUnitList = BusinessUnit.businessUnitList;
        const { viewFilter, viewFilterTeamId, channelFilter, teamConversationSearchQuery, teamConversation } = TeamConversation;
        const { id, conversation } = eventPayload;

        const payload: ConversationJoinedEventThunkPayload = {};

        const isExist = queryClient
            .getQueryData<{
                pageParams?: number[];
                pages?: TeamConversationsQueryData[];
            }>([
                'teamConversations',
                {
                    businessUnitId: businessUnitList[0].id,
                    search: teamConversationSearchQuery,
                    limit: 50,
                    view: viewFilter,
                    channelTypes: channelFilter,
                    teamId: viewFilterTeamId,
                },
            ])
            ?.pages?.flatMap((d) => d.data)
            .some((conv) => conv.conversation_id === id);

        if (isExist) {
            queryClient.setQueryData<
                {
                    pageParams?: number[];
                    pages?: TeamConversationsQueryData[];
                },
                TeamConversationsQueryParams
            >(
                [
                    'teamConversations',
                    {
                        businessUnitId: businessUnitList[0].id,
                        search: teamConversationSearchQuery,
                        limit: 50,
                        view: viewFilter,
                        channelTypes: channelFilter,
                        teamId: viewFilterTeamId,
                    },
                ],
                (prev) => {
                    const allRows = prev?.pages?.flatMap((d) => d.data) || [];

                    const newRows = allRows.map((teamConv) => {
                        if (teamConv.conversation_id === id) {
                            return {
                                ...teamConv,
                                ...(teamConv.conversation && {
                                    conversation: {
                                        ...teamConv.conversation,
                                        name: conversation.name,
                                    },
                                }),
                                name: conversation.name,
                            };
                        }
                        return teamConv;
                    });
                    const pageDataChunk = chunk(newRows, 50);
                    return {
                        ...prev,
                        pages: prev?.pages?.map((page, index) => ({
                            ...page,
                            data: pageDataChunk[index],
                        })),
                    };
                },
            );
        }

        if (teamConversation?.conversation_id === id) {
            payload.teamConversation = {
                ...teamConversation,
                ...(teamConversation.conversation && {
                    conversation: {
                        ...teamConversation.conversation,
                        name: conversation.name,
                    },
                }),
                name: conversation.name,
            };
        }

        return payload;
    } catch (err) {
        const error = err as AxiosError;
        let message = 'Something went wrong';
        if (!error.response) {
            if (err instanceof Error) {
                message = err.message;
            }
        } else {
            message = error.response.data;
        }
        return rejectWithValue({ message });
    }
});

/**
 * Conversation joined event
 *
 * @param {Object} eventPayload - Payload Object from socket
 */
export const conversationJoinedEventThunk = createAsyncThunk<ConversationJoinedEventThunkPayload, ImbraceSocket.Joined, AsyncThunkOptions>(
    'TeamConversation/conversationJoinedEvent',
    async (eventPayload, { rejectWithValue, getState }) => {
        try {
            const state = getState();
            const { TeamConversation, Account, BusinessUnit } = state;
            const businessUnitList = BusinessUnit.businessUnitList;
            const { viewFilter, viewFilterTeamId, channelFilter, teamConversationSearchQuery } = TeamConversation;
            const { id, user, team_id } = eventPayload;

            const payload: ConversationJoinedEventThunkPayload = {};
            // const existIndex = TeamConversation.teamConversations.findIndex((teamConv) => teamConv.conversation_id === id);

            const isExist = queryClient
                .getQueryData<{
                    pageParams?: number[];
                    pages?: TeamConversationsQueryData[];
                }>([
                    'teamConversations',
                    {
                        businessUnitId: businessUnitList[0].id,
                        search: teamConversationSearchQuery,
                        limit: 50,
                        view: viewFilter,
                        channelTypes: channelFilter,
                        teamId: viewFilterTeamId,
                    },
                ])
                ?.pages?.flatMap((d) => d.data)
                .some((conv) => conv.conversation_id === id);

            if (isExist) {
                queryClient.setQueryData<
                    {
                        pageParams?: number[];
                        pages?: TeamConversationsQueryData[];
                    },
                    TeamConversationsQueryParams
                >(
                    [
                        'teamConversations',
                        {
                            businessUnitId: businessUnitList[0].id,
                            search: teamConversationSearchQuery,
                            limit: 50,
                            view: viewFilter,
                            channelTypes: channelFilter,
                            teamId: viewFilterTeamId,
                        },
                    ],
                    (prev) => {
                        const allRows = prev?.pages?.flatMap((d) => d.data) || [];

                        const newRows = allRows.map((teamConv) => {
                            if (teamConv.conversation_id === id && teamConv.team_id === team_id) {
                                return {
                                    ...teamConv,
                                    ...(teamConv.conversation && {
                                        conversation: {
                                            ...teamConv.conversation,
                                            is_agent_joined: true,
                                        },
                                    }),
                                    is_agent_joined: true,
                                    is_joined: teamConv.is_joined || user.id === Account.id,
                                };
                            }
                            return teamConv;
                        });
                        const pageDataChunk = chunk(newRows, 50);
                        return {
                            ...prev,
                            pages: prev?.pages?.map((page, index) => ({
                                ...page,
                                data: pageDataChunk[index],
                            })),
                        };
                    },
                );

                // const teamConversations = state.TeamConversation.teamConversations.map((teamConv) => {
                //     if (teamConv.conversation_id === id && teamConv.team_id === team_id) {
                //         return {
                //             ...teamConv,
                //             ...(teamConv.conversation && {
                //                 conversation: {
                //                     ...teamConv.conversation,
                //                     is_agent_joined: true,
                //                 },
                //             }),
                //             is_agent_joined: true,
                //             is_joined: teamConv.is_joined || user.id === Account.id,
                //         };
                //     }
                //     return teamConv;
                // });

                // payload.teamConversations = teamConversations;
            }
            if (
                TeamConversation.teamConversation &&
                TeamConversation.teamConversation.conversation_id === id &&
                TeamConversation.teamConversation.team_id === team_id
            ) {
                if (user.id === Account.id) {
                    payload.teamConversation = {
                        ...TeamConversation.teamConversation,
                        ...(TeamConversation.teamConversation.conversation && {
                            conversation: {
                                ...TeamConversation.teamConversation.conversation,
                                is_agent_joined: true,
                            },
                        }),
                        users: [...TeamConversation.teamConversation.users, user],
                        is_joined: true,
                        is_agent_joined: true,
                    };
                    return payload;
                }
                payload.teamConversation = {
                    ...TeamConversation.teamConversation,
                    users: [...TeamConversation.teamConversation.users, user],
                };
            }

            return payload;
        } catch (err) {
            const error = err as AxiosError;
            let message = 'Something went wrong';
            if (!error.response) {
                if (err instanceof Error) {
                    message = err.message;
                }
            } else {
                message = error.response.data;
            }
            return rejectWithValue({ message });
        }
    },
);

/**
 * Conversation left event
 *
 * @param {Object} eventPayload - Payload Object from socket
 */
export const conversationLeftEventThunk = createAsyncThunk<ConversationJoinedEventThunkPayload, ImbraceSocket.Left, AsyncThunkOptions>(
    'TeamConversation/conversationLeftEvent',
    async (eventPayload, { rejectWithValue, getState, dispatch }) => {
        try {
            const state = getState();
            const { TeamConversation, Account, BusinessUnit } = state;
            const businessUnitList = BusinessUnit.businessUnitList;
            const { viewFilter, viewFilterTeamId, channelFilter, teamConversationSearchQuery } = TeamConversation;
            const { id, user, is_agent_joined, is_joined, team_id } = eventPayload;

            const payload: ConversationJoinedEventThunkPayload = {};

            // const existIndex = state.TeamConversation.teamConversations.findIndex((teamConv) => teamConv.conversation_id === id);
            const isExist = queryClient
                .getQueryData<{
                    pageParams?: number[];
                    pages?: TeamConversationsQueryData[];
                }>([
                    'teamConversations',
                    {
                        businessUnitId: businessUnitList[0].id,
                        search: teamConversationSearchQuery,
                        limit: 50,
                        view: viewFilter,
                        channelTypes: channelFilter,
                        teamId: viewFilterTeamId,
                    },
                ])
                ?.pages?.flatMap((d) => d.data)
                .some((conv) => conv.conversation_id === id);

            if (isExist) {
                queryClient.setQueryData<
                    {
                        pageParams?: number[];
                        pages?: TeamConversationsQueryData[];
                    },
                    TeamConversationsQueryParams
                >(
                    [
                        'teamConversations',
                        {
                            businessUnitId: businessUnitList[0].id,
                            search: teamConversationSearchQuery,
                            limit: 50,
                            view: viewFilter,
                            channelTypes: channelFilter,
                            teamId: viewFilterTeamId,
                        },
                    ],
                    (prev) => {
                        const allRows = prev?.pages?.flatMap((d) => d.data) || [];

                        const newRows = allRows.map((teamConv) => {
                            if (teamConv.conversation_id === id && teamConv.team_id === team_id) {
                                return {
                                    ...teamConv,
                                    ...(teamConv.conversation && {
                                        conversation: {
                                            ...teamConv.conversation,
                                            is_agent_joined,
                                        },
                                    }),
                                    is_agent_joined,
                                    is_joined,
                                };
                            }
                            return teamConv;
                        });
                        const pageDataChunk = chunk(newRows, 50);
                        return {
                            ...prev,
                            pages: prev?.pages?.map((page, index) => ({
                                ...page,
                                data: pageDataChunk[index],
                            })),
                        };
                    },
                );
                // const teamConversations = TeamConversation.teamConversations.map((teamConv) => {
                //     if (teamConv.conversation_id === id && teamConv.team_id === team_id) {
                //         return {
                //             ...teamConv,
                //             ...(teamConv.conversation && {
                //                 conversation: {
                //                     ...teamConv.conversation,
                //                     is_agent_joined,
                //                 },
                //             }),
                //             is_agent_joined,
                //             is_joined,
                //         };
                //     }
                //     return teamConv;
                // });

                // payload.teamConversations = teamConversations;
                // payload.teamConversation = TeamConversation.teamConversation;
            }

            if (
                TeamConversation.teamConversation &&
                TeamConversation.teamConversation.conversation_id === id &&
                TeamConversation.teamConversation.team_id === team_id
            ) {
                if (user.id === Account.id) {
                    payload.teamConversation = {
                        ...TeamConversation.teamConversation,
                        ...(TeamConversation.teamConversation.conversation && {
                            conversation: {
                                ...TeamConversation.teamConversation.conversation,
                                is_agent_joined,
                            },
                        }),
                        is_joined: false,
                        is_agent_joined: is_agent_joined,
                    };
                    return payload;
                }
                const existUserIndex = TeamConversation.teamConversation?.users.findIndex((teamConvUser) => teamConvUser.id === user.id);
                const users = TeamConversation.teamConversation.users;
                if (existUserIndex !== -1) {
                    users.splice(existUserIndex, 1);
                }
                payload.teamConversation = {
                    ...TeamConversation.teamConversation,
                    users,
                };
            }

            return payload;
        } catch (err) {
            const error = err as AxiosError;
            let message = 'Something went wrong';
            if (!error.response) {
                if (err instanceof Error) {
                    message = err.message;
                }
            } else {
                message = error.response.data;
            }
            return rejectWithValue({ message });
        }
    },
);
/**
 * Fetch team conversation by id
 *
 * @param {string} convId - Conversation id
 */
export const fetchTeamConversationLabelByIdThunk = createAsyncThunk<FetchTeamConversationLabelByIdThunkPayload, string, AsyncThunkOptions>(
    'TeamConversation/fetchTeamConversationLabelById',
    async (team_id, { getState, rejectWithValue }) => {
        try {
            const state = getState();
            const skip = 0;
            const limit = 50;
            const api = getTeamConversationLabelById.api(team_id, limit, skip);

            const response = await apiFetch<API.TeamConversationLabelList>(api, getTeamConversationLabelById.method);

            let teamLabels;
            if (skip > 0) {
                teamLabels = [...state.TeamConversation.teamLabels, ...response.data.items];
            } else {
                teamLabels = response.data.items;
            }
            const payload: FetchTeamConversationLabelByIdThunkPayload = {
                items: teamLabels,
                hasMore: response.data.has_more,
                total: response.data.total,
                count: response.data.count,
                skip: skip,
                limit: limit,
            };

            return payload;
        } catch (err) {
            const error = err as AxiosError;
            let message = 'Something went wrong';
            if (!error.response) {
                if (err instanceof Error) {
                    message = err.message;
                }
            } else {
                message = error.response.data;
            }
            return rejectWithValue({ message });
        }
    },
);

/**
 * Conversation invited event
 *
 * @param {Object} eventPayload - Payload Object from socket
 */
export const conversationInvitedEventThunk = createAsyncThunk<void, ImbraceSocket.ConversationInvited, AsyncThunkOptions>(
    'TeamConversation/conversationInvitedEvent',
    async (eventPayload, { rejectWithValue, getState, dispatch }) => {
        try {
            const state = getState();
            const { TeamConversation, Account } = state;
            const { teamConversation } = TeamConversation;
            const { conversation_id, user } = eventPayload;
            if (teamConversation && conversation_id === teamConversation.conversation_id) {
                dispatch(fetchTeamConversationByIdThunk(teamConversation.id));
            }
            const message =
                Account.id === user.id
                    ? i18next.t('noti_invite_me')
                    : i18next.t('noti_invite_user', {
                          user: user.display_name,
                      });
            const notificationPayload = {
                message,
                messageType: 'noti_invited',
                variant: 'info',
                roomId: conversation_id,
            };

            // dispatch(pushNotification({ notification: notificationPayload }));
        } catch (err) {
            const error = err as AxiosError;
            let message = 'Something went wrong';
            if (!error.response) {
                if (err instanceof Error) {
                    message = err.message;
                }
            } else {
                message = error.response.data;
            }
            return rejectWithValue({ message });
        }
    },
    {
        condition: (eventPayload, { getState }) => {
            const { Account } = getState();
            const { assign_from } = eventPayload;
            if (assign_from === Account.id) {
                return false;
            }
        },
    },
);

/**
 * Conversation online status update event
 *
 * @param {Object} eventPayload - Payload Object from socket
 */
export const conversationOnlineStatusUpdatedEventThunk = createAsyncThunk<
    ConversationNameUpdatedEventThunkPayload,
    ImbraceSocket.ContactStatus & { is_presence: boolean },
    AsyncThunkOptions
>('TeamConversation/conversationOnlineStatusUpdatedEvent', async (eventPayload, { rejectWithValue, getState }) => {
    try {
        const state = getState();
        const { TeamConversation, BusinessUnit } = state;
        const businessUnitList = BusinessUnit.businessUnitList;
        const { viewFilter, viewFilterTeamId, channelFilter, teamConversationSearchQuery, teamConversation } = TeamConversation;
        const { conversation_id, is_presence, timestamp } = eventPayload;

        const payload: ConversationJoinedEventThunkPayload = {};

        const isExist = queryClient
            .getQueryData<{
                pageParams?: number[];
                pages?: TeamConversationsQueryData[];
            }>([
                'teamConversations',
                {
                    businessUnitId: businessUnitList[0].id,
                    search: teamConversationSearchQuery,
                    limit: 50,
                    view: viewFilter,
                    channelTypes: channelFilter,
                    teamId: viewFilterTeamId,
                },
            ])
            ?.pages?.flatMap((d) => d.data)
            .some((conv) => conv.conversation_id === conversation_id);

        if (isExist) {
            queryClient.setQueryData<
                {
                    pageParams?: number[];
                    pages?: TeamConversationsQueryData[];
                },
                TeamConversationsQueryParams
            >(
                [
                    'teamConversations',
                    {
                        businessUnitId: businessUnitList[0].id,
                        search: teamConversationSearchQuery,
                        limit: 50,
                        view: viewFilter,
                        channelTypes: channelFilter,
                        teamId: viewFilterTeamId,
                    },
                ],
                (prev) => {
                    const allRows = prev?.pages?.flatMap((d) => d.data) || [];

                    const newRows = allRows.map((teamConv) => {
                        if (teamConv.conversation_id === conversation_id) {
                            return {
                                ...teamConv,
                                is_presence,
                                contact: {
                                    ...teamConv.contact,
                                    last_seen: timestamp,
                                },
                            };
                        }
                        return teamConv;
                    });
                    const pageDataChunk = chunk(newRows, 50);
                    return {
                        ...prev,
                        pages: prev?.pages?.map((page, index) => ({
                            ...page,
                            data: pageDataChunk[index],
                        })),
                    };
                },
            );
        }
        if (teamConversation?.conversation_id === conversation_id) {
            payload.teamConversation = {
                ...teamConversation,
                is_presence,
                contact: {
                    ...teamConversation.contact,
                    last_seen: timestamp,
                },
            };
        }

        return payload;
    } catch (err) {
        const error = err as AxiosError;
        let message = 'Something went wrong';
        if (!error.response) {
            if (err instanceof Error) {
                message = err.message;
            }
        } else {
            message = error.response.data;
        }
        return rejectWithValue({ message });
    }
});

/**
 * Conversation contact update event
 *
 * @param {Object} eventPayload - Payload Object from socket
 */
export const conversationContactUpdatedEventThunk = createAsyncThunk<
    ConversationNameUpdatedEventThunkPayload,
    API.Contact,
    AsyncThunkOptions
>('TeamConversation/conversationContactUpdatedEvent', async (eventPayload, { rejectWithValue, getState }) => {
    try {
        const state = getState();
        const { TeamConversation, BusinessUnit } = state;
        const businessUnitList = BusinessUnit.businessUnitList;
        const { viewFilter, viewFilterTeamId, channelFilter, teamConversationSearchQuery, teamConversation } = TeamConversation;
        const { id } = eventPayload;

        const payload: ConversationJoinedEventThunkPayload = {};

        const isExist = queryClient
            .getQueryData<{
                pageParams?: number[];
                pages?: TeamConversationsQueryData[];
            }>([
                'teamConversations',
                {
                    businessUnitId: businessUnitList[0].id,
                    search: teamConversationSearchQuery,
                    limit: 50,
                    view: viewFilter,
                    channelTypes: channelFilter,
                    teamId: viewFilterTeamId,
                },
            ])
            ?.pages?.flatMap((d) => d.data)
            .some((conv) => conv.contact_id === id);

        if (isExist) {
            queryClient.setQueryData<
                {
                    pageParams?: number[];
                    pages?: TeamConversationsQueryData[];
                },
                TeamConversationsQueryParams
            >(
                [
                    'teamConversations',
                    {
                        businessUnitId: businessUnitList[0].id,
                        search: teamConversationSearchQuery,
                        limit: 50,
                        view: viewFilter,
                        channelTypes: channelFilter,
                        teamId: viewFilterTeamId,
                    },
                ],
                (prev) => {
                    const allRows = prev?.pages?.flatMap((d) => d.data) || [];

                    const newRows = allRows.map((teamConv) => {
                        if (teamConv.contact_id === id) {
                            return {
                                ...teamConv,
                                contact: {
                                    ...teamConv,
                                    ...eventPayload,
                                },
                            };
                        }
                        return teamConv;
                    });
                    const pageDataChunk = chunk(newRows, 50);
                    return {
                        ...prev,
                        pages: prev?.pages?.map((page, index) => ({
                            ...page,
                            data: pageDataChunk[index],
                        })),
                    };
                },
            );
        }
        if (teamConversation?.contact_id === id) {
            payload.teamConversation = {
                ...teamConversation,
                contact: {
                    ...teamConversation,
                    ...eventPayload,
                },
            };
        }

        return payload;
    } catch (err) {
        const error = err as AxiosError;
        let message = 'Something went wrong';
        if (!error.response) {
            if (err instanceof Error) {
                message = err.message;
            }
        } else {
            message = error.response.data;
        }
        return rejectWithValue({ message });
    }
});

export const teamConversationSlice = createSlice({
    name: 'TeamConversation',
    initialState,
    reducers: {
        selectConversation: (state, { payload }: PayloadAction<string>) => {
            state.teamConversation = {
                ...state.teamConversation,
                id: payload,
            } as API.TeamConversation;
        },
        updateChannelFilter: (state, { payload: channel }: PayloadAction<API.ChannelType>) => {
            let channelFilter;

            if (state.channelFilter.includes(channel)) {
                channelFilter = [...state.channelFilter.filter((el) => el !== channel)];
            } else {
                channelFilter = [...state.channelFilter, channel];
            }

            state.channelFilter = channelFilter;
        },
        updateViewFilter: (state, { payload }: PayloadAction<{ view: Views; teamId?: string }>) => {
            const { view, teamId } = payload;

            state.viewFilter = view;
            state.viewFilterTeamId = teamId;
        },
        selectAllChannel: (state) => {
            state.channelFilter = ['web', 'whatsapp', 'facebook', 'instagram', 'email', 'wechat', 'line'];
        },
        resetChannelFilter: (state) => {
            state.channelFilter = [];
        },
        clearTeamConversation: (state) => {
            state.teamConversation = undefined;
        },
        updateTeamConversationSearch: (state, { payload }: PayloadAction<{ search: string }>) => {
            state.teamConversationSearchQuery = payload.search;
        },
    },
    extraReducers: (builder) => {
        // TeamConversation/fetchViewsCount
        builder
            .addCase(fetchViewsCountThunk.pending, (state) => {
                if (state.getViewsCountStatus !== FETCH_IN_PROGRESS) {
                    state.getViewsCountStatus = FETCH_IN_PROGRESS;
                }
            })
            .addCase(fetchViewsCountThunk.fulfilled, (state, action) => {
                if (state.getViewsCountStatus === FETCH_IN_PROGRESS) {
                    state.getViewsCountStatus = FETCH_SUCCEEDED;
                }
            })
            .addCase(fetchViewsCountThunk.rejected, (state, action) => {
                state.getViewsCountStatus = FETCH_FAILED;
                if (action.payload) {
                    state.errors = { ...state.errors, viewCountError: action.payload.message };
                } else {
                    state.errors = { ...state.errors, viewCountError: action.error };
                }
            });

        // TeamConversation/fetchTeamConversationById
        builder
            .addCase(fetchTeamConversationByIdThunk.pending, (state, action) => {
                const { requestId } = action.meta;

                state.getTeamConversationByIdStatus = FETCH_IN_PROGRESS;
                state.fetchConvByIdCurrentRequestId = requestId;
            })
            .addCase(fetchTeamConversationByIdThunk.fulfilled, (state, action) => {
                const { requestId } = action.meta;
                if (state.getTeamConversationByIdStatus === FETCH_IN_PROGRESS && state.fetchConvByIdCurrentRequestId === requestId) {
                    state.getTeamConversationByIdStatus = FETCH_SUCCEEDED;
                    state.teamConversation = { ...state.teamConversation, ...action.payload.teamConversation };
                    state.fetchConvByIdCurrentRequestId = undefined;
                }
            })
            .addCase(fetchTeamConversationByIdThunk.rejected, (state, action) => {
                state.getTeamConversationByIdStatus = FETCH_FAILED;
                state.fetchConvByIdCurrentRequestId = undefined;
                if (action.payload) {
                    state.errors = { ...state.errors, teamConversationByIdError: action.payload.message };
                } else {
                    state.errors = { ...state.errors, teamConversationByIdError: action.error };
                }
            });

        // TeamConversation/updateStatus
        builder
            .addCase(updateStatusThunk.pending, (state) => {
                if (state.postTeamConversationUpdateStatus !== FETCH_IN_PROGRESS) {
                    state.postTeamConversationUpdateStatus = FETCH_IN_PROGRESS;
                }
            })
            .addCase(updateStatusThunk.fulfilled, (state, action) => {
                if (state.postTeamConversationUpdateStatus === FETCH_IN_PROGRESS) {
                    state.postTeamConversationUpdateStatus = FETCH_SUCCEEDED;
                    state.teamConversation = action.payload.teamConversation;
                }
            })
            .addCase(updateStatusThunk.rejected, (state, action) => {
                state.postTeamConversationUpdateStatus = FETCH_FAILED;
                if (action.payload) {
                    state.errors = { ...state.errors, updateStatusError: action.payload.message };
                } else {
                    state.errors = { ...state.errors, updateStatusError: action.error };
                }
            });

        // TeamConversation/join
        builder
            .addCase(joinTeamConversationThunk.pending, (state) => {
                if (state.joinTeamConversationStatus !== FETCH_IN_PROGRESS) {
                    state.joinTeamConversationStatus = FETCH_IN_PROGRESS;
                }
            })
            .addCase(joinTeamConversationThunk.fulfilled, (state, action) => {
                if (state.joinTeamConversationStatus === FETCH_IN_PROGRESS) {
                    state.joinTeamConversationStatus = FETCH_SUCCEEDED;
                    state.teamConversation = { ...state.teamConversation, ...action.payload.teamConversation };
                    // state.teamConversations = action.payload.teamConversations;
                }
            })
            .addCase(joinTeamConversationThunk.rejected, (state, action) => {
                state.joinTeamConversationStatus = FETCH_FAILED;
                if (action.payload) {
                    state.errors = { ...state.errors, joinError: action.payload.message };
                } else {
                    state.errors = { ...state.errors, joinError: action.error };
                }
            });

        // TeamConversation/leave
        builder
            .addCase(leaveTeamConversationThunk.pending, (state) => {
                if (state.leaveTeamConversationStatus !== FETCH_IN_PROGRESS) {
                    state.leaveTeamConversationStatus = FETCH_IN_PROGRESS;
                }
            })
            .addCase(leaveTeamConversationThunk.fulfilled, (state, action) => {
                if (state.leaveTeamConversationStatus === FETCH_IN_PROGRESS) {
                    state.leaveTeamConversationStatus = FETCH_SUCCEEDED;
                    state.teamConversation = {
                        ...state.teamConversation,
                        ...action.payload.teamConversation,
                    };
                    // state.teamConversations = action.payload.teamConversations;
                }
            })
            .addCase(leaveTeamConversationThunk.rejected, (state, action) => {
                state.leaveTeamConversationStatus = FETCH_FAILED;
                if (action.payload) {
                    state.errors = { ...state.errors, leaveError: action.payload.message };
                } else {
                    state.errors = { ...state.errors, leaveError: action.error };
                }
            });

        // TeamConversation/statusUpdatedEvent
        builder
            .addCase(statusUpdatedEventThunk.pending, (state) => {
                if (state.statusUpdatedEventStatus !== FETCH_IN_PROGRESS) {
                    state.statusUpdatedEventStatus = FETCH_IN_PROGRESS;
                }
            })
            .addCase(statusUpdatedEventThunk.fulfilled, (state, action) => {
                if (state.statusUpdatedEventStatus === FETCH_IN_PROGRESS) {
                    state.statusUpdatedEventStatus = FETCH_SUCCEEDED;
                    // state.teamConversations = action.payload.teamConversations;
                    // state.hasMoreTeamConversations = action.payload.hasMoreTeamConversations ?? state.hasMoreTeamConversations;
                    // state.teamConversationsCount = action.payload.teamConversationsCount ?? state.teamConversationsCount;
                    if (action.payload.teamConversation) {
                        state.teamConversation = action.payload.teamConversation;
                    }
                }
            })
            .addCase(statusUpdatedEventThunk.rejected, (state, action) => {
                state.statusUpdatedEventStatus = FETCH_FAILED;
                if (action.payload) {
                    state.errors = { ...state.errors, statusUpdatedEventError: action.payload.message };
                } else {
                    state.errors = { ...state.errors, statusUpdatedEventError: action.error };
                }
            });

        // TeamConversation/sortConversations
        builder
            .addCase(sortConversationsThunk.fulfilled, (state, action) => {})
            .addCase(sortConversationsThunk.rejected, (state, action) => {
                if (action.payload) {
                    state.errors = { ...state.errors, sortConversationsError: action.payload.message };
                } else {
                    state.errors = { ...state.errors, sortConversationsError: action.error };
                }
            });

        // TeamConversation/conversationCreatedEvent
        builder
            .addCase(conversationCreatedEventThunk.fulfilled, (state, action) => {
                // state.unreadTeamConvs = action.payload.unreadTeamConvs;
                // if (action.payload.teamConversations) {
                //     state.teamConversations = action.payload.teamConversations;
                // }
            })
            .addCase(conversationCreatedEventThunk.rejected, (state, action) => {
                if (action.payload) {
                    state.errors = { ...state.errors, conversationCreatedEvent: action.payload.message };
                } else {
                    state.errors = { ...state.errors, conversationCreatedEvent: action.error };
                }
            });

        // TeamConversation/agentNeededEvent
        builder.addCase(agentNeededConversationThunk.rejected, (state, action) => {
            if (action.payload) {
                state.errors = { ...state.errors, agentNeededEventError: action.payload.message };
            } else {
                state.errors = { ...state.errors, agentNeededEventError: action.error };
            }
        });

        // TeamConversation/conversationJoinRequest
        builder
            .addCase(conversationJoinRequestThunk.pending, (state) => {
                if (state.conversationJoinRequestStatus !== FETCH_IN_PROGRESS) {
                    state.conversationJoinRequestStatus = FETCH_IN_PROGRESS;
                }
            })
            .addCase(conversationJoinRequestThunk.fulfilled, (state) => {
                if (state.conversationJoinRequestStatus === FETCH_IN_PROGRESS) {
                    state.conversationJoinRequestStatus = FETCH_SUCCEEDED;
                }
            })
            .addCase(conversationJoinRequestThunk.rejected, (state, action) => {
                state.conversationJoinRequestStatus = FETCH_FAILED;
                if (action.payload) {
                    state.errors = { ...state.errors, conversationJoinRequestError: action.payload.message };
                } else {
                    state.errors = { ...state.errors, conversationJoinRequestError: action.error };
                }
            });

        // TeamConversation/conversationJoinRequest
        builder
            .addCase(updateConversationNameThunk.pending, (state) => {
                if (state.updateTeamConversationNameStatus !== FETCH_IN_PROGRESS) {
                    state.updateTeamConversationNameStatus = FETCH_IN_PROGRESS;
                }
            })
            .addCase(updateConversationNameThunk.fulfilled, (state) => {
                if (state.updateTeamConversationNameStatus === FETCH_IN_PROGRESS) {
                    state.updateTeamConversationNameStatus = FETCH_SUCCEEDED;
                }
            })
            .addCase(updateConversationNameThunk.rejected, (state, action) => {
                state.updateTeamConversationNameStatus = FETCH_FAILED;
                if (action.payload) {
                    state.errors = { ...state.errors, updateConversationNameError: action.payload.message };
                } else {
                    state.errors = { ...state.errors, updateConversationNameError: action.error };
                }
            });

        // TeamConversation/conversationNameUpdatedEventThunk
        builder
            .addCase(conversationNameUpdatedEventThunk.pending, (state) => {})
            .addCase(conversationNameUpdatedEventThunk.fulfilled, (state, action) => {
                if (action.payload.teamConversation) {
                    state.teamConversation = { ...state.teamConversation, ...action.payload.teamConversation };
                }
            })
            .addCase(conversationNameUpdatedEventThunk.rejected, (state) => {});

        // TeamConversation/conversationJoinedEvent
        builder
            .addCase(conversationJoinedEventThunk.fulfilled, (state, action) => {
                if (action.payload.teamConversation) {
                    state.teamConversation = { ...state.teamConversation, ...action.payload.teamConversation };
                }
                if (action.payload.teamConversations) {
                    state.teamConversations = action.payload.teamConversations;
                }
            })
            .addCase(conversationJoinedEventThunk.rejected, (state, action) => {
                if (action.payload) {
                    state.errors = { ...state.errors, conversationJoinedEventError: action.payload.message };
                } else {
                    state.errors = { ...state.errors, conversationJoinedEventError: action.error };
                }
            });

        // TeamConversation/conversationLeftEvent
        builder
            .addCase(conversationLeftEventThunk.fulfilled, (state, action) => {
                if (action.payload.teamConversation) {
                    state.teamConversation = { ...state.teamConversation, ...action.payload.teamConversation };
                } else {
                    state.teamConversation = undefined;
                }
                if (action.payload.teamConversations) {
                    state.teamConversations = action.payload.teamConversations;
                }
            })
            .addCase(conversationLeftEventThunk.rejected, (state, action) => {
                if (action.payload) {
                    state.errors = { ...state.errors, conversationLeftEventError: action.payload.message };
                } else {
                    state.errors = { ...state.errors, conversationLeftEventError: action.error };
                }
            });

        // TeamConversation/fetchTeamConversationLabelById
        builder
            .addCase(fetchTeamConversationLabelByIdThunk.pending, (state, action) => {
                state.getTeamConversationLabelByIdStatus = FETCH_IN_PROGRESS;
            })
            .addCase(fetchTeamConversationLabelByIdThunk.fulfilled, (state, action) => {
                if (state.getTeamConversationLabelByIdStatus === FETCH_IN_PROGRESS) {
                    state.getTeamConversationLabelByIdStatus = FETCH_SUCCEEDED;
                    state.teamLabels = [...action.payload.items];
                }
            })
            .addCase(fetchTeamConversationLabelByIdThunk.rejected, (state, action) => {
                state.getTeamConversationLabelByIdStatus = FETCH_FAILED;
                if (action.payload) {
                    state.errors = { ...state.errors, teamConversationByIdError: action.payload.message };
                } else {
                    state.errors = { ...state.errors, teamConversationByIdError: action.error };
                }
            });
        // TeamConversation/conversationInvitedEventThunk
        builder
            .addCase(conversationInvitedEventThunk.pending, (state, action) => {})
            .addCase(conversationInvitedEventThunk.fulfilled, (state, action) => {})
            .addCase(conversationInvitedEventThunk.rejected, (state, action) => {
                if (action.payload) {
                    state.errors = { ...state.errors, conversationInvitedEventError: action.payload.message };
                } else {
                    state.errors = { ...state.errors, conversationInvitedEventError: action.error };
                }
            });

        // TeamConversation/conversationOnlineStatusUpdatedEventThunk
        builder
            .addCase(conversationOnlineStatusUpdatedEventThunk.pending, (state) => {})
            .addCase(conversationOnlineStatusUpdatedEventThunk.fulfilled, (state, action) => {
                if (action.payload.teamConversation) {
                    state.teamConversation = { ...state.teamConversation, ...action.payload.teamConversation };
                }
            })
            .addCase(conversationOnlineStatusUpdatedEventThunk.rejected, (state) => {});

        // TeamConversation/conversationContactUpdatedEventThunk
        builder
            .addCase(conversationContactUpdatedEventThunk.pending, (state) => {})
            .addCase(conversationContactUpdatedEventThunk.fulfilled, (state, action) => {
                if (action.payload.teamConversation) {
                    state.teamConversation = { ...state.teamConversation, ...action.payload.teamConversation };
                }
            })
            .addCase(conversationContactUpdatedEventThunk.rejected, (state) => {});
    },
});

export const {
    selectConversation,
    updateChannelFilter,
    updateViewFilter,
    selectAllChannel,
    resetChannelFilter,
    clearTeamConversation,
    updateTeamConversationSearch,
} = teamConversationSlice.actions;

export default teamConversationSlice.reducer;
