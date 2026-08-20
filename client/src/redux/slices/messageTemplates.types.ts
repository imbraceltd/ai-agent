import type { PaginationParams } from './index.types';

export interface InitialState {
    loadingStatus: LoadingStatus;
    list: API.MessageTemplate[];
    templateDetail?: API.MessageTemplate;
    selectedMessage?: string;
    total: number;
    count: number;
    limit: number;
    skip: number;
    hasMore: boolean;
    errors?: {
        fetchList?: string;
    };
    cursor?: number;
}

export interface FetchListPayload {
    list: API.MessageTemplate[];
    total: number;
    count: number;
    limit: number;
    skip: number;
    hasMore: boolean;
}

export interface FetchListParams extends PaginationParams {
    field?: string;
    search?: string;
    paginated?: boolean;
}
