import type { PaginationParams } from './index.types';

export interface InitialState {
    loadingStatus: LoadingStatus;
    contactCommentTotalCount: number;
    getAllConversationContactCommentByIdStatus: LoadingStatus;
    list: API.Contact[];
    total: number;
    count: number;
    limit: number;
    skip: number;
    hasMore: boolean;
    commentChannelFilter: API.ChannelType[];
    getContactByIdStatus: LoadingStatus;
    contact?: API.Contact;
    getConversationContactCommentByIdStatus: LoadingStatus;
    contactComment?: API.ConversationMessageContactComments[];
    contactCommentTotal: number;
    contactCommentCount: number;
    contactCommentLimit: number;
    contactCommentSkip: number;
    contactCommentHasMore: boolean;
    errors?: {
        fetchList?: string;
    };
}

export interface FetchListPayload {
    list: API.Contact[];
    total: number;
    count: number;
    limit: number;
    skip: number;
}
export interface FetchContactPayload {
    contact: API.Contact;
}
export interface FetchContactCommentParams {
    channelTypes?: API.ChannelType[];
    contactId: string;
    limit?: number;
    skip?: number;
}
export interface FetchContactCommentPayload {
    items: API.ConversationMessageContactComments[];
    total: number;
    count: number;
    hasMore: boolean;
    limit: number;
    skip: number;
}
export interface FetchAllContactCommentParams {
    contactId: string;
    limit?: number;
    skip?: number;
}
export interface FetchAllContactCommentPayload {
    count: number;
}
export interface FetchListParams extends PaginationParams {
    search?: string;
    sort?: string;
}
