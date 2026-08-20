import { Button, Illustration, Space, Typography } from '@imbrace/ui';
import { CircularProgress } from '@mui/material';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import type {
    AccessorKeyColumnDef,
    CellContext,
    ColumnFiltersState,
    ColumnOrderState,
    ColumnSizingState,
    PaginationState,
    Row as RowType,
    RowData,
    RowSelectionState,
    SortingState,
    TableState,
} from '@tanstack/react-table';
import {
    flexRender,
    getCoreRowModel,
    getFilteredRowModel,
    getPaginationRowModel,
    getSortedRowModel,
    useReactTable,
} from '@tanstack/react-table';
import type { Range } from '@tanstack/react-virtual';
import { defaultRangeExtractor, useVirtualizer } from '@tanstack/react-virtual';
import isEqual from 'lodash/isEqual';
import type { CSSProperties, ForwardedRef, MouseEvent as ReactMouseEvent, ReactNode } from 'react';
import React, { useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import Scrollbars from 'react-custom-scrollbars';
import type SimpleBarCore from 'simplebar-core';
import SimpleBar from 'simplebar-react';
import EditableColumn from './editableColumn';
import Filters from './filters';
import { HeaderWrapper } from './headerRow';
import styles from './index.module.scss';
import Pagination from './pagination';
import Row from './row';
import type {
    CacheMutationPayload,
    ColumnType,
    ColumnValue,
    FlexibleTableProps,
    FlexibleTableRef,
    FlexibleTableWithRequest,
    RequestParameters,
    Response,
} from './types';
import { filterFnMap, getCorrectSize, getDefaultSize, useDeepCompareEffect } from './utils';
import { useNotify } from '@/contexts/SnackbarContext';
import HighlightIcon from '@/assets/icons/icon-highlight.svg?react';
import { t } from 'i18next';

declare module '@tanstack/react-table' {
    // eslint-disable-next-line
    interface TableMeta<TData extends RowData> {
        updateData: (data: { rowIndex?: number; columnId: string; value: unknown; id: string }) => void;
    }

    // eslint-disable-next-line
    interface ColumnMeta<TData extends RowData, TValue> {
        identifier?: boolean;
        type?: ColumnType['type'];
        cellStyle?: CSSProperties;
        headerStyle?: CSSProperties;
        disableOrdering?: boolean;
        onExpand?: (
            event: ReactMouseEvent<HTMLButtonElement | HTMLDivElement, MouseEvent>,
            data: { rowId: string; target?: HTMLElement; value?: ColumnValue; onClose?: () => void; extraProps?: Record<string, unknown> },
        ) => void;
        isEditable?: boolean;
        tooltip?: string;
        defaultFieldName?: string;
        enum?: Record<string | number, string>;
        defaultCountryCode?: string;
        defaultCurrencyCode?: string;
        fieldData?: API.BoardField;
        footer?: ReactNode;
        boardType?: API.BoardType
    }
}

declare module 'react' {
    function forwardRef<T, P = Record<string, unknown>>(
        render: (props: P, ref: React.Ref<T>) => React.ReactElement | null,
    ): (props: P & React.RefAttributes<T>) => React.ReactElement | null;
}

const FlexibleTable = <D extends { id: string; _id?: string }>(props: FlexibleTableProps<D>, ref: ForwardedRef<FlexibleTableRef<D>>) => {
    const {
        columns,
        columnResizable,
        columnOrderChangeable,
        columnSortable = true,
        columnFilterable = true,
        onDataUpdate,
        onDataDelete,
        onPaginationChange,
        onColumnFilterChange,
        onSorterChange,
        onColumnOrderChange,
        onColumnSizingChange,
        isDataDeletable,
        deleteButtonText,
        deleteTooltip,
        emptyImage = 'recordMissing',
        emptyMessage = 'No data',
        fullWidth,
        containerStyle,
        enableRowSelection = true,
        enableMultiRowSelection = true,
        disableHoverEffect,
        customFilter,
        filterExtra,
        showFilter,
        filterProps,
        paginationStyle,
        customContextMenu,
        outlined = false,
    } = props;
    const refInitialData = useRef<D[]>([]);
    const queryClient = useQueryClient();
    const { notify, closeSnackbar } = useNotify();
    const [tableState, setTableState] = useState<Partial<TableState>>({
        columnOrder: props.columnOrder && props.columnOrder.length !== 0 ? props.columnOrder : columns.map((column) => column.id as string),
        columnSizing: props.columnSizing ?? {},
        columnPinning: {
            left: columns.filter((column) => column.enablePinning).map((column) => column.accessorKey) as string[],
        },
        columnFilters: [],
        rowSelection: {},
        sorting: [],
        globalFilter: undefined,
        pagination: props.pagination ?? {
            pageIndex: 0,
            pageSize: 20,
        },
    });
    const [pendingUpdates, setPendingUpdates] = useState<
        Record<string, { rowIndex?: number; columnId: string; value: unknown; id: string }>
    >({});

    const simpleBarRef = useRef<SimpleBarCore>(null);
    const containerRef = useRef<HTMLDivElement>();
    const [containerHeight, setContainerHeight] = useState(0);
    const [containerRect, setContainerRect] = useState<DOMRect | null>(null);

    const tableQueryKey = useMemo(
        () =>
            props.queryKey
                ? [
                      ...props.queryKey,
                      {
                          sorters: tableState.sorting,
                          filters: tableState.columnFilters,
                          globalFilter: tableState.globalFilter,
                          pagination: {
                              pageIndex: tableState.pagination?.pageIndex ?? 0,
                              pageSize: tableState.pagination?.pageSize ?? 20,
                          },
                      },
                  ]
                : [
                      'table',
                      {
                          sorters: tableState.sorting,
                          filters: tableState.columnFilters,
                          globalFilter: tableState.globalFilter,
                          pagination: {
                              pageIndex: tableState.pagination?.pageIndex ?? 0,
                              pageSize: tableState.pagination?.pageSize ?? 20,
                          },
                      },
                  ],
        [tableState, props.queryKey],
    );

    const request = useMemo(() => (props as FlexibleTableWithRequest<D>)?.request ?? undefined, [props]);

    const { data, isFetching, refetch } = useQuery({
        queryKey: tableQueryKey,
        queryFn: async ({ queryKey, signal }) => {
            const queryState = queryKey[tableQueryKey.length - 1] as RequestParameters;
            if (request) {
                const response = await request(queryState, signal);
                refInitialData.current = response.data;
                return {
                    ...response,
                };
            }
            if ('dataSource' in props) {
                return {
                    data: props.dataSource,
                    meta: {
                        total: props.dataSource.length,
                    },
                };
            }
            return {
                data: [],
                meta: {
                    total: 0,
                },
            };
        },
        // select: (queryData) => {
        //     return {
        //         ...queryData,
        //         columns: columns,
        //     };
        // },
        placeholderData: keepPreviousData,
    });

    const removeNewRecord = useCallback(() => {
        const newRecordIndex = data?.data.findIndex((record) => record.id === 'new');
        const previousData = queryClient.getQueryData(tableQueryKey) as Response<D>;

        if (newRecordIndex !== -1) {
            const tmp = [...previousData.data];
            tmp.shift();
            queryClient.setQueryData(tableQueryKey, { ...previousData, data: [...tmp] });
        }
    }, [data, tableQueryKey, queryClient]);

    const serializedColumns: AccessorKeyColumnDef<D, ColumnValue>[] = useMemo(() => {
        return (columns || [])?.map((column) => ({
            ...column,
            meta: {
                ...column.meta,
                type: column.type,
                isEditable: column.enableEditing ?? true,
                tooltip: column.tooltip,
                enum: column.enum,
            },
            enableSorting: column.enableSorting ?? false,
            sortDescFirst: true,
            enableGlobalFilter: false,
            enableResizing: column.enableResizing ?? columnResizable ?? false,
            enablePinning: column.meta?.identifier ?? column.enablePinning ?? false,
            filterFn: filterFnMap(column.type),
            size: column.id !== 'rowIndex' ? getDefaultSize(column.type) : 80,
            minSize: column.minSize ?? 120,
            cell: ((colProps: CellContext<D, ColumnValue> & { cellId: string; isHover?: boolean; isRowSelected?: boolean }) => (
                <EditableColumn<D>
                    {...colProps}
                    customCell={column.cell}
                    column={column}
                    editable={column.enableEditing ?? true}
                    removeNewRecord={removeNewRecord}
                    bordered={column.bordered}
                />
            )) as unknown as (props: CellContext<D, ColumnValue>) => ReactNode,
        }));
    }, [columns, columnResizable, removeNewRecord]);

    const columnKeys = useMemo(() => {
        return columns.map((column) => column.accessorKey);
    }, [columns]);

    const pageCount = useMemo(() => {
        if (typeof props.pageCount === 'number') {
            return props.pageCount ?? -1;
        }
        if (!data) {
            return 0;
        }
        return Math.ceil(data.meta.total / (tableState.pagination?.pageSize ?? 20));
    }, [data, tableState, props.pageCount]);

    const updateContainerRect = useCallback(() => {
        if (!containerRef.current) return;
        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContainerRect(entry.target.getBoundingClientRect());
            }
        });
        resizeObserver.observe(containerRef.current);
        setTimeout(() => {
            resizeObserver.disconnect();
        }, 100);
    }, []);

    const cacheMutation = useCallback(
        (payload: CacheMutationPayload<D>) => {
            const oldQuery = queryClient.getQueryData(tableQueryKey) as Response<D>;
            switch (payload.operation) {
                case 'Update': {
                    const updateRecordIndex = oldQuery.data.findIndex((oldData) => oldData.id === `${payload.record.id}`);

                    if (updateRecordIndex !== -1) {
                        const newData = [...oldQuery.data];
                        newData[updateRecordIndex] = {
                            ...newData[updateRecordIndex],
                            ...payload.record,
                        };
                        queryClient.setQueryData(tableQueryKey, { ...oldQuery, data: [...newData] });
                    }
                    break;
                }
                case 'Delete': {
                    let newData = oldQuery.data;
                    if (Array.isArray(payload.rowId)) {
                        newData = oldQuery.data.filter((oldData) => payload.rowId.indexOf(oldData.id) === -1);
                    } else {
                        newData = oldQuery.data.filter((oldData) => oldData.id !== payload.rowId);

                        queryClient.setQueryData(tableQueryKey, { ...oldQuery, data: [...newData] });
                    }

                    queryClient.setQueryData(tableQueryKey, { ...oldQuery, data: [...newData] });

                    break;
                }
                default:
                    break;
            }
        },
        [queryClient, tableQueryKey],
    );

    const handleDataUpdate = useCallback(
        async (updateData: { rowIndex?: number; columnId: string; value: unknown; id: string }) => {
            const checkValueChanged = () => {
                const originalValue = refInitialData.current.find((row) => row.id === updateData.id)?.[updateData.columnId as keyof D];
                // treat null original value and false update value as unchanged
                if (originalValue === null && updateData.value === false) {
                    return false;
                }
                return !isEqual(updateData.value, originalValue);
            };

            const updatePendingChanges = () => {
                const updateKey = `${updateData.id}_${updateData.columnId}`;
                const hasValueChanged = checkValueChanged();

                const newPendingUpdates = { ...pendingUpdates };
                if (hasValueChanged) {
                    newPendingUpdates[updateKey] = updateData;
                } else {
                    delete newPendingUpdates[updateKey];
                }

                setPendingUpdates(newPendingUpdates);
                return { newPendingUpdates, hasValueChanged };
            };

            const updateTableData = () => {
                const previousData = queryClient.getQueryData(tableQueryKey) as Response<D>;
                if (!previousData) return;

                const newData = [...previousData.data];
                const rowIndex = newData.findIndex((row) => row.id === updateData.id);

                if (rowIndex !== -1) {
                    newData[rowIndex] = {
                        ...newData[rowIndex],
                        [updateData.columnId]: updateData.value,
                    };

                    queryClient.setQueryData(tableQueryKey, {
                        ...previousData,
                        data: newData,
                    });
                }
            };

            // Show notification for pending changes
            const showPendingChangesNotification = (pendingUpdatesCount: number) => {
                const update = async () => {
                    try {
                        let failedUpdates = 0;
                        const updatePromises = Object.values(newPendingUpdates).map(async (update) => {
                            try {
                                const result = await onDataUpdate?.(update);
                                if (!result) throw new Error('Update failed');
             
                                cacheMutation({
                                    operation: 'Update',
                                    record: result,
                                });
             
                                const originalIndex = refInitialData.current.findIndex((row) => row.id === result.id);
                                if (originalIndex !== -1) {
                                    refInitialData.current[originalIndex] = {
                                        ...refInitialData.current[originalIndex],
                                        ...result,
                                    };
                                }
             
                                return { success: true, updateKey: `${update.id}_${update.columnId}` };
                            } catch (error) {
                                failedUpdates++;
                                return { success: false, updateKey: `${update.id}_${update.columnId}` };
                            }
                        });
             
                        const results = await Promise.all(updatePromises);
             
                        setPendingUpdates(prev => {
                            const next = { ...prev };
                            results.forEach(result => {
                                if (result.success) {
                                    delete next[result.updateKey];
                                }
                            });
                            return next;
                        });
             
                        // Re-notify with updated count after updates complete
                        if (failedUpdates === 0) {
                            closeSnackbar();
                            notify({
                                type: 'success',
                                message: t('crm_all_record_saved_success'),
                            });
                        } else {
                            closeSnackbar();
                            notify({
                                type: 'warning',
                                icon: <></>,
                                message: (
                                    <Space direction="horizontal" style={{ width: '800px' }}>
                                        <HighlightIcon />
                                        <Typography>{`${failedUpdates} Failed Update. Please try again.`}</Typography>
                                        <Space style={{ marginLeft: '50px' }}>
                                            <Button sx={{ width: '80px' }} size="xs" variant="contained" text={t('save')} onClick={update} />
                                            <Button
                                                sx={{ width: '80px' }}
                                                size="xs"
                                                type="danger"
                                                variant="outlined"
                                                text={t('cancel')}
                                                onClick={removeUpdates}
                                            />
                                        </Space>
                                    </Space>
                                ),
                                customAnchor: {
                                    vertical: 'bottom',
                                    horizontal: 'right',
                                },
                                persist: true,
                            });
                        }
                    } catch (error) {
                        console.error('Failed to process updates:', error);
                        notify({
                            type: 'error',
                            message: t('crm_all_record_saved_fail'),
                        });
                    }
                };
             
                const removeUpdates = () => {
                    const previousData = queryClient.getQueryData(tableQueryKey) as Response<D>;
                    if (!previousData) return;
             
                    const newData = [...previousData.data];
                    const allUpdates = {
                        ...pendingUpdates,
                        [`${updateData.id}_${updateData.columnId}`]: updateData,
                    };
             
                    const affectedRowIds = new Set(Object.values(allUpdates).map((update) => update.id));
             
                    affectedRowIds.forEach((rowId) => {
                        const rowIndex = newData.findIndex((row) => row.id === rowId);
                        if (rowIndex === -1) return;
             
                        const rowUpdates = Object.values(allUpdates).filter((update) => update.id === rowId);
                        const originalRow = refInitialData.current.find((row) => row.id === rowId);
                        if (!originalRow) return;
             
                        rowUpdates.forEach((update) => {
                            newData[rowIndex] = {
                                ...newData[rowIndex],
                                [update.columnId]: originalRow[update.columnId as keyof D],
                            };
                        });
                    });
             
                    queryClient.setQueryData(tableQueryKey, {
                        ...previousData,
                        data: newData,
                    });
             
                    setPendingUpdates({});
                    closeSnackbar();
                    notify({
                        type: 'success',
                        message: t('crm_all_record_reverted_success'),
                    });
                };
             
                // Initial notification 
                notify({
                    type: 'warning',
                    icon: <></>,
                    message: (
                        <Space direction="horizontal" style={{ width: '800px' }}>
                            <HighlightIcon />
                            <Typography>{t('crm_unsaved_changes', { count: pendingUpdatesCount })}</Typography>
                            <Space style={{ marginLeft: '140px' }}>
                                <Button sx={{ width: '80px' }} size="xs" variant="contained" text={t('save')} onClick={update} />
                                <Button
                                    sx={{ width: '80px' }}
                                    size="xs"
                                    type="danger"
                                    variant="outlined"
                                    text={t('cancel')}
                                    onClick={removeUpdates}
                                />
                            </Space>
                        </Space>
                    ),
                    customAnchor: {
                        vertical: 'bottom',
                        horizontal: 'right',
                    },
                    persist: true,
                });
             };

            const { newPendingUpdates } = updatePendingChanges();
            updateTableData();

            const pendingUpdatesCount = Object.keys(newPendingUpdates).length;
            closeSnackbar();
            if (pendingUpdatesCount > 0) {
                // closeSnackbar();
                showPendingChangesNotification(pendingUpdatesCount);
            }
        },
        [queryClient, tableQueryKey, pendingUpdates, notify],
    );

    const table = useReactTable({
        data: [...(data?.data || [])],
        getRowId: (row) => row.id,
        columns: serializedColumns,
        columnResizeMode: columnResizable ? 'onChange' : undefined,
        enableSorting: columnSortable,
        enableSortingRemoval: true,
        enableColumnFilters: columnFilterable,
        enableGlobalFilter: true,
        enableRowSelection: enableRowSelection,
        enableMultiRowSelection: enableMultiRowSelection,
        autoResetPageIndex: false,
        initialState: {
            pagination: {
                pageIndex: 0,
                pageSize: 20,
            },
        },
        state: tableState,
        ...(onDataUpdate && { meta: { updateData: handleDataUpdate } }),
        ...(columnOrderChangeable && {
            onColumnOrderChange: (updater) => {
                let newOrder: ColumnOrderState;
                if (typeof updater === 'function') {
                    newOrder = updater(tableState.columnOrder ?? []);
                } else {
                    newOrder = updater;
                }

                setTableState((prev) => ({
                    ...prev,
                    columnOrder: newOrder,
                }));
                onColumnOrderChange?.(newOrder);
            },
        }),
        onSortingChange: (updater) => {
            let newSorting: SortingState;
            if (typeof updater === 'function') {
                newSorting = updater(tableState.sorting ?? []);
            } else {
                newSorting = updater;
            }
            if (!isEqual(tableState.sorting, newSorting)) {
                setTableState((prev) => ({
                    ...prev,
                    sorting: newSorting,
                }));
                onSorterChange?.(newSorting);
            }
        },
        onPaginationChange: (updater) => {
            let newPagination: PaginationState;
            if (typeof updater === 'function') {
                newPagination = updater(tableState.pagination ?? { pageIndex: 0, pageSize: 20 });
            } else {
                newPagination = updater;
            }
            if (!isEqual(tableState.pagination, newPagination)) {
                setTableState((prev) => ({
                    ...prev,
                    pagination: newPagination,
                }));
                containerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
                onPaginationChange?.(newPagination);
            }
        },
        onGlobalFilterChange: (updater) => {
            let newGlobalFilters;
            if (typeof updater === 'function') {
                newGlobalFilters = updater(tableState.globalFilter);
            } else {
                newGlobalFilters = updater;
            }
            if (tableState.pagination?.pageIndex !== 0) {
                table.resetPagination();
            }

            if (!isEqual(tableState.globalFilter, newGlobalFilters)) {
                setTableState((prev) => ({
                    ...prev,
                    globalFilter: newGlobalFilters,
                }));
            }
        },
        onColumnFiltersChange: (updater) => {
            let newFilters: ColumnFiltersState;

            if (typeof updater === 'function') {
                newFilters = updater(tableState.columnFilters ?? []);
            } else {
                newFilters = updater;
            }
            if (!isEqual(tableState.columnFilters, newFilters)) {
                setTableState((prev) => ({
                    ...prev,
                    columnFilters: newFilters,
                    pagination: {
                        ...prev.pagination,
                        pageIndex: 0,
                        pageSize: prev.pagination?.pageSize ?? 20,
                    },
                }));
                onColumnFilterChange?.(newFilters);
            }
        },
        onColumnSizingChange: (updater) => {
            let newSizing: ColumnSizingState;
            if (typeof updater === 'function') {
                newSizing = updater(tableState.columnSizing ?? {});
            } else {
                newSizing = updater;
            }
            if (!isEqual(tableState.columnSizing, newSizing)) {
                setTableState((prev) => ({
                    ...prev,
                    columnSizing: newSizing,
                }));
                onColumnSizingChange?.(newSizing);
            }
        },
        onRowSelectionChange: (updater) => {
            let newRowsSelection: RowSelectionState;
            if (typeof updater === 'function') {
                newRowsSelection = updater(tableState.rowSelection ?? {});
            } else {
                newRowsSelection = updater;
            }
            if (!isEqual(tableState.rowSelection, newRowsSelection)) {
                setTableState((prev) => ({
                    ...prev,
                    rowSelection: newRowsSelection,
                }));
            }
        },
        onStateChange: (updater) => {
            let newState: TableState;
            if (typeof updater === 'function') {
                newState = updater((tableState ?? {}) as TableState);
            } else {
                newState = updater;
            }

            if (!isEqual(tableState, newState)) {
                setTableState((prev) => ({
                    ...prev,
                    ...newState,
                }));
            }
        },
        getCoreRowModel: getCoreRowModel(),
        ...('dataSource' in props
            ? {
                  pageCount: Math.ceil((data?.data?.length || 0) / (tableState.pagination?.pageSize ?? 20)),
                  getSortedRowModel: getSortedRowModel(),
                  getFilteredRowModel: getFilteredRowModel(),
                  getPaginationRowModel: getPaginationRowModel(),
              }
            : {
                  pageCount: pageCount ?? -1,
                  manualPagination: true,
                  manualSorting: true,
                  manualFiltering: true,
              }),
    });

    // Get the last pinned column index
    const lastPinnedColumnIndex = table.getLeftLeafColumns().length - 1;

    const hasFilter = showFilter;

    const { rows } = table.getRowModel();
    const allColumns = table.getAllColumns();

    const rowVirtualizer = useVirtualizer({
        count: data?.data.length ?? 0,
        getScrollElement: () => containerRef?.current || null,
        estimateSize: () => 56,
        overscan: 0,
        getItemKey: useCallback(
            (index: number) => {
                return `${rows[index]?.original?._id ?? index}`;
            },
            [rows],
        ),
    });

    const columnVirtualizer = useVirtualizer({
        horizontal: true,
        count: allColumns.length,
        getScrollElement: () => containerRef?.current || null,
        estimateSize: () => 200,
        overscan: 0,
        rangeExtractor: useCallback((range: Range) => {
            const next = new Set([0, 1, ...defaultRangeExtractor(range)]);

            return [...next];
        }, []),
        getItemKey: useCallback(
            (index: number) => {
                return `${allColumns[index]?.id ?? index}`;
            },
            [allColumns],
        ),
    });

    useDeepCompareEffect(() => {
        containerRef.current?.scrollTo({ top: 0, left: 0, behavior: 'smooth' });
        simpleBarRef.current?.recalculate();
    }, [columnKeys]);

    const virtualRows = rowVirtualizer.getVirtualItems();

    const [paddingTop, paddingBottom] =
        virtualRows.length > 0
            ? [
                  Math.max(0, virtualRows[0]?.start || 0),
                  Math.max(0, rowVirtualizer.getTotalSize() - (virtualRows[virtualRows.length - 1]?.end || 0)),
              ]
            : [0, 0];

    useEffect(() => {
        let columnOrder: string[] = [];
        if (props.columnOrder && props.columnOrder.length !== 0) {
            const columnIds = columns.map((column) => column.id as string);
            const notExistInPropsOrder = columnIds.filter((elem) => props.columnOrder?.indexOf(elem) === -1);
            columnOrder = [...new Set([...notExistInPropsOrder, ...props.columnOrder])];
        } else {
            columnOrder = columns.map((column) => column.id as string);
        }
        /**
         * TODO: support pin right and left
         */
        const columnPinning = {
            left: columns
                .filter((column) => column.meta?.identifier ?? column.enablePinning)
                .map((column) => column.accessorKey) as string[],
        };

        if (columnPinning.left.length > 0) {
            // move left pinned columns to start of columnOrder, and remove duplicated value
            columnOrder = [...new Set([...columnPinning.left, ...columnOrder])];
        }

        table.setState((prev) => ({
            ...prev,
            ...(table.getState().globalFilter !== (props.globalFilter || undefined) && {
                globalFilter: props.globalFilter,
                pagination: { pageIndex: 0, pageSize: prev.pagination?.pageSize ?? 20 },
            }),
            ...(!isEqual(table.getState().columnOrder, columnOrder) && { columnOrder: columnOrderChangeable ? columnOrder : [] }),
            ...(!isEqual(table.getState().columnSizing, props.columnSizing) && { columnSizing: props.columnSizing ?? {} }),
            ...(!isEqual(table.getState().columnPinning, columnPinning) && { columnPinning }),
        }));
        // reset pending updates
        setPendingUpdates({});
    }, [props.globalFilter, props.columnOrder, props.columnSizing, columns, columnOrderChangeable, table]);

    useEffect(() => {
        if (!containerRef.current) return;

        const resizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                setContainerRect(entry.target.getBoundingClientRect());
            }
        });

        resizeObserver.observe(containerRef.current);

        return () => {
            resizeObserver.disconnect();
        };
    }, [props.globalFilter, props.columnOrder, props.columnSizing, columns, columnOrderChangeable, table]);

    useImperativeHandle(ref, () => ({
        addNewRecord: () => {
            if (data?.data.filter((sData) => sData.id === 'new').length === 0) {
                // only allow one new record at a time
                const previousData = queryClient.getQueryData(tableQueryKey) as Response<D>;

                const tmp = { ...previousData, data: [{ id: 'new' } as D, ...previousData.data] };
                queryClient.setQueryData(tableQueryKey, tmp);
            }
        },
        refresh: () => {
            refetch();
        },
        reset: () => {
            table.reset();
        },
        resetPagination: () => {
            if (tableState.pagination?.pageIndex !== 0) {
                table.resetPagination();
                return;
            }
            refetch();
        },
        getSelectedRows: table.getSelectedRowModel().flatRows,
        resetRowSelection: () => {
            setTableState((prev) => ({
                ...prev,
                rowSelection: {},
            }));
        },
        removeRowSelection: (recordIds: string[]) => {
            setTableState((prev) => {
                const newRowSelection = { ...prev.rowSelection };
                const idsToRemove = recordIds;

                idsToRemove.forEach((id) => {
                    delete newRowSelection[id];
                });
                return {
                    ...prev,
                    rowSelection: newRowSelection,
                };
            });
        },
        isSomeSelected: () => {
            return table.getIsSomeRowsSelected();
        },
        getFilterState: () => {
            return tableState.columnFilters;
        },
        resetFilterState: () => {
            table.setColumnFilters([]);
        },
        cacheMutation,
        setColumnFilters: (filters: ColumnFiltersState) => {
            table.setColumnFilters(filters);
        },
        getRowModel: () => table.getRowModel(),
        handleDataUpdate: (updateData: any) => {
            table.options.meta?.updateData(updateData);
        },
        handleDataDelete: handleDataDelete,
        updateContainerRect: updateContainerRect,
    }));

    const cellWidths = table.getHeaderGroups()[0].headers.map((header) => {
        return getCorrectSize({
            currentSize: header.getSize(),
            size: header.column.columnDef.size,
            maxSize: header.column.columnDef.maxSize,
            minSize: header.column.columnDef.minSize,
            fullWidth,
        });
    });
    
    const getPinnedColumnsWidth = useMemo(() => {
        if (lastPinnedColumnIndex < 0) return 0;

        return cellWidths.slice(0, lastPinnedColumnIndex + 1).reduce((sum, width) => {
            // Parse the numeric value from the width string
            const numericWidth = parseInt(width, 10);
            return sum + (isNaN(numericWidth) ? 0 : numericWidth);
        }, 0);
    }, [cellWidths, lastPinnedColumnIndex]);

    const renderPinnedBorder = () => {
        if (!table.getAllColumns().length || getPinnedColumnsWidth === 0 || !outlined || !containerRect) return null;

        return (
            <div
                style={{
                    width: `${getPinnedColumnsWidth}px`,
                    position: 'fixed',
                    height: containerRect.height,
                    border: 'none',
                    borderRight: '1px solid #135DD5',
                    left: containerRect.left,
                    top: containerRect.top,
                    zIndex: 1,
                }}
            />
        );
    };

    const handleDataDelete = useCallback(
        async (rowId: string | string[]) => {
            const result = await onDataDelete?.(rowId);
            if (result) {
                cacheMutation({
                    operation: 'Delete',
                    rowId,
                });
            }
            return true;
        },
        [onDataDelete, cacheMutation],
    );

    const renderThead = useCallback(() => {
        const gridStyles = {
            display: 'grid',
            gridTemplateColumns: cellWidths?.map((cellWidth) => cellWidth).join(' '),
        };

        return (
            <div className={styles.thead}>
                <HeaderWrapper<D>
                    headerGroups={table.getHeaderGroups()}
                    table={table}
                    columnOrderChangeable={columnOrderChangeable}
                    style={gridStyles}
                    containerRef={containerRef}
                    containerHeight={containerHeight}
                    lastPinnedColumnIndex={outlined ? lastPinnedColumnIndex : -1}
                />
            </div>
        );
    }, [table, columnOrderChangeable, cellWidths, containerHeight]);

    const renderTbody = useCallback(() => {
        return (
            <div
                className={styles.tbody}
                style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    position: 'relative',
                }}
            >
                {paddingTop > 0 && (
                    <div>
                        <div style={{ height: `${paddingTop}px` }} />
                    </div>
                )}
                {virtualRows.map((virtualRow) => {
                    const row = rows[virtualRow.index] as RowType<D>;
                    if (!row) {
                        return null;
                    }
                    return (
                        <Row<D>
                            key={row.original._id ?? row.id}
                            row={row}
                            rowSelection={tableState.rowSelection}
                            index={virtualRow.index}
                            cellWidths={cellWidths}
                            isDataDeletable={isDataDeletable}
                            deleteTooltip={deleteTooltip}
                            onDataDelete={onDataDelete && handleDataDelete}
                            deleteButtonText={deleteButtonText}
                            disableHoverEffect={disableHoverEffect}
                            rowVirtualizer={rowVirtualizer}
                            columnVirtualizer={columnVirtualizer}
                            customContextMenu={customContextMenu}
                            lastPinnedColumnIndex={outlined ? lastPinnedColumnIndex : -1}
                        />
                    );
                })}
                {paddingBottom > 0 && (
                    <div>
                        <div style={{ height: `${paddingBottom}px` }} />
                    </div>
                )}
            </div>
        );
    }, [
        rows,
        cellWidths,
        handleDataDelete,
        isDataDeletable,
        deleteTooltip,
        virtualRows,
        deleteButtonText,
        disableHoverEffect,
        onDataDelete,
        rowVirtualizer,
        columnVirtualizer,
        paddingTop,
        paddingBottom,
        tableState.rowSelection,
        customContextMenu,
    ]);

    const renderTfoot = useCallback(() => {
        return (
            <div className={styles.tfoot}>
                {table.getFooterGroups().map((footerGroup) => (
                    <div className={styles.row} key={footerGroup.id}>
                        {footerGroup.headers.map((header) => (
                            <div key={header.id}>
                                {header.isPlaceholder ? null : flexRender(header.column.columnDef.footer, header.getContext())}
                            </div>
                        ))}
                    </div>
                ))}
            </div>
        );
    }, [table]);
    
    if (columnOrderChangeable) {
        return (
            <Space
                size={10}
                align="stretch"
                direction="vertical"
                style={{
                    height: `calc(100vh - ${table.getAllColumns().length === 0 ? '140px' : '270px'})`,
                    width: '100%',
                    position: 'relative',
                    ...containerStyle,
                }}
            >
                {hasFilter && (
                    <Filters<D>
                        table={table}
                        columnFilters={tableState.columnFilters}
                        customFilter={customFilter}
                        extra={filterExtra}
                        {...filterProps}
                    />
                )}
                <SimpleBar
                    ref={simpleBarRef}
                    className={`${styles.container} ${outlined ? styles.outlined : ''}`}
                    scrollableNodeProps={{
                        ref: (ele?: HTMLDivElement) => {
                            if (ele) {
                                if (ele.getBoundingClientRect()?.height !== containerHeight) {
                                    setContainerHeight(ele.getBoundingClientRect()?.height);
                                }
                                containerRef.current = ele;
                            }
                        },
                    }}
                    autoHide
                >
                    {renderPinnedBorder()}
                    <div className={`${styles.tableContainer} ${data?.data.length === 0 ? styles.empty : ''}`}>
                        <div className={`${isFetching ? styles.blur : ''}`}>
                            <div
                                className={styles.flexibleTable}
                                style={{
                                    width: `${table.getTotalSize()}px`,
                                }}
                            >
                                {renderThead()}
                                {renderTbody()}
                                {renderTfoot()}
                            </div>
                        </div>
                    </div>
                </SimpleBar>

                {data?.data.length === 0 && (
                    <div
                        className={styles.emptyContainer}
                        style={{
                            top: `calc(100% - ${containerHeight - 13}px)`,
                            maxHeight: containerHeight - 70,
                        }}
                    >
                        <Scrollbars autoHide>
                            <div className={styles.empty}>
                                <Illustration
                                    name={typeof emptyImage === 'function' ? emptyImage(tableState) || 'recordMissing' : emptyImage}
                                    description={typeof emptyMessage === 'function' ? emptyMessage(tableState) : emptyMessage}
                                />
                            </div>
                        </Scrollbars>
                    </div>
                )}

                {isFetching && (
                    <div className={styles.loadingContainer}>
                        <CircularProgress size={'25px'} />
                    </div>
                )}
                <Pagination<D> table={table} pagination={tableState.pagination ?? { pageIndex: 0, pageSize: 20 }} style={paginationStyle} />
            </Space>
        );
    }

    return (
        <Space
            size={10}
            align="stretch"
            direction="vertical"
            style={{
                width: '100%',
                position: 'relative',
                height: `calc(100vh - ${table.getAllColumns().length === 0 ? '140px' : '270px'})`,
                ...containerStyle,
            }}
        >
            {hasFilter && (
                <Filters<D>
                    table={table}
                    columnFilters={tableState.columnFilters}
                    customFilter={customFilter}
                    extra={filterExtra}
                    {...filterProps}
                />
            )}
            <SimpleBar
                className={`${styles.container} ${outlined ? styles.outlined : ''}`}
                scrollableNodeProps={{
                    ref: (ele?: HTMLDivElement) => {
                        if (ele) {
                            if (ele.getBoundingClientRect()?.height !== containerHeight) {
                                setContainerHeight(ele.getBoundingClientRect()?.height);
                            }
                            containerRef.current = ele;
                        }
                    },
                }}
                autoHide
                style={{ position: 'relative' }}
            >
                {renderPinnedBorder()}
                <div className={`${styles.tableContainer} ${data?.data.length === 0 ? styles.empty : ''}`}>
                    <div className={`${isFetching ? styles.blur : ''}`}>
                        <div
                            className={styles.flexibleTable}
                            style={{
                                width: `${table.getTotalSize()}px`,
                            }}
                        >
                            {renderThead()}
                            {renderTbody()}
                            {renderTfoot()}
                        </div>
                    </div>
                </div>
            </SimpleBar>
            {data?.data.length === 0 && (
                <div
                    className={styles.emptyContainer}
                    style={{
                        top: `calc(100% - ${containerHeight - 13}px)`,
                        maxHeight: containerHeight - 70,
                    }}
                >
                    <Scrollbars autoHide>
                        <div className={styles.empty}>
                            <Illustration
                                name={typeof emptyImage === 'function' ? emptyImage(tableState) || 'recordMissing' : emptyImage}
                                description={typeof emptyMessage === 'function' ? emptyMessage(tableState) : emptyMessage}
                            />
                        </div>
                    </Scrollbars>
                </div>
            )}
            {isFetching && (
                <div className={styles.loadingContainer}>
                    <CircularProgress size={'25px'} />
                </div>
            )}
            <Pagination<D> table={table} pagination={tableState.pagination ?? { pageIndex: 0, pageSize: 20 }} style={paginationStyle} />
        </Space>
    );
};
export default React.forwardRef(FlexibleTable);
