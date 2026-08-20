import type { SerializedError } from '@reduxjs/toolkit';

import type { PaginationParams } from './index.types';

export type ReduxMessage =
    | API.ConversationMessage & {
          contact?: API.User | API.Contact;
      };

export interface InitialState {
    currentRequestId?: string;
    loadingStatus: LoadingStatus;
    messages: ReduxMessage[];
    limit: number;
    skip: number;
    hasMore: boolean;
    count: number;
    total: number;
    showLatestUnreadMsg: boolean;
    postMessageStatus: LoadingStatus;
    fileUploadStatus: LoadingStatus;
    postCommentStatus: LoadingStatus;
    fetchMessageByCommentStatus: LoadingStatus;
    errors?: {
        fetchMessagesError?: string | SerializedError;
        postMessageError?: string | SerializedError;
        fileUploadError?: string | SerializedError;
        appendMessageError?: string | SerializedError;
    };
    editingComment?: string;
}

export interface FetchMessagePayload {
    messages: ReduxMessage[];
    hasMore: boolean;
    count: number;
    total: number;
    limit: number;
    skip: number;
}
export interface FetchMessageByCommentPayload {
    messages?: ReduxMessage[];
}
export interface FetchMessageParams extends PaginationParams {
    teamConvId: string;
}

export interface PostMessageParams {
    teamConvId: string;
    type: API.MessageType;
    text: string | { id: string; variables: string[] };
    filename?: string;
    templateId?: string;
}
export interface PostCommentParams {
    content: string;
    labels: string[];
    convId: string;
    messageId: string;
    commentId?: string;
    teamConvId?: string;
    userId?: string;
}
