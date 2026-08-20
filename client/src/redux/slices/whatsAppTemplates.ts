import type { PayloadAction } from '@reduxjs/toolkit';
import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { AxiosError } from 'axios';

import { FETCH_FAILED, FETCH_IN_PROGRESS, FETCH_SUCCEEDED, IDLE } from '../../constants/app';
import * as whatsAppMessageTemplatesApi from '../../services/api/whatsAppMessageTemplates';
import apiFetch from '../../services/axios/handler';
import type { AsyncThunkOptions, PaginationParams } from './index.types';
import type { FetchListPayload, InitialState } from './whatsAppTemplates.types';

const initialState: InitialState = {
    loadingStatus: IDLE,
    templatesList: [],
    selectedTemplateDetail: undefined,
    selectedMessage: null,
    total: 0,
    count: 0,
    limit: 100,
    skip: 0,
    hasMore: true,
    error: undefined,
};

export const fetchWhatsAppTemplates = createAsyncThunk<FetchListPayload, PaginationParams, AsyncThunkOptions>(
    'WhatsAppTemplates/fetchWhatsAppTemplates',
    async ({ skip = 0, limit = 100 }, { getState, rejectWithValue }) => {
        try {
            const state = getState();
            const businessUnitId = state.BusinessUnit.businessUnitList[0].id;
            const api = whatsAppMessageTemplatesApi.getWhatsAppMessageLists.api(businessUnitId, skip, limit);
            const response = await apiFetch<API.PaginatedResponse<API.WhatsAppMessageTemplate[]>>(
                api,
                whatsAppMessageTemplatesApi.getWhatsAppMessageLists.method,
            );
            let templatesList;
            if (skip > 0) {
                templatesList = [...state.WhatsAppMessageTemplates.templatesList, ...response.data.data];
            } else {
                templatesList = response.data.data;
            }
            const payload: FetchListPayload = {
                templatesList,
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

export const whatsAppTemplatesSlice = createSlice({
    name: 'WhatsAppTemplates',
    initialState,
    reducers: {
        selectWhatsAppMessage: (state, { payload }: PayloadAction<API.WhatsAppMessageTemplate>) => {
            state.selectedMessage = payload.text;
            state.selectedTemplateDetail = payload;
        },
        resetSelectWhatsAppMessage: (state) => {
            state.selectedMessage = null;
            state.selectedTemplateDetail = undefined;
        },
    },
    extraReducers: (builder) => {
        builder.addCase(fetchWhatsAppTemplates.pending, (state) => {
            if (state.loadingStatus === IDLE || state.loadingStatus === FETCH_SUCCEEDED) {
                state.loadingStatus = FETCH_IN_PROGRESS;
            }
        });
        builder.addCase(fetchWhatsAppTemplates.fulfilled, (state, action) => {
            if (state.loadingStatus === FETCH_IN_PROGRESS) {
                return {
                    ...state,
                    loadingStatus: FETCH_SUCCEEDED,
                    ...action.payload,
                };
            }
        });
        builder.addCase(fetchWhatsAppTemplates.rejected, (state, action) => {
            state.loadingStatus = FETCH_FAILED;
            if (action.payload) {
                state.error = action.payload.message;
            } else {
                state.error = action.error;
            }
        });
    },
});

export const { selectWhatsAppMessage, resetSelectWhatsAppMessage } = whatsAppTemplatesSlice.actions;

export default whatsAppTemplatesSlice.reducer;
