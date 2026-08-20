import type {
    Attachment,
    FieldCheckboxProps,
    FieldCountryProps,
    FieldCurrencyProps,
    FieldDatePickerProps,
    FieldDateTimePickerProps,
    FieldNumberProps,
    FieldPhoneProps,
    FieldSelectProps,
    FieldTextProps,
    FieldTimePickerProps,
    FieldUploadProps,
    generalIconMapping,
    IllustrationProps,
    Option,
} from '@imbrace/ui';
import type { QueryKey } from '@tanstack/react-query';
import type {
    AccessorKeyColumnDef,
    CellContext,
    ColumnFiltersState,
    ColumnOrderState,
    ColumnSizingState,
    PaginationState,
    Row as RowType,
    RowSelectionState,
    SortingState,
    Table,
    TableState,
    RowModel,
} from '@tanstack/react-table';
import type { CountryCode } from 'libphonenumber-js';
import type { CSSProperties, ReactNode } from 'react';

import type { NotesProps } from '../Notes';

export type FieldProps<F> = Omit<F, 'value' | 'onChange' | 'onBlur' | 'options' | 'fullWidth' | 'disabled'>;

interface ColumnFieldProps<F = unknown> {
    fieldProps?: FieldProps<F> & {
        disabled?: ((value: unknown) => boolean) | boolean;
        disabledTooltip?: string;
    };
    filterFieldProps?: FieldProps<F>;
}

type BaseColumn = {
    enableEditing?: boolean;
    enum?: Record<string | number, string>;
    request?: () => Promise<Option[]>;
    tooltip?: string;
    validate?: (value?: unknown) => boolean | string;
    bordered?: boolean;
};

export type TextColumn = {
    type?: 'ShortText';
} & ColumnFieldProps<FieldTextProps>;

export type LongTextColumn = {
    type?: 'LongText';
} & ColumnFieldProps<FieldTextProps>;

export type NumberColumn = {
    type?: 'Number';
} & ColumnFieldProps<FieldNumberProps>;

export type PhoneColumn = {
    type?: 'Phone';
} & ColumnFieldProps<FieldPhoneProps>;

export type EmailColumn = {
    type?: 'Email';
} & ColumnFieldProps<FieldTextProps>;

export type SelectColumn = {
    type?: 'SingleSelection';
    enum: Record<string | number, string>;
    request?: () => Promise<Option[]>;
} & ColumnFieldProps<FieldSelectProps>;

export type MultiSelectColumn = {
    type?: 'MultipleSelection';
    enum: Record<string | number, string>;
    request?: () => Promise<Option[]>;
} & ColumnFieldProps<FieldSelectProps>;

export type DateColumn = {
    type?: 'Date';
} & ColumnFieldProps<FieldDatePickerProps>;

export type LinkColumn = {
    type?: 'Link';
} & ColumnFieldProps<FieldTextProps>;

export type PriorityColumn = {
    type?: 'Priority';
} & ColumnFieldProps<FieldNumberProps>;

export type AssigneeColumn = {
    type?: 'Assignee';
} & ColumnFieldProps<FieldSelectProps>;

export type MultiAssigneeColumn = {
    type?: 'MultipleAssignee';
} & ColumnFieldProps<FieldSelectProps>;

export type TimeColumn = {
    type?: 'Time';
} & ColumnFieldProps<FieldTimePickerProps>;

export type RichTextColumn = {
    type?: 'RichText';
} & ColumnFieldProps<FieldTextProps>;

export type CountryColumn = {
    type?: 'Country';
} & ColumnFieldProps<FieldCountryProps>;

export type DatetimeColumn = {
    type?: 'Datetime';
} & ColumnFieldProps<FieldDateTimePickerProps>;

export type OriginColumn = {
    type?: 'Origin';
} & ColumnFieldProps<FieldSelectProps>;

export type AttachmentColumn = {
    type?: 'Attachment';
} & ColumnFieldProps<FieldUploadProps>;
export type NotesColumn = {
    type?: 'Notes';
} & ColumnFieldProps<NotesProps>;

export type CurrencyColumn = {
    type?: 'Currency';
} & ColumnFieldProps<FieldCurrencyProps>;

export type CheckboxColumn = {
    type?: 'Checkbox';
} & ColumnFieldProps<FieldCheckboxProps>;

export type ColumnType = BaseColumn &
    (
        | TextColumn
        | NumberColumn
        | SelectColumn
        | MultiSelectColumn
        | DateColumn
        | LongTextColumn
        | LinkColumn
        | PriorityColumn
        | AssigneeColumn
        | MultiAssigneeColumn
        | TimeColumn
        | PhoneColumn
        | EmailColumn
        | RichTextColumn
        | CountryColumn
        | DatetimeColumn
        | OriginColumn
        | AttachmentColumn
        | NotesColumn
        | CurrencyColumn
        | CheckboxColumn
    );

export type FieldType = ColumnType['type'];

type AssigneeValue = {
    _id: string;
    display_name: string;
};

type PhoneValue = {
    country_code?: CountryCode;
    phone?: string;
    country_calling_code?: string;
    calling_code_with_number?: string;
    national_number?: string;
};

export type OriginValue = {
    type: 'customized' | 'channel' | 'journey';
    data: {
        id?: string;
        type?: string;
        name: string;
    };
};

export type AttachmentValue = {
    type: 'file' | 'url';
    data: {
        url: string;
        name: string;
        key?: string;
        extension?: string;
        uploader?: string;
        user_id?: string;
        sizeInBytes?: number;
        uploadDate?: string;
    };
    extra?: Attachment;
};

export type NotesValue = {
    _id: string;
    author_id: string;
    author_name: string;
    message: string;
    created_at: Date;
    updated_at: Date;
};

export type CurrencyValue = {
    currency_code?: string;
    amounts?: number;
};

export type ColumnValue =
    | string
    | number
    | boolean
    | Date
    | (string | number | Date | undefined | null)[]
    | null
    | AssigneeValue
    | undefined
    | PhoneValue
    | OriginValue
    | AttachmentValue[]
    | NotesValue[]
    | CurrencyValue;

export type Columns<D extends { id: string; _id?: string }> = (Omit<AccessorKeyColumnDef<D, ColumnValue>, 'cell'> &
    ColumnType & {
        cell?: string | ((colProps: CellContext<D, ColumnValue> & { isHover?: boolean; isRowSelected?: boolean }) => any);
    })[];

export interface FlexibleTableBaseProps<D extends { id: string; _id?: string }> {
    /* Column definition */
    columns: Columns<D>;
    // Column resizable
    columnResizable?: boolean;
    // Column order changeable
    columnOrderChangeable?: boolean;
    // Column sortable
    columnSortable?: boolean;
    // Column filterable
    columnFilterable?: boolean;
    // Column Sizing State
    columnSizing?: ColumnSizingState;
    // Column Order State
    columnOrder?: ColumnOrderState;
    // Global Filter (search)
    globalFilter?: string;
    // Controlled Page count
    pageCount?: number;
    // Controlled Pagination
    pagination?: PaginationState;
    // Data update event
    onDataUpdate?: (data: { rowIndex?: number; columnId: string; value: unknown; id: string }) => Promise<D | undefined | void>;
    /**
     * Check whether the data can be deleted
     * @default true
     */
    isDataDeletable?: (row: D) => boolean;
    /**
     * delete button tooltip
     */
    deleteTooltip?: (row: D) => string | undefined;
    deleteButtonText?: string;
    // Data delete event
    onDataDelete?: (dataId: string | string[]) => Promise<boolean | void>;
    // Pagination change event
    onPaginationChange?: (pagination: PaginationState) => void;
    // Filter change event
    onColumnFilterChange?: (filters: ColumnFiltersState) => void;
    // Sorter change event
    onSorterChange?: (sorter: SortingState) => void;
    // Column order change event
    onColumnOrderChange?: (columnOrder: ColumnOrderState) => void;
    // Column sizing change event
    onColumnSizingChange?: (columnSizing: ColumnSizingState) => void;
    /**
     * Empty image
     * @default record-missing
     */
    emptyImage?: IllustrationProps['name'] | ((tableState: Partial<TableState>) => IllustrationProps['name'] | undefined);
    /**
     * Empty message
     * @default 'No Data'
     */
    emptyMessage?: string | ReactNode | ((tableState: Partial<TableState>) => string | ReactNode | undefined);
    /**
     * Make table 100% width
     */
    fullWidth?: boolean;
    /**
     * Enable multiple row selection
     */
    enableRowSelection?: boolean | ((row: RowType<D>) => boolean);
    /**
     * Enable multiple row selection
     */
    enableMultiRowSelection?: boolean | ((row: RowType<D>) => boolean);
    /**
     * Disable hover effect
     */
    disableHoverEffect?: boolean;
    /**
     * show filter
     *
     */
    showFilter?: boolean;
    /**
     * custom filter component
     */
    customFilter?: (table: Table<D>) => { container?: ReactNode[]; prefix?: ReactNode } | undefined;
    /**
     * extra component on filter container
     */
    filterExtra?: (table: Table<D>) => ReactNode;
    /**
     * filter props
     */
    filterProps?: {
        title?: string;
        icon?: keyof typeof generalIconMapping;
    };
    queryKey?: QueryKey;
    paginationStyle?: CSSProperties;
    customContextMenu?: (row: RowType<D>, rowSelection?: RowSelectionState) => ReactNode;
    /**
     * Show outline
     */
    outlined?: boolean;
    /**
     * Custom container style
     */
    containerStyle?: CSSProperties;
}

interface FlexibleTableWithData<D extends { id: string; _id?: string }> extends FlexibleTableBaseProps<D> {
    dataSource: D[];
}

export type RequestParameters = {
    sorters?: SortingState;
    filters?: ColumnFiltersState;
    pagination?: PaginationState;
    globalFilter?: string;
};

export interface Response<D extends { id: string; _id?: string }> {
    data: D[];
    meta: {
        total: number;
        skip: number;
        limit: number;
    };
}

export interface FlexibleTableWithRequest<D extends { id: string; _id?: string }> extends FlexibleTableBaseProps<D> {
    request: (params: RequestParameters, signal?: AbortSignal) => Promise<Response<D>>;
}

export type FlexibleTableProps<D extends { id: string; _id?: string }> = FlexibleTableWithData<D> | FlexibleTableWithRequest<D>;

interface UpdateCache<D> {
    operation: 'Update';
    record: D;
}

interface DeleteCache {
    operation: 'Delete';
    rowId: string | string[];
}

export type CacheMutationPayload<D> = UpdateCache<D> | DeleteCache;

export interface FlexibleTableRef<D> {
    addNewRecord: () => void;
    refresh: () => void;
    resetPagination: () => void;
    reset: () => void;
    getSelectedRows: any;
    resetRowSelection: () => void;
    removeRowSelection: (rowIds: string[]) => void;
    isSomeSelected: () => boolean;
    getFilterState: () => ColumnFiltersState | undefined;
    resetFilterState: () => void;
    cacheMutation: (payload: CacheMutationPayload<D>) => void;
    setColumnFilters: (filters: ColumnFiltersState) => void;
    getRowModel: () => RowModel<D>;
    handleDataUpdate: (updateData: any) => void;
    handleDataDelete: (rowId: string | string[]) => Promise<boolean | void>;
    updateContainerRect: () => void;
}

