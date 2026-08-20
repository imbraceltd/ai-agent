import type { Cell as CellType, CellContext, ColumnDefTemplate } from '@tanstack/react-table';
import type { Virtualizer } from '@tanstack/react-virtual';
import type { CSSProperties } from 'react';

import { typedMemo } from '@/utils';

const Cell = <D extends { id: string | number }>({
    renderCell,
    row,
    table,
    cellId,
    isHover,
    isRowSelected,
    style,
    columnVirtualizer,
    index,
    cell,
}: {
    renderCell:
        | ColumnDefTemplate<
              Partial<CellContext<D, unknown>> & { cellId: string; isHover?: boolean; isRowSelected?: boolean; cell: CellType<D, unknown> }
          >
        | undefined;
    row: CellContext<D, unknown>['row'];
    table: CellContext<D, unknown>['table'];
    cellId: string;
    isHover?: boolean;
    isRowSelected?: boolean;
    style?: CSSProperties;
    columnVirtualizer: Virtualizer<HTMLDivElement, Element>;
    index: number;
    cell: CellType<D, unknown>;
}) => {
    return (
        <div ref={columnVirtualizer.measureElement} style={style} data-index={index}>
            {typeof renderCell === 'string' ? renderCell : renderCell?.({ row, table, cellId, isHover, isRowSelected, cell })}
        </div>
    );
};

export default typedMemo(Cell);
