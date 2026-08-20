import type { PayloadAction } from '@reduxjs/toolkit';
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { AxiosError } from 'axios';

import {
    getConversationMessagesByTeamId,
    postConversationFileUpload,
    postConversationMessage,
    postConversationMessageComment,
    postConversationVideoCall,
    putConversationMessageComment,
} from '@/services/api/teamConversation';
import { ImbraceFileUpload } from '@/services/axios';

import { FETCH_FAILED, FETCH_IN_PROGRESS, FETCH_SUCCEEDED, IDLE } from '../../constants/app';
import apiFetch from '../../services/axios/handler';
import { fetchAllConversationContactCommentThunk, fetchConversationContactCommentThunk } from './contact';
import type { AsyncThunkOptions } from './index.types';
import type {
    FetchMessageByCommentPayload,
    FetchMessageParams,
    FetchMessagePayload,
    InitialState,
    PostCommentParams,
    PostMessageParams,
    ReduxMessage,
} from './message.types';

const initialState: InitialState = {
    loadingStatus: IDLE,
    messages: [],
    limit: 50,
    skip: 0,
    hasMore: false,
    count: 0,
    total: 0,
    postMessageStatus: IDLE,
    fileUploadStatus: IDLE,
    postCommentStatus: IDLE,
    fetchMessageByCommentStatus: IDLE,
    showLatestUnreadMsg: false,
    errors: undefined,
};

export const fetchMessagesThunk = createAsyncThunk<FetchMessagePayload, FetchMessageParams, AsyncThunkOptions>(
    'Message/fetchMessages',
    async (params, { getState, rejectWithValue, dispatch }) => {
        try {
            const { teamConvId, limit, skip } = params;
            const state = getState();

            const api = getConversationMessagesByTeamId.api(teamConvId, limit, skip);

            const response = await apiFetch<
                API.PaginatedResponse<
                    API.ConversationMessage[],
                    {
                        users: {
                            [key: string]: API.User;
                        };
                    }
                >
            >(api, getConversationMessagesByTeamId.method);

            const { nested } = response.data;

            const messages = response.data.data
                .map((message) => ({
                    ...message,
                    contact: nested?.users?.[message.from] || state.TeamConversation.teamConversation?.contact,
                }))
                .reverse();

            let conversationMessages;

            if (skip > 0) {
                conversationMessages = [...messages, ...state.Message.messages];
            } else {
                conversationMessages = messages;
            }

            const payload: FetchMessagePayload = {
                messages: conversationMessages,
                hasMore: response.data.has_more,
                count: response.data.count,
                total: response.data.total,
                limit: limit,
                skip: skip,
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

export const postMessageThunk = createAsyncThunk<void, PostMessageParams, AsyncThunkOptions>(
    'Message/postMessage',
    async (params, { rejectWithValue }) => {
        try {
            const { teamConvId, type, text, filename, templateId } = params;

            const requestBody: {
                team_conversation_id: string;
                type: API.MessageType;
                text?: string;
                url?: string;
                template_id?: string;
                variables?: string[];
                caption?: string;
            } = {
                team_conversation_id: teamConvId,
                type: type,
            };

            switch (type) {
                case 'message_template':
                    requestBody.template_id = templateId;
                    requestBody.text = text as string;
                    break;
                case 'text':
                    requestBody.text = text as string;
                    break;
                case 'image':
                    requestBody.url = text as string;
                    break;
                case 'pdf':
                    requestBody.url = text as string;
                    requestBody.caption = filename;
                    break;
                case 'whatsapp.template':
                    if (typeof text === 'object' && 'id' in text) {
                        requestBody.template_id = text.id;
                        requestBody.variables = text.variables;
                    }
                    break;
                default:
                    break;
            }

            await apiFetch(postConversationMessage.api, postConversationMessage.method, requestBody);
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

export const postVideoCallThunk = createAsyncThunk<void, string, AsyncThunkOptions>(
    'Message/postVideoCall',
    async (teamConvId, { rejectWithValue }) => {
        try {
            const requestBody = {
                team_conversation_id: teamConvId,
            };

            await apiFetch(postConversationVideoCall.api, postConversationVideoCall.method, requestBody);
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

export const fileUploadThunk = createAsyncThunk<API.FileUpload, FormData, AsyncThunkOptions>(
    'Message/fileUpload',
    async (formData, { rejectWithValue }) => {
        try {
            const response = await apiFetch<API.FileUpload>(
                postConversationFileUpload.api,
                postConversationFileUpload.method,
                formData,
                ImbraceFileUpload,
            );

            return response.data;
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
export const appendMessageThunk = createAsyncThunk<
    {
        messages: ReduxMessage[];
        showLatestUnreadMsg: boolean;
    },
    ImbraceSocket.MessageCreated,
    AsyncThunkOptions
>(
    'Message/appendMessage',
    async (eventPayload, { getState, rejectWithValue, dispatch }) => {
        try {
            const state = getState();
            const accountId = state.Account.id;

            const { conversation_id, from } = eventPayload;

            const messages =
                state.TeamConversation.teamConversation?.conversation_id === conversation_id
                    ? [
                          ...state.Message.messages,
                          {
                              ...eventPayload,
                              contact: eventPayload.from_contact || eventPayload.contact,
                          },
                      ]
                    : state.Message.messages;

            const payload = {
                messages,
                showLatestUnreadMsg: accountId !== from,
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
    {
        condition: (eventPayload, { getState }) => {
            const { TeamConversation } = getState();

            return TeamConversation.teamConversation?.conversation_id === eventPayload.conversation_id;
        },
    },
);
export const fetchMessagesCommentThunk = createAsyncThunk<FetchMessageByCommentPayload, string, AsyncThunkOptions>(
    'Message/fetchMessagesComment',
    async (teamConvId, { getState, rejectWithValue, dispatch }) => {
        try {
            const state = getState();
            const skip = state.Message.skip;
            const count = skip === 0 ? 1 : Math.ceil(skip / 100);

            let conversationMessages;
            for (let i = 0; i < count; i++) {
                const tempLimit = 100;
                const tempSkip = i * tempLimit;
                const api = getConversationMessagesByTeamId.api(teamConvId, tempLimit, tempSkip);
                const response = await apiFetch<
                    API.PaginatedResponse<
                        API.ConversationMessage[],
                        {
                            users: {
                                [key: string]: API.User;
                            };
                        }
                    >
                >(api, getConversationMessagesByTeamId.method);
                const { nested } = response.data;

                const messages = response.data.data
                    .map((message) => ({
                        ...message,
                        contact: nested?.users?.[message.from] || state.TeamConversation.teamConversation?.contact,
                    }))
                    .reverse();

                if (conversationMessages) {
                    conversationMessages = [...conversationMessages, ...messages];
                } else {
                    conversationMessages = messages;
                }
            }
            const payload: FetchMessageByCommentPayload = {
                messages: conversationMessages,
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
export const postCommentThunk = createAsyncThunk<void, PostCommentParams, AsyncThunkOptions>(
    'Message/postComment',
    async (params, { getState, rejectWithValue, dispatch }) => {
        try {
            const state = getState();
            const { content, labels, convId, messageId, commentId, teamConvId, userId } = params;
            let api = '';
            if (commentId) {
                api = putConversationMessageComment.api(convId, commentId);
            } else {
                api = postConversationMessageComment.api(convId, messageId);
            }
            const requestBody: {
                content: string;
                labels: string[];
            } = {
                content: content,
                labels: labels,
            };
            await apiFetch(api, commentId ? putConversationMessageComment.method : postConversationMessageComment.method, requestBody);
            if (teamConvId) {
                dispatch(fetchMessagesCommentThunk(teamConvId));
            }
            if (userId) {
                dispatch(
                    fetchConversationContactCommentThunk({
                        channelTypes: state.Contact.commentChannelFilter,
                        contactId: userId,
                    }),
                );
                dispatch(
                    fetchAllConversationContactCommentThunk({
                        contactId: userId,
                    }),
                );
            }
            dispatch(editingComments({ messageId: undefined }));
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
export const messageSlice = createSlice({
    name: 'Message',
    initialState,
    reducers: {
        editingComments: (state, { payload }: PayloadAction<{ messageId?: string }>) => {
            state.editingComment = payload.messageId;
        },
        resetEditingComments: (state) => {
            state.editingComment = undefined;
        },
        clearShowLatestUnreadMsg: (state) => {
            state.showLatestUnreadMsg = false;
        },
        clearMessage: (state) => {
            return {
                loadingStatus: IDLE,
                messages: [],
                limit: 50,
                skip: 0,
                hasMore: false,
                count: 0,
                total: 0,
                postMessageStatus: IDLE,
                fileUploadStatus: IDLE,
                postCommentStatus: IDLE,
                fetchMessageByCommentStatus: IDLE,
                showLatestUnreadMsg: false,
                errors: undefined,
            };
        },
    },
    extraReducers: (builder) => {
        // Message/fetchMessages
        builder
            .addCase(fetchMessagesThunk.pending, (state, action) => {
                if (state.loadingStatus !== FETCH_IN_PROGRESS) {
                    state.loadingStatus = FETCH_IN_PROGRESS;
                    state.skip = action.meta.arg.skip;
                }
            })
            .addCase(fetchMessagesThunk.fulfilled, (state, action) => {
                if (state.loadingStatus === FETCH_IN_PROGRESS) {
                    return {
                        ...state,
                        loadingStatus: FETCH_SUCCEEDED,
                        ...action.payload,
                    };
                }
            })
            .addCase(fetchMessagesThunk.rejected, (state, action) => {
                state.loadingStatus = FETCH_FAILED;
                if (action.payload) {
                    state.errors = { ...state.errors, fetchMessagesError: action.payload.message };
                } else {
                    state.errors = { ...state.errors, fetchMessagesError: action.error };
                }
            });

        // Message/postMessage
        builder
            .addCase(postMessageThunk.pending, (state) => {
                if (state.postMessageStatus !== FETCH_IN_PROGRESS) {
                    state.postMessageStatus = FETCH_IN_PROGRESS;
                }
            })
            .addCase(postMessageThunk.fulfilled, (state, action) => {
                if (state.postMessageStatus === FETCH_IN_PROGRESS) {
                    state.postMessageStatus = FETCH_SUCCEEDED;
                }
            })
            .addCase(postMessageThunk.rejected, (state, action) => {
                state.postMessageStatus = FETCH_FAILED;
                if (action.payload) {
                    state.errors = { ...state.errors, postMessageError: action.payload.message };
                } else {
                    state.errors = { ...state.errors, postMessageError: action.error };
                }
            });

        // Message/postVideoCall
        builder
            .addCase(postVideoCallThunk.pending, (state) => {
                if (state.postMessageStatus !== FETCH_IN_PROGRESS) {
                    state.postMessageStatus = FETCH_IN_PROGRESS;
                }
            })
            .addCase(postVideoCallThunk.fulfilled, (state, action) => {
                if (state.postMessageStatus === FETCH_IN_PROGRESS) {
                    state.postMessageStatus = FETCH_SUCCEEDED;
                }
            })
            .addCase(postVideoCallThunk.rejected, (state, action) => {
                state.postMessageStatus = FETCH_FAILED;
                if (action.payload) {
                    state.errors = { ...state.errors, postMessageError: action.payload.message };
                } else {
                    state.errors = { ...state.errors, postMessageError: action.error };
                }
            });

        // Message/appendMessage
        builder
            .addCase(appendMessageThunk.fulfilled, (state, action) => {
                state.messages = action.payload.messages;
                state.showLatestUnreadMsg = action.payload.showLatestUnreadMsg;
            })
            .addCase(appendMessageThunk.rejected, (state, action) => {
                if (action.payload) {
                    state.errors = { ...state.errors, appendMessageError: action.payload.message };
                } else {
                    state.errors = { ...state.errors, appendMessageError: action.error };
                }
            });

        // Message/fileUpload
        builder.addCase(fileUploadThunk.rejected, (state, action) => {
            if (action.payload) {
                state.errors = { ...state.errors, fileUploadError: action.payload.message };
            } else {
                state.errors = { ...state.errors, fileUploadError: action.error };
            }
        });

        //'Message/postComment',
        builder
            .addCase(postCommentThunk.pending, (state) => {
                if (state.postCommentStatus !== FETCH_IN_PROGRESS) {
                    state.postCommentStatus = FETCH_IN_PROGRESS;
                }
            })
            .addCase(postCommentThunk.fulfilled, (state, action) => {
                if (state.postCommentStatus === FETCH_IN_PROGRESS) {
                    state.postCommentStatus = FETCH_SUCCEEDED;
                }
            })
            .addCase(postCommentThunk.rejected, (state, action) => {
                state.postCommentStatus = FETCH_FAILED;
                if (action.payload) {
                    state.errors = { ...state.errors, postMessageError: action.payload.message };
                } else {
                    state.errors = { ...state.errors, postMessageError: action.error };
                }
            });
        //'Message/fetchMessageByComment',
        builder
            .addCase(fetchMessagesCommentThunk.pending, (state) => {
                if (state.fetchMessageByCommentStatus !== FETCH_IN_PROGRESS) {
                    state.fetchMessageByCommentStatus = FETCH_IN_PROGRESS;
                }
            })
            .addCase(fetchMessagesCommentThunk.fulfilled, (state, action) => {
                if (state.fetchMessageByCommentStatus === FETCH_IN_PROGRESS) {
                    state.fetchMessageByCommentStatus = FETCH_SUCCEEDED;
                    if (action.payload.messages) {
                        state.messages = action.payload.messages;
                    }
                }
            })
            .addCase(fetchMessagesCommentThunk.rejected, (state, action) => {
                state.fetchMessageByCommentStatus = FETCH_FAILED;
                if (action.payload) {
                    state.errors = { ...state.errors, fetchMessagesError: action.payload.message };
                } else {
                    state.errors = { ...state.errors, fetchMessagesError: action.error };
                }
            });
    },
});

export const { editingComments, resetEditingComments, clearShowLatestUnreadMsg, clearMessage } = messageSlice.actions;
export default messageSlice.reducer;
