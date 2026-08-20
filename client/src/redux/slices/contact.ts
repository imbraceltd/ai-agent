import type { PayloadAction } from '@reduxjs/toolkit';
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { AxiosError } from 'axios';

import { FETCH_FAILED, FETCH_IN_PROGRESS, FETCH_SUCCEEDED, IDLE } from '@/constants/app';
import { getContactByIdV2, getContactCommentById, getContactList, getContactSearch } from '@/services/api/contact';
import apiFetch from '@/services/axios/handler';

import type {
    FetchAllContactCommentParams,
    FetchAllContactCommentPayload,
    FetchContactCommentParams,
    FetchContactCommentPayload,
    FetchContactPayload,
    FetchListParams,
    FetchListPayload,
    InitialState,
} from './contact.types';
import type { AsyncThunkOptions } from './index.types';

const initialState: InitialState = {
    loadingStatus: IDLE,
    list: [],
    total: 0,
    count: 0,
    limit: 10,
    skip: 0,
    hasMore: true,
    getContactByIdStatus: IDLE,
    contact: undefined,
    getConversationContactCommentByIdStatus: IDLE,
    contactCommentTotalCount: 0,
    getAllConversationContactCommentByIdStatus: IDLE,
    contactComment: undefined,
    contactCommentTotal: 0,
    contactCommentCount: 0,
    contactCommentLimit: 10,
    contactCommentSkip: 0,
    contactCommentHasMore: true,
    commentChannelFilter: ['web', 'whatsapp', 'facebook', 'email', 'wechat', 'line', 'instagram'],
};
export const fetchConversationContactCommentThunk = createAsyncThunk<
    FetchContactCommentPayload,
    FetchContactCommentParams,
    AsyncThunkOptions
>('Contact/fetchConversationContactComment', async (params, { getState, rejectWithValue }) => {
    try {
        const { limit = 50, skip = 0, channelTypes, contactId } = params;

        const state = getState();
        const channels = channelTypes || state.Contact.commentChannelFilter;
        const channels_type = channels.join('&channel_types=');
        const api = getContactCommentById.api(contactId, channels_type, skip, limit);
        const response = await apiFetch<API.TeamConversationCommentList>(api, getContactList.method);
        let contactComment = response.data.items;

        if (skip > 0 && state.Contact.contactComment) {
            contactComment = [...state.Contact.contactComment, ...response.data.items];
        }
        const payload = {
            items: contactComment,
            hasMore: response.data.has_more,
            total: response.data.total,
            count: response.data.count,
            skip: skip,
            limit: limit,
        };

        return payload;
    } catch (err) {
        const error = err as AxiosError<API.ErrorResponse>;
        let message = 'Something went wrong';

        if (!error.response) {
            if (err instanceof Error) {
                message = err.message;
            }
        } else {
            message = error.response.data.message;
        }
        return rejectWithValue({ message });
    }
});
export const fetchAllConversationContactCommentThunk = createAsyncThunk<
    FetchAllContactCommentPayload,
    FetchAllContactCommentParams,
    AsyncThunkOptions
>('Contact/fetchAllConversationContactCommentThunk', async (params, { getState, rejectWithValue }) => {
    try {
        const { limit = 1, skip = 0, contactId } = params;

        const channels = ['web', 'whatsapp', 'facebook', 'email', 'wechat', 'line', 'instagram'];
        const channels_type = channels.join('&channel_types=');
        const api = getContactCommentById.api(contactId, channels_type, skip, limit);
        const response = await apiFetch<API.TeamConversationCommentList>(api, getContactList.method);

        const payload = {
            count: response.data.count,
        };

        return payload;
    } catch (err) {
        const error = err as AxiosError<API.ErrorResponse>;
        let message = 'Something went wrong';

        if (!error.response) {
            if (err instanceof Error) {
                message = err.message;
            }
        } else {
            message = error.response.data.message;
        }
        return rejectWithValue({ message });
    }
});
export const fetchContactByIdThunk = createAsyncThunk<FetchContactPayload, string, AsyncThunkOptions>(
    'Contact/fetchContactById',
    async (contactId, { rejectWithValue }) => {
        try {
            const api = getContactByIdV2.api(contactId);
            const response = await apiFetch<API.Contact>(api, getContactList.method);
            const payload = {
                contact: response.data,
            };

            return payload;
        } catch (err) {
            const error = err as AxiosError<API.ErrorResponse>;
            let message = 'Something went wrong';

            if (!error.response) {
                if (err instanceof Error) {
                    message = err.message;
                }
            } else {
                message = error.response.data.message;
            }
            return rejectWithValue({ message });
        }
    },
);

export const fetchContactListThunk = createAsyncThunk<FetchListPayload, FetchListParams, AsyncThunkOptions>(
    'Contact/fetchList',
    async (params, { rejectWithValue }) => {
        try {
            const { limit = 10, skip = 0, search, sort } = params;
            let api;
            if (search) {
                api = getContactSearch.api({
                    limit,
                    skip,
                    search,
                    sort,
                });
            } else {
                api = getContactList.api({
                    limit,
                    skip,
                    sort,
                });
            }
            const response = await apiFetch<API.PaginatedResponse<API.Contact[]>>(api, getContactList.method);

            const payload = {
                list: response.data.data,
                hasMore: response.data.has_more,
                total: response.data.total,
                count: response.data.count,
                skip: skip,
                limit: limit,
            };

            return payload;
        } catch (err) {
            const error = err as AxiosError<API.ErrorResponse>;
            let message = 'Something went wrong';

            if (!error.response) {
                if (err instanceof Error) {
                    message = err.message;
                }
            } else {
                message = error.response.data.message;
            }
            return rejectWithValue({ message });
        }
    },
);

export const contactSlice = createSlice({
    name: 'Contact',
    initialState,
    reducers: {
        setContact: (state, { payload }: PayloadAction<API.Contact>) => {
            state.contact = payload;
        },
        updateCommentChannelFilter: (state, { payload: channel }: PayloadAction<API.ChannelType>) => {
            let commentChannelFilter;

            if (state.commentChannelFilter.includes(channel)) {
                commentChannelFilter = [...state.commentChannelFilter.filter((el) => el !== channel)];
            } else {
                commentChannelFilter = [...state.commentChannelFilter, channel];
            }

            state.commentChannelFilter = commentChannelFilter;
        },
    },
    extraReducers: (builder) => {
        // Contact/fetchList
        builder
            .addCase(fetchContactListThunk.pending, (state, action) => {
                state.loadingStatus = FETCH_IN_PROGRESS;
            })
            .addCase(fetchContactListThunk.fulfilled, (state, action) => {
                if (state.loadingStatus === FETCH_IN_PROGRESS) {
                    return {
                        ...state,
                        loadingStatus: FETCH_SUCCEEDED,
                        ...action.payload,
                    };
                }
            })
            .addCase(fetchContactListThunk.rejected, (state, action) => {
                state.loadingStatus = FETCH_FAILED;
                if (action.payload) {
                    state.errors = {
                        ...state.errors,
                        fetchList: action.payload.message,
                    };
                }
            });
        //Contact/fetchContactById
        builder
            .addCase(fetchContactByIdThunk.pending, (state, action) => {
                state.getContactByIdStatus = FETCH_IN_PROGRESS;
            })
            .addCase(fetchContactByIdThunk.fulfilled, (state, action) => {
                return {
                    ...state,
                    getContactByIdStatus: FETCH_SUCCEEDED,
                    ...action.payload,
                };
            })
            .addCase(fetchContactByIdThunk.rejected, (state, action) => {
                state.getContactByIdStatus = FETCH_FAILED;
                if (action.payload) {
                    state.errors = {
                        ...state.errors,
                        fetchList: action.payload.message,
                    };
                }
            });
        // Contact/fetchConversationContactComment
        builder
            .addCase(fetchConversationContactCommentThunk.pending, (state, action) => {
                state.getConversationContactCommentByIdStatus = FETCH_IN_PROGRESS;
            })
            .addCase(fetchConversationContactCommentThunk.fulfilled, (state, action) => {
                state.getConversationContactCommentByIdStatus = FETCH_SUCCEEDED;
                state.contactComment = [...action.payload.items];
                state.contactCommentCount = action.payload.count;
                state.contactCommentTotal = action.payload.total;
                state.contactCommentLimit = action.payload.limit;
                state.contactCommentSkip = action.payload.skip;
                state.contactCommentHasMore = action.payload.hasMore;
            })
            .addCase(fetchConversationContactCommentThunk.rejected, (state, action) => {
                state.getConversationContactCommentByIdStatus = FETCH_FAILED;
                if (action.payload) {
                    state.errors = { ...state.errors, fetchList: action.payload.message };
                }
            });
        // Contact/fetchAllConversationContactCommentThunk
        builder
            .addCase(fetchAllConversationContactCommentThunk.pending, (state, action) => {
                state.getAllConversationContactCommentByIdStatus = FETCH_IN_PROGRESS;
            })
            .addCase(fetchAllConversationContactCommentThunk.fulfilled, (state, action) => {
                state.getAllConversationContactCommentByIdStatus = FETCH_SUCCEEDED;
                state.contactCommentTotalCount = action.payload.count;
            })
            .addCase(fetchAllConversationContactCommentThunk.rejected, (state, action) => {
                state.getAllConversationContactCommentByIdStatus = FETCH_FAILED;
                if (action.payload) {
                    state.errors = { ...state.errors, fetchList: action.payload.message };
                }
            });
    },
});

export const { updateCommentChannelFilter, setContact } = contactSlice.actions;

export default contactSlice.reducer;
