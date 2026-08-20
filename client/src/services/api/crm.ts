import { fetchMethod } from '../axios';

export const getBoards = {
    api: ({
        limit,
        skip,
        sort,
        hidden,
        isDefault,
        types,
    }: {
        limit: number;
        skip: number;
        sort: string;
        hidden?: boolean;
        isDefault?: boolean;
        types?: string;
    }) => {
        const searchParams = new URLSearchParams();
        searchParams.append('limit', `${limit}`);
        searchParams.append('skip', `${skip}`);
        searchParams.append('sort', sort);
        if (isDefault !== undefined) {
            searchParams.append('is_default', `${isDefault}`);
        }

        if (typeof hidden !== 'undefined') {
            searchParams.append('hidden', `${hidden}`);
        }
        if (types) {
            searchParams.append('types', types);
        }
        console.log({ searchParams });
        return `/v1/board?${searchParams.toString()}`;
    },
    method: fetchMethod.GET,
};

export const getBoardById = {
    api: (boardId: string) => `/v1/board/${boardId}`,
    method: fetchMethod.GET,
};
export const postBoard = {
    api: () => '/v1/backend/board',
    method: fetchMethod.POST,
};

export const updateBoardById = {
    api: (boardId: string) => `/v1/backend/board/${boardId}`,
    method: fetchMethod.PUT,
};
export const deleteBoard = {
    api: (boardId: string) => `/v1/backend/board/${boardId}`,
    method: fetchMethod.DELETE,
};

export const postBoardField = {
    api: (boardId: string) => `/v1/backend/board/${boardId}/board_fields`,
    method: fetchMethod.POST,
};

export const putBoardField = {
    api: (boardId: string, fieldId: string) => `/v1/backend/board/${boardId}/board_fields/${fieldId}`,
    method: fetchMethod.PUT,
};

export const deleteBoardField = {
    api: (boardId: string, fieldId: string) => `/v1/backend/board/${boardId}/board_fields/${fieldId}`,
    method: fetchMethod.DELETE,
};

export const getBoardRecord = {
    api: (boardId: string, recordId: string) => `/v1/board/${boardId}/board_items/${recordId}`,
    method: fetchMethod.GET,
};
export const getBoardRecords = {
    api: (boardId: string) => `/v1/board/${boardId}/board_items`,
    method: fetchMethod.GET,
};
export const postBoardRecord = {
    api: (boardId: string) => `/v1/board/${boardId}/board_items`,
    method: fetchMethod.POST,
};

export const putBoardRecord = {
    api: (boardId: string, recordId: string) => `/v1/backend/board/${boardId}/board_items/${recordId}`,
    method: fetchMethod.PUT,
};

export const deleteBoardRecord = {
    api: (boardId: string, recordId: string) => `/v1/board/${boardId}/board_items/${recordId}`,
    method: fetchMethod.DELETE,
};

export const deleteBoardRecords = {
    api: (boardId: string) => `/v1/backend/board/${boardId}/board_items`,
    method: fetchMethod.DELETE,
};

export const postBoardFile = {
    api: '/v1/backend/board/_fileupload',
    method: fetchMethod.POST,
};

export const postBoardUpload = {
    api: '/v1/backend/board/upload',
    method: fetchMethod.POST,
};

export const searchBoardRecord = {
    api: (boardId: string) => `/v1/meilisearch/${boardId}/search`,
    method: fetchMethod.POST,
};

export const postBoardOrder = {
    api: '/v1/backend/board/_order',
    method: fetchMethod.POST,
};

export const getBoardSegmentation = {
    api: (boardId: string) => `/v1/backend/board/${boardId}/segmentation`,
    method: fetchMethod.GET,
};

export const postBoardSegmentation = {
    api: (boardId: string) => `/v1/backend/board/${boardId}/segmentation`,
    method: fetchMethod.POST,
};

export const putBoardSegmentation = {
    api: (boardId: string, segmentationId: string) => `/v1/backend/board/${boardId}/segmentation/${segmentationId}`,
    method: fetchMethod.PUT,
};

export const deleteBoardSegmentation = {
    api: (boardId: string, segmentationId: string) => `/v1/backend/board/${boardId}/segmentation/${segmentationId}`,
    method: fetchMethod.DELETE,
};
export const getLinkedBoardItems = {
    api: (contactBoardId: string, boardItemId: string, type: 'Opportunities' | 'Tasks') =>
        `/v1/board/${contactBoardId}/board_items/_related_board_item?related_board_item_id=${boardItemId}&type=${type}`,
    method: fetchMethod.GET,
};
export const isContactRecordConflicted = {
    api: (boardId: string, boardItemId: string) => `/v1/backend/board/${boardId}/board_items/${boardItemId}/_is_conflicted`,
    method: fetchMethod.POST,
};
export const linkPreview = {
    api: '/v1/backend/link_preview/getWebsiteInfo',
    method: fetchMethod.POST,
};

export const getExportCsv = {
    api: (boardId: string) => `/v1/backend/board/${boardId}/export_csv`,
    method: fetchMethod.GET,
};

const buildQueryString = (params: Record<string, any>): string => {
    const query = Object.entries(params)
        .map(([key, value]) => {
            if (!value) {
                return '';
            }
            if (value instanceof Date) {
                value = value.toISOString();
            }
            return `${key}=${encodeURIComponent(value)}`;
        })
        .join('&');
    return query ? `?${query}` : '';
};

export const exportCsvViaMail = {
    api: (
        boardId: string,
        queryKey: {
            tz: string;
            quick_range: string;
            start_date?: Date | undefined;
            end_date?: Date | undefined;
            all?: boolean;
            by?: string;
            sort?: string;
        },
    ) => {
        return `/v1/backend/board/${boardId}/export_csv${buildQueryString(queryKey)}`;
    },
    method: fetchMethod.POST,
};

export const postBoardFieldsOrder = {
    api: (boardId: string) => `/v1/backend/board/${boardId}/board_fields/_order`,
    method: fetchMethod.POST,
};

export const getRelatedRecords = {
    api: (boardId: string, boardItemId: string, relatedBoardId: string) =>
        `/v1/board/${boardId}/board_items/${boardItemId}/related_boards/${relatedBoardId}/board_items`,
    method: fetchMethod.GET,
};

export const putLinkRecords = {
    api: (boardId: string, boardItemId: string, relatedBoardId: string) =>
        `/v1/board/${boardId}/board_items/${boardItemId}/related_boards/${relatedBoardId}/link`,
    method: fetchMethod.PUT,
};
export const putUnLinkRecords = {
    api: (boardId: string, boardItemId: string, relatedBoardId: string) =>
        `/v1/board/${boardId}/board_items/${boardItemId}/related_boards/${relatedBoardId}/unlink`,
    method: fetchMethod.PUT,
};

export const importCsv = {
    api: (boardId: string) => `/v1/backend/board/${boardId}/import_csv`,
    method: fetchMethod.POST,
};

export const importExcel = {
    api: (boardId: string) => `/v1/backend/board/${boardId}/import_excel`,
    method: fetchMethod.POST,
};

export const putBoardFields = {
    api: (boardId: string) => `/v1/backend/board/${boardId}/multiple_board_fields`,
    method: fetchMethod.PUT,
};
