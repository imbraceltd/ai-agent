import type { channelIconMapping, DatePickerRef, DateTimePickerRef, SelectRef, TimePickerRef } from '@imbrace/ui';
import { Checkbox, EllipsisText, FieldSelect, Icon, IconButton, Select, Space, Typography } from '@imbrace/ui';
import { Chip, ClickAwayListener, Popover } from '@mui/material';
import type { CellContext, Column, ColumnDef } from '@tanstack/react-table';
import { isValid } from 'date-fns';
import dayjs from 'dayjs';
import type { MouseEvent as ReactMouseEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { typedMemo } from '@/utils';
import Notes from '../Notes';
import Attachment from './attachment';
import Fields, { Field } from './fields';
import styles from './index.module.scss';
import LinkPreviewField from './linkPreview';
import type { AttachmentValue, ColumnType, ColumnValue, CurrencyValue, NotesValue } from './types';

const validateText = (text?: ColumnValue) => {
    if (text === '' || typeof text === 'undefined') {
        return '—';
    }
    return text;
};

const EditableColumn = <D extends { id: string; [key: string]: string | number | (string | number)[] }>(
    props: Omit<CellContext<D, ColumnValue> & { cellId: string }, 'column'> & {
        editable?: boolean;
        column: ColumnDef<D, ColumnValue> & ColumnType;
        customCell?:
            | string
            | ((
                  colProps: CellContext<D, ColumnValue> & {
                      isHover?: boolean;
                      isRowSelected?: boolean;
                  },
              ) => JSX.Element | string);
        removeNewRecord?: () => void;
        bordered?: boolean;
        isHover?: boolean;
        isRowSelected?: boolean;
    },
) => {
    const {
        row: { index, getValue, original, renderValue },
        column,
        table,
        customCell,
        editable,
        removeNewRecord,
        bordered,
        isHover,
        isRowSelected,
        cell,
    } = props;
    const cellColumn = cell.column;
    const initialValue = cell.getValue();
    const [editing, setEditing] = useState(original.id === 'new');
    const [value, setValue] = useState<ColumnValue>(initialValue ?? '');
    const [isValidValue, setIsValidValue] = useState(false);
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const [expanded, setExpanded] = useState(false);
    const [focus, setFocus] = useState(false);
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement | SelectRef>(null);
    const formControlRef = useRef<HTMLDivElement>(null);
    const datePickerRef = useRef<DatePickerRef>(null);
    const timePickerRef = useRef<TimePickerRef>(null);
    const datetimePickerRef = useRef<DateTimePickerRef>(null);
    const originalId = useRef<string>(original.id);
    const loading = useRef(false);

    const open = Boolean(anchorEl);

    useEffect(() => {
        setValue(initialValue ?? '');
    }, [initialValue, original.id, column.id]);

    useEffect(() => {
        if (original.id === 'new') {
            if (table.getIsSomeRowsSelected()) {
                table.resetRowSelection();
            }
        }
    }, [original.id, table]);

    const handlePopoverOpen = () => {
        setAnchorEl(containerRef.current);
    };

    const handlePopoverClose = async (event: ReactMouseEvent<HTMLDivElement | HTMLButtonElement, MouseEvent>) => {
        event.stopPropagation();
        setAnchorEl(null);
        loading.current = true;
        if (focus) {
            setFocus(false);
        }
        const toggleEdit = () => {
            setEditing(false);
            loading.current = false;
            // if (getIsSelected()) {
            //     getToggleSelectedHandler()({});
            // }
        };
        if (column.id && editing) {
            if (typeof value === 'string' || (typeof value === 'object' && value)) {
                if (value !== original[column.id]) {
                    if ((original[column.id] === null || original[column.id] === undefined) && value === '') {
                        toggleEdit();
                        return;
                    }
                    if (Array.isArray(value) && (original[column.id] === null || original[column.id] === undefined) && value.length === 0) {
                        toggleEdit();
                        return;
                    }
                    await table.options.meta?.updateData({
                        rowIndex: index,
                        columnId: column.id,
                        value,
                        id: original.id,
                    });
                    toggleEdit();
                }
            }
        }
        if (editing) {
            toggleEdit();
        }
    };

    const handleEdit = async () => {
        loading.current = true;
        if (focus) {
            setFocus(false);
        }
        const toggleEdit = () => {
            setValue(initialValue);
            setEditing(false);
            loading.current = false;
            // if (getIsSelected()) {
            //     getToggleSelectedHandler()({});
            // }
        };

        if (!expanded) {
            if (!isValidValue && column.id && !value && original.id === 'new' && column.meta?.identifier) {
                removeNewRecord?.();
                toggleEdit();
                return;
            }
            if (column.id && isValidValue && (editing || (original.id === 'new' && column.meta?.identifier))) {
                if (original.id === 'new') {
                    if (value) {
                        await table.options.meta?.updateData({
                            rowIndex: index,
                            columnId: column.id,
                            value,
                            id: original.id,
                        });
                        toggleEdit();
                    }
                    return;
                }
                if (value !== original[column.id]) {
                    if ((original[column.id] === null || original[column.id] === undefined) && value === '') {
                        toggleEdit();
                        return;
                    }
                    if (Array.isArray(value) && (original[column.id] === null || original[column.id] === undefined) && value.length === 0) {
                        toggleEdit();
                        return;
                    }
                    await table.options.meta?.updateData({
                        rowIndex: index,
                        columnId: column.id,
                        value,
                        id: original.id,
                    });
                    toggleEdit();
                }
            }

            if (editing) {
                toggleEdit();
            }
        }
    };

    const getFieldValue = (value: any, columnType?: string) => {
        // Return directly if value is not an object or is null/undefined/array/date
        if (!value || typeof value !== 'object' || Array.isArray(value) || value instanceof Date) {
            return value;
        }
        // Handle specific object types
        if ('_id' in value) {
            return value._id;
        }

        if ('country_code' in value && columnType === 'Country') {
            return value.country_code;
        }

        return value;
    };

    const renderField = () => {
        switch (column.type) {
            case 'Checkbox':
                return (
                    <Fields
                        type={column.type}
                        value={value}
                        // enum={column.enum}
                        fieldId={column.id}
                        onChange={(v, validate = true) => {
                            setIsValidValue(validate);
                            setValue(v);
                            if (column.id) {
                                table.options.meta?.updateData({
                                    rowIndex: index,
                                    columnId: column.id,
                                    value: v,
                                    id: original.id,
                                });
                            }
                        }}
                        formControlRef={formControlRef}
                        // validate={column.validate}
                        fieldProps={{
                            ...column.fieldProps,
                            ...(column.fieldProps?.disabled &&
                                typeof column.fieldProps?.disabled === 'function' && {
                                    disabled: column.fieldProps.disabled(original),
                                }),
                        }}
                    />
                );
            case 'MultipleSelection':
                return (
                    <Select
                        value={value}
                        onChange={(v) => {
                            setValue(v);
                            setIsValidValue(true);
                        }}
                        fullWidth
                        closeOnSelect={false}
                        placeholder="Multiple select"
                        displayType="chip"
                        request={() => column.request?.()}
                        multiple
                        onReset={() => {
                            setValue([]);
                            setIsValidValue(true);
                        }}
                        onClose={() => {
                            setEditing(false);
                            if (editing) {
                                handleEdit();
                            }
                        }}
                        footer={() => {
                            return column.meta?.footer;
                        }}
                    />
                );
            case 'LongText':
                return (
                    <Popover
                        open={open}
                        anchorEl={anchorEl}
                        anchorOrigin={{
                            vertical: 'top',
                            horizontal: 'center',
                        }}
                        transformOrigin={{
                            vertical: 'top',
                            horizontal: 'center',
                        }}
                        slotProps={{
                            paper: {
                                sx: {
                                    width: containerRef.current?.getBoundingClientRect().width,
                                    boxShadow: 'none',
                                },
                            },
                        }}
                        onClose={handlePopoverClose}
                        transitionDuration={0}
                    >
                        <Fields
                            type={column.type}
                            value={typeof value === 'string' && value === '' ? [] : value}
                            enum={column.enum}
                            fieldId={column.id}
                            onChange={(v, validate = true) => {
                                setIsValidValue(validate);
                                setValue(v);
                            }}
                            formControlRef={formControlRef}
                            validate={column.validate}
                            fieldProps={{
                                ...column.fieldProps,
                                ...(column.fieldProps?.disabled &&
                                    typeof column.fieldProps?.disabled === 'function' && {
                                        disabled: column.fieldProps.disabled(original),
                                    }),
                                ...{
                                    customIcon: () => (
                                        <IconButton
                                            variant="text"
                                            type="secondary"
                                            size="s"
                                            fontSize={20}
                                            {...(column.type === 'LongText' && {
                                                sx: {
                                                    alignSelf: 'flex-start',
                                                    marginTop: '5px',
                                                    marginRight: '12px',
                                                },
                                            })}
                                            onClick={(e) => {
                                                e.stopPropagation();
                                                if (formControlRef?.current) {
                                                    setExpanded(true);
                                                    column.meta?.onExpand?.(e, {
                                                        rowId: original.id,
                                                        target: formControlRef?.current,
                                                        value,
                                                        onClose: () => {
                                                            setExpanded(false);
                                                        },
                                                    });
                                                }
                                            }}
                                        >
                                            <Icon name="more" fontSize={20} />
                                        </IconButton>
                                    ),
                                },
                            }}
                        />
                    </Popover>
                );
            default:
                return (
                    <Fields
                        key={`${original.id}-${index}`}
                        type={column.type}
                        fieldId={column.id}
                        ref={inputRef}
                        value={getFieldValue(value, column.type)}
                        enum={column.enum}
                        formControlRef={formControlRef}
                        onChange={(v, validate = true) => {
                            setIsValidValue(validate);
                            setValue(v);
                        }}
                        validate={column.validate}
                        fieldProps={{
                            ...column.fieldProps,
                            ...(column.fieldProps?.disabled &&
                                typeof column.fieldProps?.disabled === 'function' && {
                                    disabled: column.fieldProps.disabled(original),
                                }),
                            ...(column.type === 'Datetime' && { datetimePickerRef: datetimePickerRef }),
                            ...(column.type === 'Date' && { datePickerRef: datePickerRef }),
                            ...(column.type === 'Time' && { timePickerRef: timePickerRef }),
                            ...((column.type === 'SingleSelection' ||
                                column.type === 'Assignee' ||
                                column.type === 'Priority' ||
                                column.type === 'MultipleAssignee') && {
                                request: column.request,
                            }),
                            ...(column.type === 'Assignee' &&
                                typeof value === 'object' &&
                                !Array.isArray(value) &&
                                value &&
                                !(value instanceof Date) && {
                                    renderValue: (selectedValue, options) => {
                                        const targetOption = options.find((option) => option.value === selectedValue);
                                        if (!targetOption && selectedValue === (value as Record<string, string>)._id) {
                                            <Space size={12} style={{ width: '100%', overflow: 'hidden', lineHeight: '20px' }}>
                                                <EllipsisText text={(value as Record<string, string>)?.display_name} />
                                            </Space>;
                                        }
                                        return (
                                            <Space size={12} style={{ width: '100%', overflow: 'hidden', lineHeight: '20px' }}>
                                                <EllipsisText text={targetOption?.text} />
                                            </Space>
                                        );
                                    },
                                }),
                            ...(column.type !== 'Datetime' &&
                                column.type !== 'Date' &&
                                column.type !== 'Time' && {
                                    inputProps: {
                                        autoFocus: true,
                                    },
                                    endAdornment:
                                        column.fieldProps && 'endAdornment' in column.fieldProps && column.fieldProps?.endAdornment,
                                }),
                            ...(column.type === 'Notes' && {
                                onExpand: (e: ReactMouseEvent<HTMLButtonElement, MouseEvent>) => {
                                    if (formControlRef?.current) {
                                        setExpanded(true);
                                        column.meta?.onExpand?.(e, {
                                            rowId: original.id,
                                            target: formControlRef?.current,
                                            value,
                                            onClose: () => {
                                                setExpanded(false);
                                                setAnchorEl(null);
                                                setFocus(false);
                                                setEditing(false);
                                                loading.current = false;
                                            },
                                        });
                                    }
                                },
                            }),
                        }}
                        settings={{
                            defaultCountryCode: column.meta?.defaultCountryCode,
                            defaultCurrencyCode: column.meta?.defaultCurrencyCode,
                        }}
                        boardType={column.meta?.boardType}
                    />
                );
        }
    };

    const renderFormattedValue = () => {
        if (customCell) {
            if (typeof customCell === 'function') {
                return customCell({
                    getValue: () => getValue(column.id ?? ''),
                    column: column as Column<D, ColumnValue>,
                    table,
                    row: props.row,
                    cell,
                    renderValue: () => renderValue(column.id ?? ''),
                    isHover,
                    isRowSelected,
                });
            }
            return customCell;
        }

        if (typeof initialValue === 'undefined' || initialValue === null) {
            if (column.type === 'Link') {
                return <Typography style={{ padding: '7px 12px', color: 'var(--color-light-4)' }}>-</Typography>;
            }
            if (column.type === 'Checkbox') {
                return (
                    <Checkbox
                        value={value}
                        onChange={async (val) => {
                            if (column.id) {
                                await table.options.meta?.updateData({
                                    rowIndex: index,
                                    columnId: column.id,
                                    value: val,
                                    id: original.id,
                                });
                            }
                        }}
                        autoFocus={false}
                    />
                );
            }
            return <Typography style={{ color: 'var(--color-light-4)' }}>—</Typography>;
        }
        if (column.enum) {
            if (Array.isArray(initialValue)) {
                if (column.type === 'MultipleSelection') {
                    let valueToDisplay: string | any[] = [];
                    if (Array.isArray(initialValue)) {
                        valueToDisplay = initialValue;
                    }
                    if (valueToDisplay.length > 0) {
                        return (
                            <Space size={8}>
                                {valueToDisplay
                                    .filter((enumValue) => enumValue !== undefined && enumValue !== null)
                                    .map((enumValue, optionIndex) => {
                                        return (
                                            <Chip
                                                key={`${original.id}-${optionIndex}`}
                                                sx={{
                                                    height: 24,
                                                    background: 'rgba(250, 153, 23, 0.2)',
                                                    maxWidth: 'none',
                                                }}
                                                label={enumValue as string}
                                            />
                                        );
                                    })}
                            </Space>
                        );
                    }
                    return <Typography style={{ color: 'var(--color-light-4)' }}>—</Typography>;
                }
                const text = initialValue.map((v) => column.enum?.[`${v}`]).join(', ');
                return (
                    <EllipsisText
                        text={`${validateText(text)}`}
                        element={
                            <Typography
                                style={{
                                    color: text === '' || typeof text === 'undefined' ? 'var(--color-light-4)' : 'inherit',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    wordBreak: 'break-word',
                                }}
                            />
                        }
                    />
                );
            }
            const text = `${validateText(column.enum[`${initialValue}`] ?? initialValue)}`;

            return (
                <EllipsisText
                    text={text}
                    element={
                        <Typography
                            style={{
                                color: text === '—' ? 'var(--color-light-4)' : 'inherit',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                wordBreak: 'break-word',
                            }}
                        />
                    }
                />
            );
        }
        if (column.type === 'Checkbox') {
            return (
                <Field
                    type={column.type}
                    enum={column.enum}
                    fieldId={column.id}
                    value={initialValue}
                    onChange={async (val) => {
                        if (column.id) {
                            await table.options.meta?.updateData({
                                rowIndex: index,
                                columnId: column.id,
                                value: val,
                                id: original.id,
                            });
                        }
                    }}
                    fieldProps={{
                        autoFocus: false,
                    }}
                />
            );
        }
        if (column.type === 'Link') {
            if (column.meta?.defaultFieldName !== 'contact_record' && column.meta?.defaultFieldName !== 'opportunity_record') {
                return <LinkPreviewField value={initialValue as string} />;
            }
        }
        if (column.type === 'Attachment') {
            const renderValue = initialValue as AttachmentValue[];
            return (
                <Attachment
                    value={renderValue as AttachmentValue[]}
                    fieldId={original.id}
                    onUpdate={async (newValue?: AttachmentValue[]) => {
                        if (column.id) {
                            await table.options.meta?.updateData({
                                rowIndex: index,
                                columnId: column.id,
                                value: newValue,
                                id: original.id,
                            });
                        }
                    }}
                />
            );
        }
        if (column.type === 'Notes') {
            return <Notes notes={value as NotesValue[]} />;
        }
        if (column.type === 'Assignee') {
            const displayName = (initialValue as Record<string, string>)?.display_name;
            return (
                <EllipsisText
                    text={`${displayName ?? '-'}`}
                    element={
                        <Typography
                            style={{
                                color: !displayName ? 'var(--color-light-4)' : 'inherit',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                wordBreak: 'break-word',
                            }}
                        />
                    }
                />
            );
        }
        if (column.type === 'Country') {
            const countryName = (initialValue as Record<string, string>)?.country_name;
            return (
                <EllipsisText
                    text={`${countryName ?? '-'}`}
                    element={
                        <Typography
                            style={{
                                color: !countryName ? 'var(--color-light-4)' : 'inherit',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                wordBreak: 'break-word',
                            }}
                        />
                    }
                />
            );
        }
        if (column.type === 'Phone') {
            const phoneData = initialValue as Record<string, string>;
            if (phoneData && typeof phoneData === 'object' && 'phone' in phoneData) {
                return (
                    <EllipsisText
                        text={`${phoneData.country_calling_code ?? ''} ${phoneData.national_number}`}
                        element={
                            <Typography
                                style={{
                                    color: 'inherit',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    wordBreak: 'break-word',
                                }}
                            />
                        }
                    />
                );
            }

            return (
                <EllipsisText
                    text={`${initialValue || '—'}`}
                    element={
                        <Typography
                            style={{
                                color: !initialValue ? 'var(--color-light-4)' : 'inherit',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                wordBreak: 'break-word',
                            }}
                        />
                    }
                />
            );
        }

        if (column.type === 'Origin') {
            const {
                type,
                data: { name, type: iconType },
            } = initialValue as API.OriginValue;
            return (
                <Space size={12} align="center" justify="center">
                    {type !== 'customized' && <Icon namespace="channel" name={iconType as keyof typeof channelIconMapping} />}
                    <EllipsisText
                        text={`${name ?? '-'}`}
                        element={
                            <Typography
                                style={{
                                    color: !name ? 'var(--color-light-4)' : 'inherit',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    wordBreak: 'break-word',
                                }}
                            />
                        }
                    />
                </Space>
            );
        }

        if (column.type === 'Currency') {
            const currencyData = initialValue as CurrencyValue;
            if (typeof currencyData.amounts === 'undefined') {
                return <Typography style={{ color: 'var(--color-light-4)' }}>—</Typography>;
            }

            return (
                <EllipsisText
                    text={`${Intl.NumberFormat('en-US', {
                        style: 'currency',
                        currency: currencyData.currency_code,
                        currencyDisplay: 'code',
                        minimumFractionDigits: 0,
                        maximumFractionDigits: 3,
                    }).format(currencyData.amounts)}`}
                    element={
                        <Typography
                            style={{
                                color: initialValue === '' || typeof initialValue === 'undefined' ? 'var(--color-light-4)' : 'inherit',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                wordBreak: 'break-word',
                            }}
                        />
                    }
                />
            );
        }

        if (
            isValid(new Date(initialValue as string | number)) &&
            (column.type === 'Datetime' || column.type === 'Date' || column.type === 'Time')
        ) {
            return (
                <EllipsisText
                    text={`${
                        column.type === 'Datetime'
                            ? dayjs(initialValue as string | number).format('MM/DD/YYYY HH:mm')
                            : column.type === 'Time'
                            ? dayjs(initialValue as string | number).format('HH:mm')
                            : dayjs(initialValue as string | number).format('MM/DD/YYYY')
                    }`}
                    element={
                        <Typography
                            style={{
                                color: initialValue === '' || typeof initialValue === 'undefined' ? 'var(--color-light-4)' : 'inherit',
                                overflow: 'hidden',
                                textOverflow: 'ellipsis',
                                whiteSpace: 'nowrap',
                                wordBreak: 'break-word',
                            }}
                        />
                    }
                />
            );
        }
        return (
            <EllipsisText
                text={`${validateText(initialValue)}`}
                element={
                    <Typography
                        style={{
                            color: initialValue === '' || typeof initialValue === 'undefined' ? 'var(--color-light-4)' : 'inherit',
                            overflow: 'hidden',
                            textOverflow: 'ellipsis',
                            whiteSpace: 'nowrap',
                            wordBreak: 'break-word',
                        }}
                    />
                }
            />
        );
    };

    const renderContent = () => {
        if (original.id === 'new' && column.id !== 'rowIndex' && !column.meta?.identifier) {
            return null;
        }
        if (
            (editing && (column.enableEditing || column.enableEditing === undefined)) ||
            (original.id === 'new' && column.meta?.identifier)
        ) {
            return (
                <div
                    className={column.type === 'Checkbox' ? styles.editingCheckbox : styles.editing}
                    onKeyDownCapture={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey && event.keyCode === 13 && !loading.current) {
                            loading.current = true;
                            handleEdit();
                        }
                        if (event.key === 'Escape') {
                            setValue(initialValue);
                            setEditing(false);

                            loading.current = false;
                            // if (getIsSelected()) {
                            //     getToggleSelectedHandler()({});
                            // }
                            if (original.id === 'new') {
                                removeNewRecord?.();
                            }
                        }
                    }}
                >
                    {renderField()}
                </div>
            );
        }
        return (
            <div
                onClick={() => {
                    if (column.enableEditing || column.enableEditing === undefined) {
                        setFocus(!focus);
                    }
                }}
                onDoubleClick={(e) => {
                    if (!table.getIsSomeRowsSelected() && (column.enableEditing || column.enableEditing === undefined)) {
                        setEditing(true);
                        setFocus(false);
                        if (column.type === 'MultipleSelection' || column.type === 'LongText' || column.type === 'MultipleAssignee') {
                            handlePopoverOpen();
                        }
                        let disabled = false;
                        if (column.fieldProps?.disabled && typeof column.fieldProps.disabled === 'function') {
                            disabled = column.fieldProps?.disabled(original);
                        } else if (column.fieldProps?.disabled && typeof column.fieldProps.disabled === 'boolean') {
                            disabled = column.fieldProps?.disabled;
                        }

                        setTimeout(() => {
                            switch (column.type) {
                                case 'Date':
                                    if (datePickerRef?.current && !disabled) {
                                        datePickerRef?.current.openPicker();
                                    }
                                    break;
                                case 'Time':
                                    if (timePickerRef?.current && !disabled) {
                                        timePickerRef?.current.openPicker();
                                    }
                                    break;
                                case 'Datetime':
                                    if (datetimePickerRef?.current && !disabled) {
                                        datetimePickerRef?.current.openPicker();
                                    }
                                    break;
                                case 'SingleSelection':
                                case 'Assignee':
                                case 'Priority':
                                case 'MultipleSelection':
                                case 'MultipleAssignee':
                                case 'Origin':
                                    if (column.meta?.defaultFieldName === 'stage' && value === 'Unidentified Lead') {
                                        return;
                                    }

                                    if (inputRef?.current && !disabled) {
                                        (inputRef?.current as SelectRef).openPicker();
                                    }
                                    break;
                                case 'Notes':
                                    if (formControlRef?.current) {
                                        setExpanded(true);
                                        column.meta?.onExpand?.(e, {
                                            rowId: original.id,
                                            target: formControlRef?.current,
                                            value,
                                            extraProps: {
                                                editing: true,
                                            },
                                            onClose: () => {
                                                setExpanded(false);
                                                setAnchorEl(null);
                                                setFocus(false);
                                                setEditing(false);
                                                loading.current = false;
                                            },
                                        });
                                    }
                                    return;
                                default:
                                    break;
                            }
                        }, 100);
                    }
                }}
                ref={formControlRef}
            >
                <div
                    className={styles.valueContainer}
                    style={{
                        ...(column.type === 'Attachment' && {
                            padding: '3px 12px',
                        }),
                        ...column.meta?.cellStyle,
                    }}
                >
                    {renderFormattedValue()}
                </div>

                {(column.type === 'MultipleSelection' ||
                    column.type === 'MultipleAssignee' ||
                    column.type === 'LongText' ||
                    column.type === 'Attachment' ||
                    column.type === 'Notes') &&
                    editable && (
                        <div className={styles.actionContainer}>
                            <IconButton
                                variant="text"
                                type="secondary"
                                size="s"
                                fontSize={20}
                                onClick={(e) => {
                                    if (column.enableEditing || column.enableEditing === undefined) {
                                        setEditing(true);
                                        setFocus(false);
                                        handlePopoverOpen();

                                        // getToggleSelectedHandler()({});
                                        setTimeout(() => {
                                            if (formControlRef?.current) {
                                                setExpanded(true);
                                                column.meta?.onExpand?.(e, {
                                                    rowId: original.id,
                                                    target: formControlRef?.current,
                                                    value,
                                                    onClose: () => {
                                                        setExpanded(false);
                                                        setAnchorEl(null);
                                                        setFocus(false);
                                                        setEditing(false);
                                                        loading.current = false;
                                                        // if (getIsSelected()) {
                                                        //     getToggleSelectedHandler()({});
                                                        // }
                                                    },
                                                });
                                            }
                                        }, 100);
                                    }
                                }}
                            >
                                <Icon name="more" fontSize={20} />
                            </IconButton>
                        </div>
                    )}
                {(column.type === 'Date' ||
                    column.type === 'Time' ||
                    column.type === 'Datetime' ||
                    column.type === 'SingleSelection' ||
                    column.type === 'Priority' ||
                    column.type === 'Assignee') &&
                    editable && (
                        <div className={styles.actionContainer}>
                            <IconButton
                                variant="text"
                                type="secondary"
                                size="xs"
                                fontSize={20}
                                sx={{
                                    opacity: 1,
                                    '&.Mui-disabled': {
                                        color: 'var(--color-light-3)',
                                    },
                                }}
                                {...(column.meta?.defaultFieldName === 'stage' && { disabled: value === 'Unidentified Lead' })}
                                onClick={(e) => {
                                    if (column.enableEditing || column.enableEditing === undefined) {
                                        setEditing(true);
                                        setFocus(false);

                                        // getToggleSelectedHandler()({});
                                        let disabled = false;
                                        if (column.fieldProps?.disabled && typeof column.fieldProps.disabled === 'function') {
                                            disabled = column.fieldProps?.disabled(original);
                                        } else if (column.fieldProps?.disabled && typeof column.fieldProps.disabled === 'boolean') {
                                            disabled = column.fieldProps?.disabled;
                                        }
                                        setTimeout(() => {
                                            switch (column.type) {
                                                case 'Date':
                                                    if (datePickerRef?.current && !disabled) {
                                                        datePickerRef?.current.openPicker();
                                                    }
                                                    break;
                                                case 'Time':
                                                    if (timePickerRef?.current && !disabled) {
                                                        timePickerRef?.current.openPicker();
                                                    }
                                                    break;
                                                case 'Datetime':
                                                    if (datetimePickerRef?.current && !disabled) {
                                                        datetimePickerRef?.current.openPicker();
                                                    }
                                                    break;
                                                case 'SingleSelection':
                                                case 'Assignee':
                                                case 'Priority':
                                                    if (inputRef?.current && !disabled) {
                                                        (inputRef?.current as SelectRef).openPicker();
                                                    }
                                                    break;
                                                default:
                                                    break;
                                            }
                                        }, 100);
                                    }
                                }}
                            >
                                <Icon name="dropDown" fontSize={24} />
                            </IconButton>
                        </div>
                    )}
            </div>
        );
    };

    return (
        <ClickAwayListener
            onClickAway={() => {
                if (expanded) {
                    return;
                }
                if (originalId.current !== original.id) {
                    originalId.current = original.id;
                    if (editing) {
                        setFocus(false);
                        setValue(initialValue);
                        setEditing(false);
                        loading.current = false;
                        // if (table.getIsSomeRowsSelected()) {
                        //     table.getToggleAllRowsSelectedHandler();
                        // }
                    }
                    return;
                }
                if (editing) {
                    handleEdit();
                } else {
                    setFocus(false);
                    setValue(initialValue);
                    setEditing(false);
                    loading.current = false;
                    // if (table.getIsSomeRowsSelected()) {
                    //     table.getToggleAllRowsSelectedHandler();
                    // }
                }
            }}
        >
            <div
                className={`${styles.cell} ${bordered ? styles.bordered : ''} ${cellColumn?.getIsPinned() ? styles.sticky : ''} ${
                    !editable ? styles.notEditable : ''
                } ${focus ? styles.focus : ''}`}
            >
                <div className={styles.inner}>
                    <div ref={containerRef}>{renderContent()}</div>
                </div>
            </div>
        </ClickAwayListener>
    );
};

export default typedMemo(EditableColumn);
