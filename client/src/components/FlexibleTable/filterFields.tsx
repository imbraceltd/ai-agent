import { Icon, Typography } from '@imbrace/ui';
import type { Column, ColumnDef, Header } from '@tanstack/react-table';
import { useState } from 'react';

import type { FilterValue } from './filterPopover';
import { useFilterPopover } from './filterPopover';
import styles from './index.module.scss';
import type { ColumnType, ColumnValue } from './types';

const FilterFields = <D extends { id: string }>({
    column,
    header,
    onFilter,
}: {
    column: Column<D, unknown>;
    header: Header<D, ColumnValue>;
    onFilter?: (filter?: { id: string; value: FilterValue }) => void;
}) => {
    const [open, setOpen] = useState(false);
    const columnDef = column.columnDef as ColumnDef<D, ColumnValue> & ColumnType;
    const columnFilterValue = column.getFilterValue() as FilterValue;
    const headerText = typeof columnDef.header === 'function' ? columnDef.header(header.getContext()) : columnDef.header;

    const [{ openFilterPopover }, holder] = useFilterPopover<D>();

    return (
        <div
            key={`filter-${column.id}`}
            className={styles.filterField}
            onClick={(e) => {
                setOpen(true);
                openFilterPopover({
                    column: columnDef,
                    anchorEl: e.currentTarget,
                    title: headerText,
                    type: column.columnDef.meta?.type,
                    onFilter: async (filterValue) => {
                        if (filterValue?.operator !== 'is_empty' && filterValue?.operator !== 'is_not_empty') {
                            if (filterValue?.value === '') {
                                return;
                            }
                            if (
                                Array.isArray(filterValue?.value) &&
                                filterValue?.value.some((v) => v === '' || v === null || v === undefined)
                            ) {
                                return;
                            }
                        }
                        if (filterValue) {
                            onFilter?.({ id: column.id, value: filterValue });
                        }
                    },
                    initialValue: {
                        operator: columnFilterValue?.operator,
                        value:
                            column.columnDef.meta?.type === 'MultipleSelection'
                                ? ((columnFilterValue?.value ?? []) as string[])
                                : column.columnDef.meta?.type === 'Date'
                                ? ((columnFilterValue?.value ?? ['exactly']) as string[])
                                : ((columnFilterValue?.value ?? '') as string),
                    },
                    valueEnum: column.columnDef.meta?.enum,
                    onClose: () => {
                        setOpen(false);
                    },
                });
            }}
        >
            {holder}
            <Typography style={{ flex: 1 }}>{headerText}</Typography>
            <div>
                <Icon name={open ? 'dropUp' : 'dropDown'} style={{ fontSize: 24 }} />
            </div>
        </div>
    );
};

export default FilterFields;
