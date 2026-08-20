import { Dropdown, Icon, Space } from '@imbrace/ui';
import { usePagination } from '@mui/lab';
import { Button, styled } from '@mui/material';
import type { PaginationState, Table } from '@tanstack/react-table';
import type { ChangeEvent, CSSProperties } from 'react';
import { useCallback } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './index.module.scss';

interface PaginationProps<D> {
    table: Table<D>;
    pagination: PaginationState;
    style?: CSSProperties;
}

const List = styled('ul')({
    listStyle: 'none',
    padding: 0,
    margin: 0,
    display: 'flex',
    gap: '5px',
});

const PageItem = styled(Button, { shouldForwardProp: (props) => props !== 'selected' })(({ selected }: { selected?: boolean }) => ({
    gap: '8px',
    width: 32,
    height: 32,
    padding: 0,
    minWidth: 'auto',
    fontSize: 12,
    color: !selected ? 'var(--color-secondary-3)' : 'var(--color-primary-1)',
    '&:hover, &:focus, &:active': {
        boxShadow: 'none',
        background: 'var(--color-secondary-2)',
    },
    '&.Mui-disabled': {
        color: 'var(--color-light-4)',
    },
    '& svg': {
        fontSize: 24,
    },
}));

const UsePagination = ({
    count,
    page,
    onChange,
}: {
    count: number;
    page: number;
    onChange: (event: ChangeEvent<unknown>, page: number) => void;
}) => {
    const { items } = usePagination({
        count,
        page,
        onChange,
    });

    const renderIcon = (type: string) => {
        switch (type) {
            case 'next':
                return <Icon name="chevronRight" />;
            case 'previous':
                return <Icon name="chevronLeft" />;
            default:
                return type;
        }
    };

    return (
        <nav>
            <List>
                {items.map(({ page: pageNum, type, selected, ...item }, index) => {
                    let children = null;

                    if (type === 'start-ellipsis' || type === 'end-ellipsis') {
                        children = (
                            <div>
                                <span style={{ lineHeight: '32px' }}>…</span>
                            </div>
                        );
                    } else if (type === 'page') {
                        children = (
                            <PageItem selected={selected} {...item}>
                                {pageNum}
                            </PageItem>
                        );
                    } else {
                        children = <PageItem {...item}>{renderIcon(type)}</PageItem>;
                    }

                    return <li key={index}>{children}</li>;
                })}
            </List>
        </nav>
    );
};

const Pagination = <D extends object>({ table, pagination, style }: PaginationProps<D>) => {
    const { t } = useTranslation();
    const { pageSize, pageIndex } = pagination;

    const handleChange = useCallback(
        (event: ChangeEvent<unknown>, value: number) => {
            table.setPageIndex(value - 1);
        },
        [table],
    );

    return (
        <div className={styles.pagination} style={style}>
            <Space size={4}>
                <span>{t('display_per_page')}</span>
                <Dropdown
                    selectedIndex={pageSize}
                    text={`${pageSize}`}
                    options={[
                        {
                            index: 100,
                            text: '100',
                        },
                        {
                            index: 50,
                            text: '50',
                        },
                        {
                            index: 30,
                            text: '30',
                        },
                        {
                            index: 20,
                            text: '20',
                        },
                        {
                            index: 10,
                            text: '10',
                        },
                    ]}
                    variant="text"
                    onSelect={(e, selected) => {
                        table.setPageSize(selected);
                    }}
                    hideOnSelect
                    buttonSx={{
                        color: 'var(--color-light-5)',
                        '& svg': {
                            fontSize: 12,
                        },
                    }}
                    typographyProps={{
                        variant: 'Caption',
                        style: {
                            lineHeight: '100%',
                        },
                    }}
                    anchorOrigin={{
                        vertical: 'top',
                        horizontal: 'center',
                    }}
                    transformOrigin={{
                        vertical: 'bottom',
                        horizontal: 'center',
                    }}
                />
            </Space>
            <Space size={24}>
                <Space size={4}>
                    <span>{t('on_page')}</span>
                    <input
                        className={styles.inputNumber}
                        type="number"
                        value={pageIndex + 1}
                        onChange={(e) => {
                            const page = e.target.value ? Number(e.target.value) - 1 : 0;
                            table.setPageIndex(page);
                        }}
                        min={1}
                        max={table.getPageCount()}
                    />
                </Space>
                <UsePagination count={table.getPageCount()} page={pageIndex + 1} onChange={handleChange} />
            </Space>
        </div>
    );
};

export default Pagination;
