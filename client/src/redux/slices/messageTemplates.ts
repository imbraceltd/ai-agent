import type { PayloadAction } from '@reduxjs/toolkit';
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { AxiosError } from 'axios';

import { getMessageTemplateLists, getSearchMessageTemplateLists } from '@/services/api/messageTemplates';

import { FETCH_FAILED, FETCH_IN_PROGRESS, FETCH_SUCCEEDED, IDLE } from '../../constants/app';
import apiFetch from '../../services/axios/handler';
import type { AsyncThunkOptions } from './index.types';
import type { FetchListParams, FetchListPayload, InitialState } from './messageTemplates.types';

const initialState: InitialState = {
    loadingStatus: IDLE,
    list: [],
    total: 0,
    count: 0,
    limit: 10,
    skip: 0,
    hasMore: true,
};

export const fetchMessageTemplates = createAsyncThunk<FetchListPayload, FetchListParams, AsyncThunkOptions>(
    'MessageTemplates/fetchList',
    async ({ skip = 0, limit = 100, field, search, paginated }, { getState, rejectWithValue }) => {
        try {
            const state = getState();
            const businessUnitId = state.BusinessUnit.businessUnitList[0].id;
            let response;
            if (search) {
                const api = getSearchMessageTemplateLists.api({
                    businessId: businessUnitId,
                    field,
                    search,
                    skip,
                    limit,
                });
                response = await apiFetch<API.PaginatedResponse<API.MessageTemplate[]>>(api, getSearchMessageTemplateLists.method);
            } else {
                const api = getMessageTemplateLists.api({
                    businessId: businessUnitId,
                    skip,
                    limit,
                });
                response = await apiFetch<API.PaginatedResponse<API.MessageTemplate[]>>(api, getMessageTemplateLists.method);
            }

            let templatesList;
            if (paginated) {
                templatesList = response.data.data;
            } else if (skip > 0) {
                templatesList = [...state.MessageTemplates.list, ...response.data.data];
            } else {
                templatesList = response.data.data;
            }

            const payload: FetchListPayload = {
                list: templatesList,
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

export const messageTemplatesSlice = createSlice({
    name: 'MessageTemplates',
    initialState,
    reducers: {
        selectMessageTemplate: (state, { payload }: PayloadAction<API.MessageTemplate>) => {
            state.selectedMessage = payload.text;
            state.templateDetail = payload;
        },
        resetMessageTemplate: (state) => {
            state.selectedMessage = undefined;
            state.templateDetail = undefined;
        },
        insertMessageTemplate: (state, { payload }: PayloadAction<API.MessageTemplate>) => {
            const hasVariable: boolean = state.selectedMessage?.match(/{{\d+}}/i) === null ? false : true;
            state.selectedMessage =
                state.selectedMessage && !hasVariable
                    ? state.selectedMessage.slice(0, state.cursor) + payload.text + state.selectedMessage.slice(state.cursor)
                    : payload.text;
            state.templateDetail = payload;
        },
        onChangeWithMessageTemplate: (state, { payload }) => {
            state.selectedMessage = payload;
        },
        setMessageCursorPosition: (state, { payload }) => {
            state.cursor = payload;
        },
    },
    extraReducers: (builder) => {
        builder.addCase(fetchMessageTemplates.pending, (state) => {
            if (state.loadingStatus === IDLE || state.loadingStatus === FETCH_SUCCEEDED) {
                state.loadingStatus = FETCH_IN_PROGRESS;
            }
        });
        builder.addCase(fetchMessageTemplates.fulfilled, (state, action) => {
            if (state.loadingStatus === FETCH_IN_PROGRESS) {
                return {
                    ...state,
                    loadingStatus: FETCH_SUCCEEDED,
                    ...action.payload,
                };
            }
        });
        builder.addCase(fetchMessageTemplates.rejected, (state, action) => {
            state.loadingStatus = FETCH_FAILED;
            if (action.payload) {
                state.errors = { ...state.errors, fetchList: action.payload.message };
            }
        });
    },
});

export const { selectMessageTemplate, resetMessageTemplate, insertMessageTemplate, setMessageCursorPosition, onChangeWithMessageTemplate } =
    messageTemplatesSlice.actions;

export default messageTemplatesSlice.reducer;
