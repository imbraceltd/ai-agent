export interface InitialState {
    getOrganizationListStatus: LoadingStatus;
    createOrganizationStatus: LoadingStatus;
    organizationList: API.Organization[];
    hasMore: boolean;
    count: number;
    total: number;
    limit: number;
    skip: number;
    selectedOrganizationId: string;
    selectedOrganizationName: string;
    selectedOrganizationCreatedAt: string;
    selectedOrganizationUpdatedAt: string;
    errors?: {
        fetchListError?: string;
        createError?: string;
    };
}

export interface FetchOrganizationPayload {
    list: API.Organization[];
    hasMore: boolean;
    total: number;
    count: number;
    skip: number;
    limit: number;
}

export interface CreateOrganizationPayload {
    id: string;
    name: string;
    createdAt: string;
    updatedAt: string;
}
