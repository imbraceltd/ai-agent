import { createQueryKeys } from '@lukemorales/query-key-factory';
import type { UseQueryOptions } from '@tanstack/react-query';
import { useInfiniteQuery, useQuery } from '@tanstack/react-query';

import { getBoardContactFields } from '../api/contact';
import { getBoardById, getBoardRecord, getBoardRecords, getBoards, getRelatedRecords, searchBoardRecord } from '../api/crm';
import { ImbraceClient } from '../axios';
import apiFetch from '../axios/handler';

type BoardsListParamsType = {
    limit?: number;
    skip?: number;
    sort?: string;
    isDefault?: boolean;
    types?: string;
};

type RelatedRecordsParamsType = {
    limit?: number;
    skip: number;
    sort?: string;
    link: boolean;
    name?: string;
};

type RecordListParamsType = {
    pagination: { pageIndex: number; pageSize: number };
    sorters?: string[];
    globalFilter?: string;
    filters?: string;
};
export const boards = createQueryKeys('boards', {
    list: ({ limit = 0, skip = 0, sort = '-created_at', isDefault, types = '' }: BoardsListParamsType) => ({
        queryKey: [
            {
                limit,
                skip,
                sort,
                isDefault,
                types,
            },
        ],
        queryFn: async ({ signal }) => {
            console.log('🔍 QueryFn executing with params:', { limit, skip, sort, isDefault, types });
            const { data } = await apiFetch<{ data: API.Board[] }>(
                getBoards.api({
                    limit,
                    skip,
                    sort,
                    isDefault: isDefault ?? undefined,
                    types,
                }),
                getBoards.method,
                {},
                ImbraceClient,
                {
                    signal,
                },
            );
            return data.data;
        },
    }),
    detail: (boardId?: string) => ({
        queryKey: [boardId],
        queryFn: async ({ signal }) => {
            if (!boardId) {
                throw new Error('missing board id');
            }

            const { data } = await apiFetch<API.Board>(getBoardById.api(boardId), getBoardById.method, {}, ImbraceClient, {
                signal,
            });


            console.log({data})

            return data;
        },
        contextQueries: {
            records: {
                queryKey: null,
                queryFn: null,
                contextQueries: {
                    detail: (recordId?: string) => ({
                        queryKey: [recordId],
                        queryFn: async () => {
                            if (!boardId) {
                                throw new Error('missing board id');
                            }

                            if (!recordId) {
                                throw new Error('missing record id');
                            }

                            const { data } = await apiFetch<API.BoardItem>(getBoardRecord.api(boardId, recordId), getBoardRecord.method);
                            return data;
                        },
                        contextQueries: {
                            relatedRecords: (relatedBoardId) => ({
                                queryKey: [relatedBoardId],
                                queryFn: null,
                                contextQueries: {
                                    list: (params: RelatedRecordsParamsType) => ({
                                        queryKey: [relatedBoardId, params],
                                        queryFn: async () => {
                                            if (!boardId) {
                                                throw new Error('missing board id');
                                            }

                                            if (!recordId) {
                                                throw new Error('missing record id');
                                            }
                                            const { data } = await apiFetch<API.PaginatedResponse<API.BoardItem[]>>(
                                                getRelatedRecords.api(boardId, recordId, relatedBoardId),
                                                getRelatedRecords.method,
                                                params,
                                            );
                                            return {
                                                data: data.data,
                                                has_more: data.has_more,
                                                total: data.total,
                                                count: data.count,
                                                limit: params.limit,
                                            };
                                        },
                                    }),
                                    infiniteList: (params: RelatedRecordsParamsType) => ({
                                        queryKey: [relatedBoardId, params],
                                        queryFn: async ({ pageParam }) => {
                                            if (!boardId) {
                                                throw new Error('missing board id');
                                            }

                                            if (!recordId) {
                                                throw new Error('missing record id');
                                            }
                                            const { data } = await apiFetch<API.PaginatedResponse<API.BoardItem[]>>(
                                                getRelatedRecords.api(boardId, recordId, relatedBoardId),
                                                getRelatedRecords.method,
                                                {
                                                    ...params,
                                                    skip: pageParam,
                                                },
                                            );
                                            return {
                                                data: data.data,
                                                has_more: data.has_more,
                                                total: data.total,
                                                count: data.count,
                                                limit: params.limit,
                                                previousSkip: Math.max((pageParam as number) - (params.limit ?? 20), 0),
                                                nextSkip: data.has_more ? (pageParam as number) + (params.limit ?? 20) : undefined,
                                                currentSkip: pageParam as number,
                                            };
                                        },
                                    }),
                                },
                            }),
                        },
                    }),
                    list: (params: RecordListParamsType) => ({
                        queryKey: [params],
                        queryFn: async ({ signal }) => {
                            if (!boardId) {
                                throw new Error('missing board id');
                            }

                            const { pagination, sorters, globalFilter, filters } = params;
                            const searchParams = new URLSearchParams();
                            let api = getBoardRecords.api(boardId);
                            let method: 'GET' | 'POST' = getBoardRecords.method;
                            if (pagination) {
                                searchParams.append('limit', `${pagination.pageSize}`);
                                searchParams.append('skip', `${pagination.pageIndex * pagination.pageSize}`);
                            }
                            if (sorters) {
                                searchParams.append('sort', sorters[0]);
                            }

                            if (globalFilter || (filters && filters.length > 0)) {
                                api = searchBoardRecord.api(boardId);
                                method = searchBoardRecord.method;
                                const postData: {
                                    limit?: number;
                                    offset?: number;
                                    q?: string;
                                    matchingStrategy: string;
                                    filter?: string;
                                    sort?: string[];
                                } = {
                                    limit: pagination?.pageSize,
                                    q: globalFilter,
                                    matchingStrategy: 'all',
                                };
                                if (pagination) {
                                    postData.offset = pagination.pageIndex * pagination.pageSize;
                                }
                                if (filters) {
                                    postData.filter = filters;
                                }
                                if (sorters) {
                                    postData.sort = sorters;
                                }

                                const { data } = await apiFetch<API.MeilisearchResponse<API.BoardItem[]>>(
                                    api,
                                    method,
                                    postData,
                                    ImbraceClient,
                                    {
                                        signal,
                                    },
                                );

                                return {
                                    data: data.message.hits.map(
                                        (boardItem) =>
                                            ({
                                                ...boardItem,
                                                ...boardItem.fields,
                                                id: boardItem._id,
                                                board_item_id: boardItem._id,
                                                created_type: boardItem.created_type,
                                            } as API.BoardItem),
                                    ),
                                    meta: {
                                        total: data.message.estimatedTotalHits,
                                        skip: (pagination?.pageIndex ?? 0) * (pagination?.pageSize ?? 0),
                                        limit: pagination?.pageSize ?? 20,
                                    },
                                };
                            } else {
                                const { data } = await apiFetch<API.PaginatedResponse<API.BoardItem[]>>(
                                    api,
                                    method,
                                    searchParams,
                                    ImbraceClient,
                                    {
                                        signal,
                                    },
                                );

                                return {
                                    data: data.data.map((boardItem) => ({ ...boardItem, id: boardItem.board_item_id } as API.BoardItem)),
                                    meta: {
                                        total: data.count,
                                        skip: (pagination?.pageIndex ?? 0) * (pagination?.pageSize ?? 0),
                                        limit: pagination?.pageSize ?? 20,
                                    },
                                };
                            }
                        },
                    }),
                },
            },
        },
    }),
});

/**
 * Fetch all boards
 * @param params { limit?: number; skip?: number; sort?: string; isDefault: boolean }
 * @returns
 */
export const useBoards = (params: { limit?: number; skip?: number; sort?: string; isDefault?: boolean; types?: string }) => {
    return useQuery({
        ...boards.list(params),
        staleTime: 0, // Force refetch to see if query runs
        // Remove initialData to force query execution
    });
};
export const boardsQueryKey = (params: BoardsListParamsType) => boards.list(params).queryKey;

export const boardsQueryFn = (params: BoardsListParamsType) => boards.list(params).queryFn;

/**
 * Fetch a board by its id
 * @param boardId
 * @returns
 */
export const useBoardById = (boardId?: string) =>
    useQuery({
        ...boards.detail(boardId),
        enabled: !!boardId,
    });
export const boardByIdQueryKey = (boardId?: string) => boards.detail(boardId).queryKey;

export const boardByIdQueryFn = (boardId?: string) => boards.detail(boardId).queryFn;

/**
 * Fetch records by its board
 * @param params { boardId?: string;  }
 * @returns
 */
export const useRecords = (params: { boardId?: string; params: RecordListParamsType }) =>
    useQuery({
        ...boards.detail(params.boardId)._ctx.records._ctx.list(params.params),
        initialData: {
            data: [],
            meta: {
                total: 0,
                skip: 0,
                limit: 20,
            },
        },
        enabled: !!params.boardId,
    });
export const recordsQueryKey = (params: { boardId?: string; params: RecordListParamsType }) =>
    boards.detail(params.boardId)._ctx.records._ctx.list(params.params).queryKey;

export const recordsQueryFn = (params: { boardId?: string; params: RecordListParamsType }) =>
    boards.detail(params.boardId)._ctx.records._ctx.list(params.params).queryFn;

/**
 * Fetch a record by its board and record id
 * @param params { boardId?: string; recordId?: string }
 * @returns
 */
export const useRecordById = (params: { boardId?: string; recordId?: string }) =>
    useQuery({
        ...boards.detail(params.boardId)._ctx.records._ctx.detail(params.recordId),
        enabled: !!params.boardId && !!params.recordId && params.recordId !== 'new',
    });
export const recordByIdQueryKey = (params: { boardId?: string; recordId?: string }) =>
    boards.detail(params.boardId)._ctx.records._ctx.detail(params.recordId).queryKey;

export const recordByIdQueryFn = (params: { boardId?: string; recordId?: string }) =>
    boards.detail(params.boardId)._ctx.records._ctx.detail(params.recordId).queryFn;

/**
 * Fetch related records by boardId, recordId and relatedBoardId
 * @param params { boardId: string; recordId: string; relatedBoardId: string; params: RelatedRecordsParamsType }
 * @returns
 */
export const useRelatedRecords = (params: {
    boardId: string;
    recordId: string;
    relatedBoardId?: string;
    params: RelatedRecordsParamsType;
}) =>
    useQuery({
        ...boards
            .detail(params.boardId)
            ._ctx.records._ctx.detail(params.recordId)
            ._ctx.relatedRecords(params.relatedBoardId)
            ._ctx.list(params.params),
        initialData: {
            data: [],
            limit: 20,
            has_more: true,
            total: 0,
            count: 0,
        },
        enabled: !!params.boardId && !!params.recordId && !!params.relatedBoardId,
    });
export const relatedRecordsQueryKey = (params: {
    boardId: string;
    recordId: string;
    relatedBoardId?: string;
    params: RelatedRecordsParamsType;
}) =>
    boards
        .detail(params.boardId)
        ._ctx.records._ctx.detail(params.recordId)
        ._ctx.relatedRecords(params.relatedBoardId)
        ._ctx.list(params.params).queryKey;

export const relatedRecordsQueryFn = (params: {
    boardId: string;
    recordId: string;
    relatedBoardId?: string;
    params: RelatedRecordsParamsType;
}) =>
    boards
        .detail(params.boardId)
        ._ctx.records._ctx.detail(params.recordId)
        ._ctx.relatedRecords(params.relatedBoardId)
        ._ctx.list(params.params).queryFn;

/**
 * Fetch related records by boardId, recordId and relatedBoardId
 * @param params { boardId: string; recordId: string; relatedBoardId: string; params: RelatedRecordsParamsType }
 * @returns
 */
export const useRelatedRecordsInfinite = (params: {
    boardId: string;
    recordId: string;
    relatedBoardId?: string;
    params: RelatedRecordsParamsType;
}) =>
    useInfiniteQuery({
        ...boards
            .detail(params.boardId)
            ._ctx.records._ctx.detail(params.recordId)
            ._ctx.relatedRecords(params.relatedBoardId)
            ._ctx.infiniteList(params.params),
        initialPageParam: 0 as never,
        getPreviousPageParam: (firstPage) => firstPage.previousSkip as never,
        getNextPageParam: (lastPage, groups) => lastPage.nextSkip as never,
        enabled: !!params.boardId && !!params.recordId && !!params.relatedBoardId,
        throwOnError: (error, query) => {
            console.log(error, query);
            return true;
        },
    });
export const relatedRecordsInfiniteQueryKey = (params: {
    boardId: string;
    recordId: string;
    relatedBoardId?: string;
    params: RelatedRecordsParamsType;
}) =>
    boards
        .detail(params.boardId)
        ._ctx.records._ctx.detail(params.recordId)
        ._ctx.relatedRecords(params.relatedBoardId)
        ._ctx.infiniteList(params.params).queryKey;

export const relatedRecordsInfiniteQueryFn = (params: {
    boardId: string;
    recordId: string;
    relatedBoardId?: string;
    params: RelatedRecordsParamsType;
}) =>
    boards
        .detail(params.boardId)
        ._ctx.records._ctx.detail(params.recordId)
        ._ctx.relatedRecords(params.relatedBoardId)
        ._ctx.infiniteList(params.params).queryFn;

export const contactRecord = createQueryKeys('contactRecord', {
    detail: (contactId?: string) => ({
        queryKey: [contactId],
        queryFn: async () => {
            if (!contactId) {
                throw new Error('Contact ID is required');
            }
            const { data } = await apiFetch<API.BoardItem>(getBoardContactFields.api(contactId), getBoardContactFields.method);
            return data;
        },
    }),
});

export const contactRecordQueryKey = (contactId?: string) => contactRecord.detail(contactId).queryKey;

export const contactRecordQueryFn = (contactId?: string) => contactRecord.detail(contactId).queryFn;
/**
 * Fetch a record by contact id
 * @param params { contactId?: string;}
 * @returns
 */
export const useContactRecord = (
    contactId = '',
    options?: Omit<UseQueryOptions<API.BoardItem, Error, API.BoardItem, ReturnType<typeof contactRecordQueryKey>>, 'queryKey' | 'queryFn'>,
) =>
    useQuery({
        ...contactRecord.detail(contactId),
        enabled: !!contactId,
        ...options,
    });
