import { DropdownMenu, DropdownMenuItem, Tooltip, Typography } from '@imbrace/ui';
import { CircularProgress } from '@mui/material';
import type { CellContext, ColumnDefTemplate, Row as RowType, RowSelectionState } from '@tanstack/react-table';
import type { Virtualizer } from '@tanstack/react-virtual';
import type { CSSProperties, MouseEvent, ReactNode } from 'react';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { typedMemo } from '@/utils';

import Cell from './cell';
import styles from './index.module.scss';

const Row = <D extends { id: string }>({
    row,
    cellWidths,
    onDataDelete,
    isDataDeletable,
    deleteTooltip,
    deleteButtonText,
    disableHoverEffect,
    rowVirtualizer,
    columnVirtualizer,
    index,
    rowSelection,
    customContextMenu,
    lastPinnedColumnIndex,
    
}: {
    row: RowType<D>;
    cellWidths?: string[];
    onDataDelete?: (rowId: string | string[]) => Promise<boolean>;
    isDataDeletable?: (row: D) => boolean;
    deleteTooltip?: (row: D) => string | undefined;
    deleteButtonText?: string;
    disableHoverEffect?: boolean;
    rowVirtualizer: Virtualizer<HTMLDivElement, Element>;
    columnVirtualizer: Virtualizer<HTMLDivElement, Element>;
    index: number;
    rowSelection?: RowSelectionState;
    customContextMenu?: (row: RowType<D>, rowSelection?: RowSelectionState) => ReactNode;
    lastPinnedColumnIndex: number;
}) => {
    const { t } = useTranslation();
    const [contextMenu, setContextMenu] = useState<{
        mouseX: number;
        mouseY: number;
    } | null>(null);
    const [deleting, setDeleting] = useState(false);
    const [isHover, setIsHover] = useState(false);
    const allCells = row.getVisibleCells();
    const virtualColumns = columnVirtualizer.getVirtualItems();
    const isMultipleSelection = rowSelection ? Object.keys(rowSelection).length > 1 : false;

    const handleContextMenu = (event: MouseEvent) => {
        event.preventDefault();

        setContextMenu(
            contextMenu === null
                ? {
                      mouseX: event.clientX + 2,
                      mouseY: event.clientY - 6,
                  }
                : // repeated contextmenu when it is already open closes it with Chrome 84 on Ubuntu
                  // Other native context menus might behave different.
                  // With this behavior we prevent contextmenu from the backdrop to re-locale existing context menus.
                  null,
        );
    };

    const handleClose = () => {
        setContextMenu(null);
    };

    const handleDelete = async () => {
        try {
            setDeleting(true);
            await onDataDelete?.(isMultipleSelection && row.getIsSelected() && rowSelection ? Object.keys(rowSelection) : row.original.id);
            setContextMenu(null);
            setDeleting(false);
        } catch (error) {
            setContextMenu(null);
            setDeleting(false);
        }
    };

    const gridStyles = useMemo(
        () =>
            ({
                minHeight: '56px',
                display: 'grid',
                gridTemplateColumns: `${cellWidths?.map((cellWidth) => cellWidth).join(' ')}`,
                gridTemplateAreas: `"${cellWidths?.map((cellWidth, cellIndex) => `column-${cellIndex + 1}`).join(' ')}"`,
            } as CSSProperties),
        [cellWidths],
    );

    const defaultDeleteButtonText = isMultipleSelection && row.getIsSelected() ? t('delete_multiple_records') : t('delete_record');

    return (
        <div
            ref={rowVirtualizer?.measureElement}
            data-index={index}
            className={`${styles.row} ${index % 2 !== 0 ? styles.evenBackground : ''} ${row.getIsSelected() || row.original.id === 'new' ? styles.selected : ''} ${
                disableHoverEffect ? styles.disabledHoverEffect : ''
            }`}
            style={gridStyles}
            onMouseEnter={() => {
                setIsHover(true);
            }}
            onMouseLeave={() => {
                setIsHover(false);
            }}
            {...((!!onDataDelete || !!customContextMenu) && { onContextMenu: handleContextMenu })}
        >
            {virtualColumns.map((virtualColumn) => {
                const cell = allCells[virtualColumn.index];
                if (!cell) {
                    return null;
                }
                const { table } = cell.getContext();
                const cellColumn = cell.column;
                return (
                    <Cell
                        key={`${cell.id}-${row.original.id}`}
                        renderCell={cell.column.columnDef.cell as ColumnDefTemplate<Partial<CellContext<D, unknown>>>}
                        row={row}
                        table={table}
                        cellId={cell.id}
                        cell={cell}
                        isHover={isHover}
                        isRowSelected={row.getIsSelected()}
                        columnVirtualizer={columnVirtualizer}
                        index={virtualColumn.index}
                        style={
                            cellColumn?.getIsPinned()
                                ? {
                                      position: 'sticky',
                                      zIndex: 1,
                                      left: cellColumn?.getStart(),
                                      gridArea: `column-${virtualColumn.index + 1}`,
                                      borderRight: lastPinnedColumnIndex === cellColumn?.getIndex() ? '1px solid #135dd5' : 'none',
                                      backgroundColor: index % 2 !== 0 ?'#F2F2F2' : 'white'
                                  }
                                : {
                                      gridArea: `column-${virtualColumn.index + 1}`,
                                  }
                        }
                    />
                );
            })}
            <DropdownMenu
                open={contextMenu !== null}
                onClose={handleClose}
                anchorReference="anchorPosition"
                anchorPosition={contextMenu !== null ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
            >
                {customContextMenu ? (
                    customContextMenu(row, rowSelection)
                ) : deleteTooltip?.(row.original) ? (
                    <Tooltip arrow title={deleteTooltip?.(row.original)} placement="top">
                        <div>
                            <DropdownMenuItem
                                onClick={handleDelete}
                                sx={{
                                    position: 'relative',
                                    color: 'var(--color-danger-1)',
                                }}
                                disabled={deleting || !isDataDeletable?.(row.original)}
                            >
                                {deleting && (
                                    <div className={styles.deleteLoadingContainer}>
                                        <CircularProgress size={20} sx={{ color: 'rgba(0, 0, 0, 0.26)' }} />
                                    </div>
                                )}
                                <Typography>{deleteButtonText ? deleteButtonText : defaultDeleteButtonText}</Typography>
                            </DropdownMenuItem>
                        </div>
                    </Tooltip>
                ) : (
                    <DropdownMenuItem
                        onClick={handleDelete}
                        sx={{
                            position: 'relative',
                            color: 'var(--color-danger-1)',
                        }}
                        disabled={deleting || !isDataDeletable?.(row.original)}
                    >
                        {deleting && (
                            <div className={styles.deleteLoadingContainer}>
                                <CircularProgress size={20} sx={{ color: 'rgba(0, 0, 0, 0.26)' }} />
                            </div>
                        )}
                        <Typography>{deleteButtonText ? deleteButtonText : defaultDeleteButtonText}</Typography>
                    </DropdownMenuItem>
                )}
            </DropdownMenu>
        </div>
    );
};

export default typedMemo(Row);
