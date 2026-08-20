import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import { monitorForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import type { Edge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { getReorderDestinationIndex } from '@atlaskit/pragmatic-drag-and-drop-hitbox/util/get-reorder-destination-index';
import { EllipsisText, Icon, Tooltip, Typography } from '@imbrace/ui';
import type { Header, HeaderGroup, Table } from '@tanstack/react-table';
import { flexRender } from '@tanstack/react-table';
import type { CSSProperties, MutableRefObject } from 'react';
import { useCallback, useEffect, useState } from 'react';
import invariant from 'tiny-invariant';

import { typedMemo } from '@/utils';

import DraggableColumnHeader from './draggableColumnHeader';
import styles from './index.module.scss';
import type { ColumnValue } from './types';

interface HeaderRowProps<D> {
    headerGroup: HeaderGroup<D>;
    columnOrderChangeable?: boolean;
    isAllRowSelected?: boolean;
    isSomeRowSelected?: boolean;
    instanceId: symbol;
    containerHeight: number;
    lastPinnedColumnIndex: number;
}

export const HeaderWrapper = <D extends { id: string }>({
    headerGroups,
    table,
    style,
    columnOrderChangeable,
    containerRef,
    containerHeight,
    lastPinnedColumnIndex,
}: {
    headerGroups: HeaderGroup<D>[];
    table: Table<D>;
    style: CSSProperties;
    columnOrderChangeable?: boolean;
    containerRef: MutableRefObject<HTMLDivElement | undefined>;
    containerHeight: number;
    lastPinnedColumnIndex: number;
}) => {
    const [instanceId] = useState(() => Symbol('FlexibleTableHeader'));
    const { getState, setColumnOrder } = table;
    const { columnOrder } = getState();
    const reorderColumn = useCallback(
        ({ startIndex, finishIndex }: { startIndex: number; finishIndex: number }) => {
            const newColumn = [...columnOrder];
            newColumn.splice(finishIndex, 0, newColumn.splice(startIndex, 1)[0]);
            setTimeout(() => setColumnOrder(newColumn), 0);
        },
        [columnOrder, setColumnOrder],
    );

    useEffect(() => {
        return combine(
            monitorForElements({
                canMonitor({ source }) {
                    return !!columnOrderChangeable && source.data.instanceId === instanceId;
                },
                onDrop: (args) => {
                    const { location, source } = args;
                    // didn't drop on anything
                    if (!location.current.dropTargets.length) {
                        return;
                    }

                    const itemId = source.data.itemId;
                    invariant(typeof itemId === 'string');
                    const itemIndex = columnOrder.indexOf(itemId);

                    if (location.current.dropTargets.length === 1) {
                        const [destinationItem] = location.current.dropTargets;
                        const indexOfTarget = columnOrder.indexOf(destinationItem.data.itemId as string);
                        const closestEdgeOfTarget: Edge | null = extractClosestEdge(destinationItem.data);
                        const destinationIndex = getReorderDestinationIndex({
                            startIndex: itemIndex,
                            indexOfTarget: indexOfTarget,
                            closestEdgeOfTarget,
                            axis: 'horizontal',
                        });

                        reorderColumn({
                            startIndex: itemIndex,
                            finishIndex: destinationIndex,
                        });

                        return;
                    }
                },
            }),
        );
    }, [instanceId, columnOrderChangeable, reorderColumn, columnOrder, containerRef]);

    return (
        <>
            {headerGroups.map((headerGroup) => (
                <div key={headerGroup.id} className={styles.row} style={style}>
                    <HeaderRow<D>
                        headerGroup={headerGroup}
                        columnOrderChangeable={columnOrderChangeable}
                        isAllRowSelected={table.getIsAllRowsSelected()}
                        isSomeRowSelected={table.getIsSomeRowsSelected()}
                        instanceId={instanceId}
                        containerHeight={containerHeight}
                        lastPinnedColumnIndex={lastPinnedColumnIndex}
                    />
                </div>
            ))}
        </>
    );
};

const HeaderRow = <D extends { id: string }>(props: HeaderRowProps<D>) => {
    const { headerGroup, columnOrderChangeable, instanceId, containerHeight, lastPinnedColumnIndex } = props;
    const [canDrag, setCanDrag] = useState(true);

    const renderHeader = useCallback((header: Header<D, unknown>) => {
        if (header.isPlaceholder) {
            return null;
        }

        const headerValue = flexRender(header.column.columnDef.header, header.getContext());

        if (
            header.column.columnDef.header &&
            typeof header.column.columnDef.header === 'function' &&
            typeof header.column.columnDef.header(header.getContext()) === 'object'
        ) {
            return headerValue;
        }

        return (
            <EllipsisText
                text={flexRender(header.column.columnDef.header, header.getContext())}
                element={
                    <Typography
                        variant="SubHeading2"
                        style={{
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            wordBreak: 'break-word',
                        }}
                    />
                }
            />
        );
    }, []);

    return (
        <>
            {headerGroup.headers.map((header) => {
                return columnOrderChangeable ? (
                    <DraggableColumnHeader<D>
                        key={header.id}
                        header={header as Header<D, ColumnValue>}              
                        canDrag={canDrag}
                        setCanDrag={setCanDrag}
                        disableDrag={header.column.columnDef.meta?.disableOrdering ?? false}
                        instanceId={instanceId}
                        containerHeight={containerHeight}
                        lastPinnedColumnIndex={lastPinnedColumnIndex}
                    />
                ) : (
                    <div
                        key={header.id}
                        className={`${styles.cell} ${header.column.getIsPinned() ? styles.sticky : ''}`}
                        style={
                            header.column.getIsPinned()
                                ? {
                                      left: header.column.getStart(),
                                      borderRight: lastPinnedColumnIndex === header.column.getIndex() ? '1px solid #135dd5' : 'none',
                                  }
                                : {}
                        }
                    >
                        <div>
                            <div className={styles.content} style={header.column.columnDef.meta?.headerStyle}>
                                {renderHeader(header)}
                            </div>
                            {header.column.columnDef.meta?.tooltip && (
                                <Tooltip placement="top" arrow title={header.column.columnDef.meta?.tooltip}>
                                    <div className={styles.description}>
                                        <Icon name="info" style={{ fontSize: '16px', color: 'var(--color-light-4)' }} />
                                    </div>
                                </Tooltip>
                            )}
                            {header.column.getCanSort() && (
                                <div className={styles.sorter} onClick={header.column.getToggleSortingHandler()}>
                                    <Icon
                                        name="sort"
                                        namespace="twoTone"
                                        primaryColor={header.column.getIsSorted() === 'desc' ? 'var(--color-primary-1)' : 'currentColor'}
                                        secondaryColor={header.column.getIsSorted() === 'asc' ? 'var(--color-primary-1)' : 'currentColor'}
                                    />
                                </div>
                            )}
                            {header.column.getCanResize() && (
                                <div
                                    onMouseDown={header.getResizeHandler()}
                                    onTouchStart={header.getResizeHandler()}
                                    className={`${styles.resizer} ${header.column.getIsResizing() ? styles.isResizing : ''}`}
                                />
                            )}
                        </div>
                    </div>
                );
            })}
        </>
    );
};

export default typedMemo(HeaderRow);
