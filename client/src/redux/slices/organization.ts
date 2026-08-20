import { createAsyncThunk, createSlice } from '@reduxjs/toolkit';
import type { AxiosError } from 'axios';
import { replace } from 'redux-first-history';

import { FETCH_FAILED, FETCH_IN_PROGRESS, FETCH_SUCCEEDED, IDLE } from '@/constants/app';
import { getOrganization, postOrganization, postOrganizationFullAccess } from '@/services/api/organization';
import apiFetch from '@/services/axios/handler';

import type { AsyncThunkOptions, PaginationParams } from './index.types';
import type { CreateOrganizationPayload, FetchOrganizationPayload, InitialState } from './organization.types';

const initialState: InitialState = {
    getOrganizationListStatus: IDLE,
    createOrganizationStatus: IDLE,
    organizationList: [],
    hasMore: true,
    count: 0,
    total: 0,
    limit: 10,
    skip: 0,

    selectedOrganizationId: '',
    selectedOrganizationName: '',
    selectedOrganizationCreatedAt: '',
    selectedOrganizationUpdatedAt: '',
};

/**
 * @param {number} [limit] - optional - the maximum length of organization list
 * @param {number} [skip] - optional - number skipped of organization list
 */

export const fetchOrganizationListThunk = createAsyncThunk<FetchOrganizationPayload, PaginationParams, AsyncThunkOptions>(
    'Organization/fetchList',
    async (params, { dispatch, getState, rejectWithValue }) => {
        try {
            const { limit = 10, skip = 0, is_active = true } = params;
            const getOrganizationApi = getOrganization.api(limit, skip, is_active );
            const response = await apiFetch<API.PaginatedResponse<API.Organization[]>>(getOrganizationApi, getOrganization.method);
            const { data, count, total, has_more } = response.data;

            const state = getState();

            let nextOrgList = data;

            if (skip > 0) {
                nextOrgList = [...state.Organization.organizationList, ...data];
            }

            const payload = {
                list: nextOrgList,
                hasMore: has_more,
                count,
                total,
                limit,
                skip,
            };

            return payload;
        } catch (err) {
            const error = err as AxiosError<API.ErrorResponse>;
            let message = 'Something went wrong';

            dispatch(replace('/'));

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

/**
 * @param {string} organization.name name for the new organization
 */
export const createOrganizationThunk = createAsyncThunk<CreateOrganizationPayload, { name: string }, AsyncThunkOptions>(
    'Organization/create',
    async (organization, { rejectWithValue }) => {
        try {
            const response = await apiFetch<API.Organization>(postOrganization.api, postOrganization.method, organization);
            const { id, name, created_at, updated_at } = response.data;

            const payload = {
                id: id,
                name: name,
                createdAt: created_at,
                updatedAt: updated_at,
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

/**
 * @param {string} organization.name name for the new organization
 */
export const createOrganizationFullAccessThunk = createAsyncThunk<CreateOrganizationPayload, { name: string }, AsyncThunkOptions>(
    'Organization/createFullAccess',
    async (organization, { rejectWithValue }) => {
        try {
            const response = await apiFetch<{ organization: API.Organization }>(postOrganizationFullAccess.api, postOrganizationFullAccess.method, organization);
            const { id, name, created_at, updated_at } = response.data.organization;

            const payload = {
                id: id,
                name: name,
                createdAt: created_at,
                updatedAt: updated_at,
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

export const resetOrganizationThunk = createAsyncThunk<void, void, AsyncThunkOptions>(
    'Organization/reset',
    async (params, { dispatch, rejectWithValue }) => {
        try {
            dispatch(replace('/organization'));
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

export const organizationSlice = createSlice({
    name: 'Organization',
    initialState,
    reducers: {},
    extraReducers: (builder) => {
        // Organization/fetchList
        builder
            .addCase(fetchOrganizationListThunk.pending, (state, action) => {
                state.getOrganizationListStatus = FETCH_IN_PROGRESS;
            })
            .addCase(fetchOrganizationListThunk.fulfilled, (state, action) => {
                if (state.getOrganizationListStatus === FETCH_IN_PROGRESS) {
                    state.getOrganizationListStatus = FETCH_SUCCEEDED;
                    state.organizationList = action.payload.list;
                    state.hasMore = action.payload.hasMore;
                    state.count = action.payload.count;
                    state.total = action.payload.total;
                    state.limit = action.payload.limit;
                    state.skip = action.payload.skip;
                }
            })
            .addCase(fetchOrganizationListThunk.rejected, (state, action) => {
                state.getOrganizationListStatus = FETCH_FAILED;
                if (action.payload) {
                    state.errors = {
                        ...state.errors,
                        fetchListError: action.payload.message,
                    };
                }
            });

        // Organization/create
        builder
            .addCase(createOrganizationThunk.pending, (state, action) => {
                state.createOrganizationStatus = FETCH_IN_PROGRESS;
                state.errors = {
                    ...state.errors,
                    createError: undefined,
                };
            })
            .addCase(createOrganizationThunk.fulfilled, (state, action) => {
                if (state.createOrganizationStatus === FETCH_IN_PROGRESS) {
                    state.createOrganizationStatus = FETCH_SUCCEEDED;
                    state.selectedOrganizationId = action.payload.id;
                    state.selectedOrganizationName = action.payload.name;
                    state.selectedOrganizationCreatedAt = action.payload.createdAt;
                    state.selectedOrganizationUpdatedAt = action.payload.updatedAt;
                }
            })
            .addCase(createOrganizationThunk.rejected, (state, action) => {
                state.createOrganizationStatus = FETCH_FAILED;
                if (action.payload) {
                    state.errors = {
                        ...state.errors,
                        createError: action.payload.message,
                    };
                }
            });

        // Organization/createFullAccess
        builder
            .addCase(createOrganizationFullAccessThunk.pending, (state, action) => {
                state.createOrganizationStatus = FETCH_IN_PROGRESS;
                state.errors = {
                    ...state.errors,
                    createError: undefined,
                };
            })
            .addCase(createOrganizationFullAccessThunk.fulfilled, (state, action) => {
                if (state.createOrganizationStatus === FETCH_IN_PROGRESS) {
                    state.createOrganizationStatus = FETCH_SUCCEEDED;
                    state.selectedOrganizationId = action.payload.id;
                    state.selectedOrganizationName = action.payload.name;
                    state.selectedOrganizationCreatedAt = action.payload.createdAt;
                    state.selectedOrganizationUpdatedAt = action.payload.updatedAt;
                }
            })
            .addCase(createOrganizationFullAccessThunk.rejected, (state, action) => {
                state.createOrganizationStatus = FETCH_FAILED;
                if (action.payload) {
                    state.errors = {
                        ...state.errors,
                        createError: action.payload.message,
                    };
                }
            });

        // Organization/reset
        builder.addCase(resetOrganizationThunk.fulfilled, (state) => {
            state.createOrganizationStatus = IDLE;
            state.errors = undefined;
        });
    },
});

export default organizationSlice.reducer;
