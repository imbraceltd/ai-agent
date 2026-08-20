import { Icon, IconButton, Space, Typography } from '@imbrace/ui';
import type { GeneralIconTypes } from '@imbrace/ui/dist/components/Icon';
import type { ColumnDef, ColumnFiltersState, Header, Table } from '@tanstack/react-table';
import type { CSSProperties, ReactNode } from 'react';
import { cloneElement, Fragment, isValidElement, useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { typedMemo } from '@/utils';

import FilteredChip from './filteredChip';
import FilterFields from './filterFields';
import { type FilterValue, useFilterPopover } from './filterPopover';
import styles from './index.module.scss';
import type { ColumnType, ColumnValue } from './types';

interface FiltersProps<D> {
    table: Table<D>;
    style?: CSSProperties;
    columnFilters?: ColumnFiltersState;
    customFilter?: (table: Table<D>) => { container?: ReactNode[]; prefix?: ReactNode } | undefined;
    extra?: (table: Table<D>) => ReactNode;
    title?: string;
    icon?: GeneralIconTypes['name'];
}

const Filters = <D extends { id: string }>({ table, style, columnFilters, customFilter, extra, title, icon }: FiltersProps<D>) => {
    const { t } = useTranslation();
    const scrollbarContainerRef = useRef<HTMLDivElement>();
    const filteredChipRefs = useRef<(HTMLDivElement | null)[]>([]);
    const [showLeft, setShowLeft] = useState(false);
    const [showRight, setShowRight] = useState(false);
    const [scrollable, setScrollable] = useState(false);
    const [{ openFilterPopover }, holder] = useFilterPopover<D>();

    const renderFilter = () => {
        return table.getHeaderGroups().map((headerGroup) => (
            <Fragment key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                    if (!header.column.getCanFilter()) {
                        return null;
                    }
                    if (header.column.getIsFiltered()) {
                        return null;
                    }
                    return (
                        <FilterFields
                            key={header.column.id}
                            column={header.column}
                            header={header as Header<D, ColumnValue>}
                            onFilter={(filter) => {
                                header.column.setFilterValue(() => filter?.value);
                            }}
                        />
                    );
                })}
            </Fragment>
        ));
    };

    const renderFilteredChip = () => {
        const filteredContext = columnFilters?.map((filter) => {
            const targetHeader = (table.getFlatHeaders() as Header<D, ColumnValue>[]).filter((header) => header.column.id === filter.id)[0];
            return {
                ...filter,
                column: table.getColumn(filter.id),
                header: targetHeader,
            };
        });
        return filteredContext?.map((context, index) => {
            if (!context.column) {
                return null;
            }
            if (!context.column.getIsFiltered()) {
                return null;
            }
            const { header, column, value } = context;
            const columnDef = column.columnDef as ColumnDef<D, ColumnValue> & ColumnType;
            const columnFilterValue = value as FilterValue;
            const headerText = typeof columnDef.header === 'function' ? columnDef.header(header.getContext()) : columnDef.header;

            return (
                <FilteredChip
                    ref={(ref) => (filteredChipRefs.current[index] = ref)}
                    key={`filter-${column.id}`}
                    header={headerText}
                    fieldType={columnDef.meta?.type}
                    value={columnFilterValue?.value}
                    operator={columnFilterValue?.operator}
                    onClick={(e) => {
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

                                column.setFilterValue(filterValue);
                            },
                            initialValue: {
                                operator: columnFilterValue?.operator,
                                value:
                                    column.columnDef.meta?.type === 'MultipleSelection'
                                        ? ((columnFilterValue?.value ?? []) as string[])
                                        : ((columnFilterValue?.value ?? '') as string),
                            },
                            valueEnum: column.columnDef.meta?.enum,
                            onClose: () => {},
                        });
                    }}
                    onDelete={() => {
                        column.setFilterValue(undefined);
                    }}
                    {...(columnDef.meta?.type === 'Assignee' && {
                        remoteEnum: columnDef.request,
                    })}
                />
            );
        });
    };

    const calculate = useCallback(() => {
        const leftDistances = filteredChipRefs.current.map((filteredChipRef) => {
            if (filteredChipRef && scrollbarContainerRef.current) {
                if (filteredChipRef.getBoundingClientRect().left < scrollbarContainerRef.current.getBoundingClientRect().left) {
                    return filteredChipRef.getBoundingClientRect().left - scrollbarContainerRef.current.getBoundingClientRect().left;
                }
            }
            return 0;
        });
        const rightDistances = filteredChipRefs.current.map((filteredChipRef) => {
            if (filteredChipRef && scrollbarContainerRef.current) {
                if (scrollbarContainerRef.current.getBoundingClientRect().right < filteredChipRef.getBoundingClientRect().right) {
                    return scrollbarContainerRef.current.getBoundingClientRect().right - filteredChipRef.getBoundingClientRect().right;
                }
            }
            return 0;
        });
        setShowLeft(leftDistances.some((distance) => distance < -1));
        setShowRight(rightDistances.some((distance) => distance < -1));
        setScrollable(
            scrollbarContainerRef.current ? scrollbarContainerRef.current?.scrollWidth > scrollbarContainerRef.current?.clientWidth : false,
        );
    }, []);

    useEffect(() => {
        calculate();
    }, [columnFilters, calculate]);

    const handleScroll = (direction: 'left' | 'right') => {
        if (!scrollbarContainerRef.current) return;

        const items = Array.from(filteredChipRefs.current);
        const currentScroll = scrollbarContainerRef.current.scrollLeft;
        const visibleWidth = scrollbarContainerRef.current.offsetWidth;

        let newScrollPosition = currentScroll;

        if (direction === 'right') {
            let accumulatedWidth = 0;
            let startIndex = -1;

            // Find the first item that is fully or partially visible on the left
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item && item.offsetLeft >= currentScroll) {
                    startIndex = i;
                    break;
                }
            }

            // If no such item is found, all items are visible, no need to scroll
            if (startIndex === -1) return;

            // Calculate the total width of items from the first visible item
            for (let i = startIndex; i < items.length; i++) {
                const item = items[i];
                if (item) {
                    accumulatedWidth += item.offsetWidth + 12;
                    if (accumulatedWidth > visibleWidth) {
                        const selectedItem = items[i];
                        // Find the item that won't be fully visible and set the new scroll position
                        newScrollPosition = (selectedItem && selectedItem.offsetLeft) || item.offsetLeft;

                        break;
                    }
                }
            }
        }

        if (direction === 'left') {
            let accumulatedWidth = 0;
            let startIndex = -1;

            // Find the first partially visible item on the left
            for (let i = 0; i < items.length; i++) {
                const item = items[i];
                if (item && item.offsetLeft + item.offsetWidth > currentScroll) {
                    startIndex = i;
                    break;
                }
            }

            // If startIndex is -1, meaning no partially visible item on the left
            if (startIndex === -1) {
                // Scroll to the very first item
                newScrollPosition = items[0] ? items[0].offsetLeft : 0;
            } else {
                newScrollPosition = 0;
            }
            // Calculate the total width of items moving backwards
            for (let i = startIndex; i >= 0; i--) {
                const item = items[i];
                if (item) {
                    accumulatedWidth += item.offsetWidth + 12;
                    if (accumulatedWidth > visibleWidth) {
                        const selectedItem = items[i];
                        if (!selectedItem) return;
                        newScrollPosition = selectedItem.offsetLeft;
                        break;
                    }
                }
            }
        }

        scrollbarContainerRef.current.scrollTo({
            left: newScrollPosition,
            behavior: 'smooth',
        });
    };

    const chevronLeftButton = scrollable && (
        <div className={`${styles.scrollChevron} ${styles.left} ${showLeft ? styles.visible : ''}`}>
            <IconButton
                disableRipple
                sx={{
                    borderRadius: 0,
                    opacity: 1,
                    background: 'rgba(255,255,255, 0.24)',
                    '& svg': { color: 'var(--color-light-4)' },
                    '&:active': {
                        background: 'var(--color-light-1)',
                        '& svg': { color: 'var(--color-primary-1)' },
                    },
                    '&:hover, &:focus': {
                        background: 'var(--color-light-1)',
                        '& svg': { color: 'var(--color-primary-6)' },
                    },
                }}
                type="secondary"
                variant="text"
                onClick={(e) => {
                    handleScroll('left');
                    if (e.currentTarget instanceof HTMLButtonElement) {
                        e.currentTarget.blur();
                    }
                }}
            >
                <Icon name="chevronLeft" style={{ fontSize: 24 }} />
            </IconButton>
        </div>
    );

    const chevronRightButton = scrollable && (
        <div className={`${styles.scrollChevron} ${styles.right} ${showRight ? styles.visible : ''}`}>
            <IconButton
                disableRipple
                sx={{
                    borderRadius: 0,
                    opacity: 1,
                    background: 'rgba(255,255,255, 0.24)',
                    '& svg': { color: 'var(--color-light-4)' },
                    '&:active': {
                        background: 'var(--color-light-1)',
                        '& svg': { color: 'var(--color-primary-1)' },
                    },
                    '&:hover, &:focus': {
                        background: 'var(--color-light-1)',
                        '& svg': { color: 'var(--color-primary-6)' },
                    },
                }}
                type="secondary"
                variant="text"
                onClick={(e) => {
                    handleScroll('right');
                    if (e.currentTarget instanceof HTMLButtonElement) {
                        e.currentTarget.blur();
                    }
                }}
            >
                <Icon name="chevronRight" style={{ fontSize: 24 }} />
            </IconButton>
        </div>
    );

    const defaultFilters = (
        <>
            <div className={styles.container}>
                {chevronLeftButton}
                <div
                    ref={(ref) => {
                        if (ref) {
                            scrollbarContainerRef.current = ref;
                            setScrollable(ref.scrollWidth > ref.clientWidth);
                        }
                    }}
                    onScroll={() => {
                        calculate();
                    }}
                    style={{ overflow: 'auto', marginBottom: '-15px' }}
                >
                    <Space style={{ flex: 1, width: '100%' }} size={12}>
                        {renderFilteredChip()}
                    </Space>
                </div>
                {chevronRightButton}
            </div>
            <Space size={12}>{renderFilter()}</Space>
        </>
    );

    return (
        <div className={styles.filters} style={style}>
            {holder}
            <Space size={12} style={{ width: '100%' }}>
                <Space size={4} style={{ color: 'var(--color-light-5)', whiteSpace: 'nowrap' }}>
                    <Icon name={icon || 'filter'} fontSize={20} />
                    <Typography>{title || t('filter')}</Typography>
                </Space>

                {customFilter?.(table) ? (
                    <>
                        {customFilter?.(table)?.prefix}
                        <div className={styles.container}>
                            {chevronLeftButton}
                            <div
                                ref={(ref) => {
                                    if (ref) {
                                        scrollbarContainerRef.current = ref;
                                        setScrollable(ref.scrollWidth > ref.clientWidth);
                                    }
                                }}
                                onScroll={() => {
                                    calculate();
                                }}
                                style={{ overflow: 'auto', marginBottom: '-15px' }}
                            >
                                <Space style={{ maxWidth: '100%' }} size={12}>
                                    {customFilter(table)?.container?.map((children, index) => {
                                        if (isValidElement(children)) {
                                            return cloneElement(children, {
                                                ...children.props,
                                                ref: (ref: HTMLDivElement) => (filteredChipRefs.current[index] = ref),
                                            });
                                        }
                                        return null;
                                    })}
                                </Space>
                            </div>
                            {chevronRightButton}
                        </div>
                    </>
                ) : (
                    defaultFilters
                )}

                {extra?.(table)}
            </Space>
        </div>
    );
};

export default typedMemo(Filters);
