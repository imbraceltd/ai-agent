import { Button, Search, Space } from '@imbrace/ui';
import { Chip } from '@mui/material';
import { LocalizationProvider } from '@mui/x-date-pickers';
import { AdapterDayjs } from '@mui/x-date-pickers/AdapterDayjs';
import { useArgs } from '@storybook/client-api';
import type { Meta, StoryFn } from '@storybook/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useCallback, useRef } from 'react';

import type { FlexibleTableRef, RequestParameters } from '.';
import FlexibleTable from '.';

interface MockDataType {
    id: string;
    name: string;
    age: number;
    gender: number;
    status: number;
    joinDate: string;
    tags: (string | number)[];
    remark?: string;
}
export default {
    title: 'Imbrace/FlexibleTable',
    component: FlexibleTable,

    argTypes: {
        columnResizable: {
            type: 'boolean',
            defaultValue: false,
        },
        columnOrderChangeable: {
            type: 'boolean',
            defaultValue: false,
        },
        columnSortable: {
            type: 'boolean',
            defaultValue: true,
        },
        columnFilterable: {
            type: 'boolean',
            defaultValue: true,
        },
        columnSizing: {
            type: 'symbol',
        },
        columnOrder: {
            type: 'symbol',
        },
        globalFilter: {
            type: 'string',
        },
        pagination: {
            type: 'symbol',
        },
        pageCount: {
            type: 'number',
            defaultValue: -1,
        },
        onDataUpdate: {
            table: {
                category: 'Events',
            },
            type: 'function',
            control: false,
        },
        onDataDelete: {
            table: {
                category: 'Events',
            },
            type: 'function',
            control: false,
        },
        onPaginationChange: {
            table: {
                category: 'Events',
            },
            type: 'function',
            control: false,
        },
        onColumnFilterChange: {
            table: {
                category: 'Events',
            },
            type: 'function',
            control: false,
        },
        onSorterChange: {
            table: {
                category: 'Events',
            },
            type: 'function',
            control: false,
        },
        onColumnOrderChange: {
            table: {
                category: 'Events',
            },
            type: 'function',
            control: false,
        },
        onColumnSizingChange: {
            table: {
                category: 'Events',
            },
            type: 'function',
            control: false,
        },
        request: {
            type: 'function',
            control: false,
        },
    },
    parameters: {
        design: {
            type: 'figma',
            url: 'https://www.figma.com/file/KMoQjjjfdoxwJClKLKxY13/Platform---Core-Library?node-id=336%3A21814&t=hhW41fsNd1DwTfoG-1',
        },
        docs: { source: { type: 'dynamic' } },
    },
    decorators: [
        (Story) => (
            <QueryClientProvider client={new QueryClient()}>
                <LocalizationProvider dateAdapter={AdapterDayjs}>
                    <Story />
                </LocalizationProvider>
            </QueryClientProvider>
        ),
    ],
} as Meta<typeof FlexibleTable<MockDataType>>;

const Template: StoryFn<typeof FlexibleTable<MockDataType>> = (args) => {
    const [{ dataSource, pagination, pageCount }, updateArgs] = useArgs();
    const savedColumnSizing = localStorage.getItem('StorybookTableSizing');
    const savedColumnOrder = localStorage.getItem('StorybookTableOrder');
    const tableRef = useRef<FlexibleTableRef<MockDataType>>(null);
    return (
        <Space direction="vertical" align="start" style={{ width: '100%' }}>
            <Space>
                <Search
                    placeholder="Search"
                    onSearch={(e) => {
                        updateArgs({
                            globalFilter: e.target.value,
                        });
                    }}
                />
                <Button
                    size="default"
                    text="Create new record"
                    onClick={() => {
                        tableRef.current?.addNewRecord();
                    }}
                />
            </Space>
            <FlexibleTable<MockDataType>
                {...args}
                ref={tableRef}
                pagination={pagination}
                pageCount={pageCount}
                dataSource={dataSource}
                onDataUpdate={async ({ rowIndex, columnId, value, id }) => {
                    args?.onDataUpdate?.({ rowIndex, columnId, value, id });
                    updateArgs({
                        dataSource: (dataSource as MockDataType[]).map((row, index) => {
                            if (index === rowIndex) {
                                return {
                                    ...dataSource[rowIndex],
                                    [columnId]: value,
                                };
                            }
                            return row;
                        }),
                    });
                }}
                onDataDelete={async (dataId) => {
                    args?.onDataDelete?.(dataId);
                    return true;
                }}
                columnSizing={savedColumnSizing ? JSON.parse(savedColumnSizing) : {}}
                columnOrder={savedColumnOrder ? JSON.parse(savedColumnOrder) : []}
                onColumnOrderChange={(columnOrder) => {
                    args?.onColumnOrderChange?.(columnOrder);
                    localStorage.setItem('StorybookTableOrder', JSON.stringify(columnOrder));
                }}
                onColumnSizingChange={(columnSizing) => {
                    args?.onColumnSizingChange?.(columnSizing);
                    localStorage.setItem('StorybookTableSizing', JSON.stringify(columnSizing));
                }}
            />
        </Space>
    );
};

export const Default = Template.bind({});

const MockData = [
    {
        id: '1',
        name: 'Jennifer',
        gender: 0,
        age: 10,
        status: 2,
        tags: [1, 3],
        remark: "I'm multiline text",
        joinDate: '2023-01-02T10:21:30Z',
    },
    { id: '2', name: 'Jane', gender: 0, age: 11, status: 1, tags: [1, 2], remark: "I'm multiline text", joinDate: '2023-01-02T10:21:30Z' },
    { id: '3', name: 'Kennedy', gender: 1, age: 12, status: 2, tags: [1], remark: "I'm multiline text", joinDate: '2023-01-02T10:21:30Z' },
    {
        id: '4',
        name: 'William',
        gender: 1,
        age: 13,
        status: 2,
        tags: [1, 2, 3],
        remark: "I'm multiline text",
        joinDate: '2023-01-02T10:21:30Z',
    },
    { id: '5', name: 'Chih', gender: 1, age: 14, status: 1, tags: [], remark: "I'm multiline text", joinDate: '2023-01-02T10:21:30Z' },
    { id: '6', name: 'Max', gender: 1, age: 15, status: 2, tags: [2, 3], remark: "I'm multiline text", joinDate: '2023-01-02T10:21:30Z' },
];

Default.args = {
    columnResizable: true,
    columnOrderChangeable: true,
    dataSource: MockData,
    columns: [
        {
            accessorKey: 'rowIndex',
            id: 'rowIndex',
            header: () => '',
            enableColumnFilter: false,
            enablePinning: true,
            enableEditing: false,
            enableResizing: false,
            cell: ({ row }) => {
                return row.index + 1;
            },
        },
        {
            accessorKey: 'name',
            id: 'name',
            header: () => 'Name',
            enableColumnFilter: false,
            enablePinning: true,
            meta: {
                identifier: true,
            },
        },
        {
            accessorKey: 'gender',
            id: 'gender',
            header: () => 'Gender',
            enableEditing: false,
            type: 'SingleSelection',
            enum: {
                0: 'Female',
                1: 'Male',
            },
        },
        { accessorKey: 'age', id: 'age', header: () => 'Age', type: 'Number', enableSorting: true, sortUndefined: 1 },
        {
            accessorKey: 'status',
            id: 'status',
            header: () => 'Status',
            type: 'SingleSelection',
            enum: {
                1: 'Inactive',
                2: 'Active',
            },
        },
        {
            accessorKey: 'joinDate',
            id: 'joinDate',
            header: () => 'Join Date',
            type: 'Date',
        },
        {
            accessorKey: 'tags',
            id: 'tags',
            header: () => 'Tags',
            type: 'MultipleSelection',
            cell: ({ getValue }) => {
                const enumMapping: Record<string | number, string> = {
                    1: 'Tag A',
                    2: 'Tag B',
                    3: 'Tag C',
                };
                const cellValue = getValue();
                if (Array.isArray(cellValue)) {
                    return (
                        <Space size={8}>
                            {cellValue
                                .filter((value) => value !== undefined && value !== null)
                                .map((value, index) => (
                                    <Chip
                                        key={`tags-${index}`}
                                        sx={{ height: 24, background: 'rgba(250, 153, 23, 0.2)', maxWidth: 'none' }}
                                        label={enumMapping[value as string]}
                                    />
                                ))}
                        </Space>
                    );
                }
                return null;
            },
            enum: {
                1: 'Tag A',
                2: 'Tag B',
                3: 'Tag C',
            },
            meta: {
                cellStyle: {
                    padding: '7px 12px',
                },
            },
        },
        {
            accessorKey: 'remark',
            id: 'remark',
            header: () => 'Remark',
            type: 'LongText',
            enableColumnFilter: false,
        },
    ],
};

export interface DummyUserType {
    id: string;
    firstName: string;
    lastName: string;
    maidenName: string;
    age: number;
    gender: string;
    email: string;
    phone: string;
    username: string;
    password: string;
    birthDate: string;
    image: string;
    bloodGroup: string;
    height: number;
    weight: number;
    eyeColor: string;
    hair: Hair;
    domain: string;
    ip: string;
    address: Address;
    macAddress: string;
    university: string;
    bank: Bank;
    company: Company;
    ein: string;
    ssn: string;
    userAgent: string;
}

export interface Address {
    address: string;
    city: string;
    coordinates: Coordinates;
    postalCode: string;
    state: string;
}

export interface Coordinates {
    lat: number;
    lng: number;
}

export interface Bank {
    cardExpire: string;
    cardNumber: string;
    cardType: string;
    currency: string;
    iban: string;
}

export interface Company {
    address: Address;
    department: string;
    name: string;
    title: string;
}

export interface Hair {
    color: string;
    type: string;
}

const RemoteTemplate: StoryFn<typeof FlexibleTable<DummyUserType>> = (args) => {
    const [{ dataSource }, updateArgs] = useArgs();

    const request = useCallback(async ({ pagination, filters, sorters, globalFilter }: RequestParameters) => {
        try {
            const searchParams = new URLSearchParams();
            let url = new URL('https://dummyjson.com/users');
            if (pagination) {
                searchParams.append('limit', `${pagination.pageSize}`);
                searchParams.append('skip', `${pagination.pageIndex * pagination.pageSize}`);
            }
            if (filters && filters.length > 0) {
                url = new URL('https://dummyjson.com/users/filter');

                searchParams.append('key', `${filters.map((filter) => filter.id).join(',')}`);
                searchParams.append('value', `${filters.map((filter) => filter.value).join(',')}`);
            }
            if (sorters && sorters.length > 0) {
                console.log('request', sorters);
            }
            if (globalFilter) {
                url = new URL('https://dummyjson.com/users/search');
                searchParams.append('q', `${globalFilter ?? ''}`);
            }

            const res = await fetch(`${url}?${searchParams.toString()}`);
            const json = await res.json();
            if (!json.users) {
                return {
                    data: [],
                    meta: {
                        total: 0,
                        skip: 0,
                        limit: 20,
                    },
                };
            }
            return {
                data: json.users ?? [],
                meta: {
                    total: json.total,
                    skip: json.skip,
                    limit: json.limit,
                },
            };
        } catch (error) {
            return {
                data: [],
                meta: {
                    total: 0,
                    skip: 0,
                    limit: 0,
                },
            };
        }
    }, []);

    return (
        <Space direction="vertical" align="start">
            <Search
                placeholder="Search"
                onSearch={(e) => {
                    updateArgs({
                        globalFilter: e.target.value,
                    });
                }}
            />
            <FlexibleTable<DummyUserType>
                {...args}
                request={async (reqData) => {
                    // @ts-ignore
                    args?.request?.(reqData);
                    const data = await request(reqData);
                    return data;
                }}
                onDataUpdate={async ({ rowIndex, columnId, value, id }) => {
                    args?.onDataUpdate?.({ rowIndex, columnId, value, id });
                    updateArgs({
                        dataSource: (dataSource as MockDataType[]).map((row, index) => {
                            if (index === rowIndex) {
                                return {
                                    ...dataSource[rowIndex],
                                    [columnId]: value,
                                };
                            }
                            return row;
                        }),
                    });
                }}
            />
        </Space>
    );
};

export const RemoteData = RemoteTemplate.bind({});

RemoteData.args = {
    columns: [
        {
            accessorKey: 'firstName',
            id: 'firstName',
            header: () => 'First Name',
            enableColumnFilter: false,
            enablePinning: true,
            enableEditing: false,
        },
        { accessorKey: 'lastName', id: 'lastName', header: () => 'Last Name', enableColumnFilter: false, enableEditing: false },
        {
            accessorKey: 'gender',
            id: 'gender',
            header: () => 'Gender',
            enableEditing: false,
            type: 'SingleSelection',
            enum: {
                female: 'Female',
                male: 'Male',
            },
        },
        {
            accessorKey: 'birthDate',
            id: 'birthDate',
            header: () => 'Birthday Date',
            type: 'Date',
            enableEditing: false,
        },
        { accessorKey: 'age', id: 'age', header: () => 'Age', type: 'Number', sortUndefined: 1, maxSize: 100, enableEditing: false },
        { accessorKey: 'height', id: 'height', header: () => 'Height', type: 'Number', enableColumnFilter: false, enableEditing: false },
        { accessorKey: 'weight', id: 'weight', header: () => 'Weight', type: 'Number', enableColumnFilter: false, enableEditing: false },
        {
            accessorKey: 'eyeColor',
            id: 'eyeColor',
            header: () => 'Eye Color',
            type: 'Number',
            enableColumnFilter: false,
            enableEditing: false,
        },
        { accessorKey: 'ip', id: 'ip', header: () => 'ip', enableColumnFilter: false, enableEditing: false },
        { accessorKey: 'domain', id: 'domain', header: () => 'Domain', enableColumnFilter: false, enableEditing: false },
        { accessorKey: 'university', id: 'university', header: () => 'University', enableColumnFilter: false, enableEditing: false },
    ],
};
