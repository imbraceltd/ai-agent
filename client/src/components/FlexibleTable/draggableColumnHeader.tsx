import { combine } from '@atlaskit/pragmatic-drag-and-drop/combine';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { setCustomNativeDragPreview } from '@atlaskit/pragmatic-drag-and-drop/element/set-custom-native-drag-preview';
import type { Edge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { attachClosestEdge, extractClosestEdge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { EllipsisText, Icon, Tooltip, Typography } from '@imbrace/ui';
import type { Header } from '@tanstack/react-table';
import { flexRender } from '@tanstack/react-table';
import clsx from 'clsx';
import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import invariant from 'tiny-invariant';

import { typedMemo } from '@/utils';

import styles from './index.module.scss';
import type { ColumnValue } from './types';
import SortIcon from './sort';
interface DraggableColumnHeaderProps<D> {
    header: Header<D, ColumnValue>;
    canDrag: boolean;
    setCanDrag: (canDrag: boolean) => void;
    disableDrag?: boolean;
    instanceId: symbol;
    containerHeight: number;
    lastPinnedColumnIndex: number;
}
type State = { type: 'idle' } | { type: 'preview'; container: HTMLElement; rect?: DOMRect } | { type: 'dragging' };

const idleState: State = { type: 'idle' };
const draggingState: State = { type: 'dragging' };

const DraggableColumnHeader = <D extends { id: string }>({
    header,
    disableDrag,
    canDrag,
    setCanDrag,
    instanceId,
    containerHeight,
    lastPinnedColumnIndex,
}: DraggableColumnHeaderProps<D>) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [state, setState] = useState<State>(idleState);
    const { column } = header;
    const order = column.getIsSorted();
    const [closestEdge, setClosestEdge] = useState<Edge | null>(null);

    const isDraggable = !disableDrag && canDrag && column.id !== 'rowIndex';

    useEffect(() => {
        const element = containerRef.current;
        invariant(element);
        return combine(
            draggable({
                element,
                canDrag: () => isDraggable,
                getInitialData: () => ({ itemId: column.id, instanceId }),
                onGenerateDragPreview: ({ location, nativeSetDragImage, source }) => {
                    const rect = source.element.getBoundingClientRect();

                    setCustomNativeDragPreview({
                        nativeSetDragImage,
                        getOffset: () => ({
                            x: location.current.input.clientX - (rect?.left ?? 0),
                            y: location.current.input.clientY - (rect?.top ?? 0),
                        }),
                        render({ container }) {
                            setState({ type: 'preview', container, rect });
                            return () => setState(draggingState);
                        },
                    });
                },

                onDragStart: () => {
                    setState(draggingState);
                },
                onDrop: () => {
                    setState(idleState);
                },
            }),
            dropTargetForElements({
                element,
                canDrop: ({ source }) => {
                    return source.data.instanceId === instanceId && isDraggable;
                },
                getIsSticky: () => true,
                getData: ({ input, element: sourceElement }) => {
                    const data = { itemId: column.id };

                    return attachClosestEdge(data, {
                        input,
                        element: sourceElement,
                        allowedEdges: ['left', 'right'],
                    });
                },
                onDragEnter: (args) => {
                    if (args.source.data.itemId !== column.id && isDraggable) {
                        setClosestEdge(extractClosestEdge(args.self.data));
                    }
                },
                onDrag: ({ self, source }) => {
                    if (source.data.itemId !== column.id && isDraggable) {
                        setClosestEdge(extractClosestEdge(self.data));
                    }
                },
                onDragLeave: () => {
                    setClosestEdge(null);
                },
                onDrop: () => {
                    setClosestEdge(null);
                },
            }),
        );
    }, [instanceId, column.id, disableDrag, canDrag, isDraggable]);

    const renderHeader = useCallback(() => {
        if (header.isPlaceholder) {
            return null;
        }

        const headerValue = flexRender(column.columnDef.header, header.getContext());

        if (
            column.columnDef.header &&
            typeof column.columnDef.header === 'function' &&
            typeof column.columnDef.header(header.getContext()) === 'object'
        ) {
            return headerValue;
        }

        return (
            <EllipsisText
                text={flexRender(column.columnDef.header, header.getContext())}
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
    }, [column.columnDef, header]);

    return (
        <>
            <div
                className={`${styles.cell} ${column.getIsPinned() ? styles.sticky : ''} ${isDraggable ? styles.draggable : ''} ${
                    state.type === 'dragging' ? styles.isDragging : ''
                }`}
                style={
                    column.getIsPinned()
                        ? { left: column.getStart(), borderRight: lastPinnedColumnIndex === column.getIndex() ? '1px solid #135dd5' : 'none' }
                        : {}
                }
            >
                <div ref={containerRef} className={state.type === 'dragging' ? styles.isDragging : ''}>
                    <div className={styles.content} style={column.columnDef.meta?.headerStyle}>
                        {renderHeader()}
                    </div>
                    {column.columnDef.meta?.tooltip && (
                        <Tooltip placement="top" arrow title={column.columnDef.meta?.tooltip}>
                            <div className={styles.description}>
                                <Icon name="info" style={{ fontSize: '16px', color: 'var(--color-light-4)' }} />
                            </div>
                        </Tooltip>
                    )}
                    {column.getCanSort() && (
                        <div className={styles.sorter} onClick={column.getToggleSortingHandler()}>
                            <SortIcon primaryColor={order === 'desc' ? 'var(--color-primary-1)' : 'currentColor'} secondaryColor={order === 'asc' ? 'var(--color-primary-1)' : 'currentColor'} />
                        </div>
                    )}
                    {column.getCanResize() && (
                        <div
                            onMouseDown={(event) => {
                                event.stopPropagation();
                                header.getResizeHandler()(event);
                                setCanDrag(false);
                            }}
                            onMouseUp={() => {
                                setCanDrag(true);
                            }}
                            onTouchStart={(event) => {
                                event.stopPropagation();
                                header.getResizeHandler()(event);
                                setCanDrag(false);
                            }}
                            onTouchEnd={() => {
                                setCanDrag(true);
                            }}
                            className={`${styles.resizer} ${column.getIsResizing() ? styles.isResizing : ''}`}
                        />
                    )}

                    {state.type === 'preview' &&
                        createPortal(
                            <div
                                className={styles.flexibleTable}
                                style={{
                                    boxSizing: 'border-box',
                                    width: state.rect?.width,
                                    height: state.rect?.height,
                                    overflow: 'hidden',
                                }}
                            >
                                <div className={styles.thead}>
                                    <div className={styles.row}>
                                        <div className={styles.cell} style={{ overflow: 'hidden' }}>
                                            <div>
                                                <div className={styles.content}>
                                                    {header.isPlaceholder ? null : (
                                                        <EllipsisText
                                                            text={flexRender(column.columnDef.header, header.getContext())}
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
                                                    )}
                                                </div>
                                                {column.getCanSort() && (
                                                    <div className={styles.sorter}>
                                                        <Icon
                                                            name="sort"
                                                            namespace="twoTone"
                                                            primaryColor={order === 'desc' ? 'var(--color-primary-1)' : 'currentColor'}
                                                            secondaryColor={order === 'asc' ? 'var(--color-primary-1)' : 'currentColor'}
                                                        />
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            </div>,
                            state.container,
                        )}
                </div>
                {closestEdge && (
                    <div
                        className={clsx(
                            styles.dropIndicator,

                            closestEdge === 'left' ? styles.left : styles.right,
                        )}
                        style={{ height: `${containerHeight}px` }}
                    ></div>
                )}
            </div>
        </>
    );
};

export default typedMemo(DraggableColumnHeader);
