import type { SerializedError } from '@reduxjs/toolkit';

export interface InitialState {
    loadingStatus: LoadingStatus;
    templatesList: API.WhatsAppMessageTemplate[];
    selectedTemplateDetail?: API.WhatsAppMessageTemplate;
    selectedMessage: string | null;
    total: number;
    count: number;
    limit: number;
    skip: number;
    hasMore: boolean;
    error?: string | SerializedError;
}

export interface FetchListPayload {
    templatesList: API.WhatsAppMessageTemplate[];
    total: number;
    count: number;
    limit: number;
    skip: number;
    hasMore: boolean;
}
