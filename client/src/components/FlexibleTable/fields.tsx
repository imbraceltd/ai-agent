import type {
    FieldCheckboxProps,
    FieldCurrencyProps,
    FieldDatePickerProps,
    FieldDateTimePickerProps,
    FieldNumberProps,
    FieldSelectProps,
    FieldTextProps,
    FieldTimePickerProps,
    FieldUploadProps,
    SelectRef,
} from '@imbrace/ui';
import {
    FieldCheckbox,
    FieldCountry,
    FieldCurrency,
    FieldDatePicker,
    FieldDatetimePicker,
    FieldNumber,
    FieldPhone,
    FieldSelect,
    FieldText,
    FieldTimePicker,
    FieldUpload,
    Icon,
    IconButton,
    Tooltip,
} from '@imbrace/ui';
import type { SelectChangeEvent } from '@mui/material';
import { useQueryClient } from '@tanstack/react-query';
import { t } from 'i18next';
import type { CountryCode } from 'libphonenumber-js';
import type { ChangeEvent, FocusEventHandler, ReactNode, RefObject } from 'react';
import { forwardRef, useCallback, useState } from 'react';

import { typedMemo } from '@/utils';

import type { NotesProps } from '../Notes';
import Notes from '../Notes';
import OriginField from '../Origin';
import type { AttachmentValue, ColumnType, ColumnValue, FieldProps, NotesValue } from './types';
import { getFilteredFileExtensions, getFilteredFileMIME, getAcceptAttribute, getFileTypeErrorMessage } from './utils';

interface FieldsProps {
    type?: ColumnType['type'];
    enum?: Record<string | number, string>;
    value?: ColumnValue;
    checked?: boolean;
    onBlur?: FocusEventHandler<HTMLInputElement | HTMLTextAreaElement>;
    onChange?: (value: ColumnValue, validate?: boolean) => void;
    placeholder?: string;
    fieldProps?: ColumnType['fieldProps'];
    isFilter?: boolean;
    formControlRef?: RefObject<HTMLDivElement>;
    validate?: (value?: ColumnValue) => boolean | string;
    settings?: {
        defaultCountryCode?: string;
        timeZone?: string;
        defaultCurrencyCode?: string;
    };
    bordered?: boolean;
    fieldId?: string;
    boardType?: API.BoardType;
}

export const Field = forwardRef<HTMLInputElement | SelectRef, FieldsProps>((props, ref) => {
    const { type, onBlur, onChange, value, placeholder, fieldProps, formControlRef, validate, settings, fieldId, boardType } = props;
    const [errorTooltip, setErrorTooltip] = useState({
        open: false,
        message: '',
    });
    const queryClient = useQueryClient();

    const handleValidate = useCallback(
        (newValue?: ColumnValue) => {
            if (validate) {
                const isValid = validate(newValue);
                if (typeof isValid === 'string') {
                    setErrorTooltip({
                        open: true,
                        message: isValid,
                    });
                    return false;
                }
                setErrorTooltip({
                    open: false,
                    message: '',
                });
                return true;
            }
            return true;
        },
        [validate],
    );

    const handleOnChange = useCallback(
        async (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement> | SelectChangeEvent<string | number | (string | number)[]>) => {
            if (validate) {
                const newValue = e.target.value;
                const isValid = handleValidate(newValue);
                onChange?.(newValue, typeof isValid === 'string' ? false : true);
                return;
            }

            onChange?.(e.target.value);
        },
        [onChange, validate, handleValidate],
    );

    const handleOnSelect = useCallback(
        async (selectedVal?: string | number | (string | number)[]) => {
            if (validate) {
                const newValue = selectedVal;
                const isValid = handleValidate(newValue);
                onChange?.(newValue, typeof isValid === 'string' ? false : true);
                return;
            }
            onChange?.(selectedVal);
        },
        [onChange, validate, handleValidate],
    );

    const renderField = () => {
        switch (type) {
            case 'Priority':
            case 'Assignee':
            case 'SingleSelection': {
                const { formControlSx, ...restFieldProps } = (fieldProps as Partial<FieldProps<FieldSelectProps<string | number>>>) ?? {};
                return (
                    <FieldSelect<string | number>
                        ref={ref as RefObject<SelectRef>}
                        queryKey={['FlexibleTable', { type, fieldId }]}
                        fullWidth
                        InputProps={{ ref: formControlRef }}
                        formControlSx={{ width: '100%', minWidth: 'auto', ...formControlSx }}
                        value={value as string | number}
                        onChange={handleOnSelect}
                        placeholder={placeholder}
                        {...(value && {
                            onReset: () => {
                                handleOnSelect('');
                            },
                        })}
                        {...restFieldProps}
                        request={
                            restFieldProps.request ||
                            (async () => {
                                return Object.entries(props.enum ?? {}).map(([key, eValue]) => ({
                                    value: key,
                                    text: eValue,
                                }));
                            })
                        }
                        {...(type === 'Assignee' && {
                            searchable: true,
                            searchFn: ({ option, search }) => {
                                if (!search) {
                                    return true;
                                }
                                const users = queryClient.getQueryData<API.User[]>(['FlexibleTable', { type, fieldId }]);
                                const targetUser = users?.find((user: API.User) => user.id === option.value);

                                if (!targetUser) {
                                    return false;
                                }

                                return targetUser.display_name.includes(search) || targetUser.email?.includes(search);
                            },
                        })}
                        popoverProps={{
                            disablePortal: false,
                        }}
                    />
                );
            }
            case 'MultipleSelection': {
                const { formControlSx, ...restFieldProps } =
                    (fieldProps as Partial<FieldProps<FieldSelectProps<(string | number)[]>>>) ?? {};
                return (
                    <FieldSelect<(string | number)[]>
                        ref={ref as RefObject<SelectRef>}
                        queryKey={['FlexibleTable', { type, fieldId }]}
                        fullWidth
                        InputProps={{ ref: formControlRef }}
                        formControlSx={{ width: '100%', minWidth: 'auto', ...formControlSx }}
                        value={value as (string | number)[]}
                        menuType="chip"
                        displayType="chip"
                        chipWrap
                        multiple
                        popoverProps={{
                            disablePortal: false,
                        }}
                        customIcon={(open) => (
                            <Icon
                                name="add"
                                fontSize={20}
                                style={{
                                    display: open ? 'none' : undefined,
                                    userSelect: 'none',
                                    pointerEvents: 'none',
                                    color: 'var(--color-light-4)',
                                }}
                            />
                        )}
                        onChange={handleOnSelect}
                        placeholder={placeholder}
                        hideSelectedItem
                        closeOnSelect={false}
                        {...restFieldProps}
                        request={
                            restFieldProps.request ||
                            (async () => {
                                return Object.entries(props.enum ?? {}).map(([key, eValue]) => ({
                                    value: key,
                                    text: eValue,
                                }));
                            })
                        }
                        {...(Array.isArray(value) &&
                            value.length > 0 && {
                                customIcon: () => (
                                    <IconButton
                                        variant="text"
                                        type="secondary"
                                        size="xs"
                                        onClick={() => {
                                            onChange?.([]);
                                        }}
                                    >
                                        <Icon name="close" fontSize={20} />
                                    </IconButton>
                                ),
                            })}
                    />
                );
            }
            case 'MultipleAssignee': {
                const { formControlSx, ...restFieldProps } = (fieldProps as Partial<FieldProps<FieldSelectProps<string | number>>>) ?? {};
                const renderValue = Array.isArray(value) ? value.map((v: any) => {
                    if(typeof v === 'object' && v._id) {
                        return v._id
                    }
                    return v
                }).filter(Boolean) : [];
                return (
                    <FieldSelect
                        value={renderValue}
                        onChange={(v) => {
                            onChange?.(v);
                        }}
                        queryKey={['FlexibleTable', { type, fieldId }]}
                        fullWidth
                        closeOnSelect={false}
                        placeholder="Multiple select"
                        displayType="chip"
                        request={
                            restFieldProps.request ||
                            (async () => {
                                return Object.entries(props.enum ?? {}).map(([key, eValue]) => ({
                                    value: key,
                                    text: eValue,
                                }));
                            })
                        }
                        searchable
                        multiple
                        {...restFieldProps}
                    />
                );
            }
            case 'Number': {
                const { sx, formControlSx, autoFocus = true, ...restFieldProps } = (fieldProps as FieldProps<FieldNumberProps>) ?? {};
                return (
                    <Tooltip open={errorTooltip.open} title={errorTooltip.message} disableFocusListener placement="top" arrow>
                        <div style={{ width: '100%' }}>
                            <FieldNumber
                                ref={ref as RefObject<HTMLInputElement>}
                                fullWidth
                                sx={{
                                    minWidth: 'auto',
                                    '& .MuiInputBase-input': { padding: '8.5px 11px' },
                                    height: '38px',
                                    background: 'white',
                                    ...sx,
                                }}
                                autoFocus={autoFocus}
                                InputProps={{ ref: formControlRef }}
                                formControlSx={{ width: '100%', minWidth: 'auto', ...formControlSx }}
                                value={value as number}
                                placeholder={placeholder}
                                {...restFieldProps}
                                onChange={async (e, isValidNumber) => {
                                    if (!isValidNumber) {
                                        setErrorTooltip({
                                            open: true,
                                            message: t('crm_number_field_validation_tooltip'),
                                        });
                                        return;
                                    }
                                    if (validate) {
                                        const newValue = e.target.value ? +e.target.value : '';
                                        const isValid = handleValidate(newValue);
                                        onChange?.(newValue, typeof isValid === 'string' ? false : true);
                                        return;
                                    }
                                    setErrorTooltip((prev) => ({
                                        ...prev,
                                        open: false,
                                    }));

                                    onChange?.(e.target.value ? +e.target.value : '');
                                }}
                                onBlur={onBlur}
                            />
                        </div>
                    </Tooltip>
                );
            }
            case 'Datetime': {
                const { sx, formControlSx, datetimePickerRef, ...restFieldProps } =
                    (fieldProps as FieldProps<FieldDateTimePickerProps>) ?? {};

                return (
                    <Tooltip open={errorTooltip.open} title={errorTooltip.message} disableFocusListener placement="top" arrow>
                        <div style={{ width: '100%' }}>
                            <FieldDatetimePicker
                                ref={ref as RefObject<HTMLInputElement>}
                                fullWidth
                                sx={{
                                    minWidth: 'auto',
                                    '& .MuiInputBase-input': { padding: '8.5px 11px' },
                                    height: '38px',
                                    background: 'white',
                                    ...sx,
                                }}
                                datetimePickerRef={datetimePickerRef}
                                InputProps={{ ref: formControlRef }}
                                formControlSx={{ width: '100%', minWidth: 'auto', ...formControlSx }}
                                value={value ? new Date(value as string | number) : null}
                                onChange={(date, isValidDate) => {
                                    if (isValidDate?.validationError) {
                                        const newValue = date;
                                        setErrorTooltip({
                                            open: true,
                                            message: t(`validation_datepicker_${isValidDate?.validationError}`),
                                        });
                                        onChange?.(newValue, false);
                                        return;
                                    }
                                    if (validate) {
                                        const newValue = date;
                                        const isValid = handleValidate(newValue);
                                        onChange?.(newValue, typeof isValid === 'string' ? false : true);
                                        return;
                                    }
                                    setErrorTooltip((prev) => ({
                                        ...prev,
                                        open: false,
                                    }));

                                    onChange?.(date);
                                }}
                                customIcon={(open) => (
                                    <Icon style={{ color: 'var(--color-light-4)' }} name={open ? 'dropUp' : 'dropDown'} />
                                )}
                                slotProps={{
                                    field: {
                                        sx: {
                                            display: 'grid',
                                            gridTemplateColumns: '1fr',
                                            gridAutoColumns: '35.5px',
                                            gridAutoFlow: 'column',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            minWidth: 'auto',
                                            '& .MuiInputAdornment-root': {
                                                marginLeft: 0,
                                            },
                                            '.MuiIconButton-root': {
                                                width: '28px !important',
                                                height: '28px !important',
                                                '& svg': {
                                                    fontSize: 20,
                                                },
                                            },
                                        },
                                    } as any,
                                    openPickerButton: {
                                        disabled: true,
                                    },
                                }}
                                placeholder={placeholder || 'MM/DD/YYYY HH:MM'}
                                {...restFieldProps}
                            />
                        </div>
                    </Tooltip>
                );
            }
            case 'Date': {
                const { sx, formControlSx, datePickerRef, ...restFieldProps } = (fieldProps as FieldProps<FieldDatePickerProps>) ?? {};

                return (
                    <Tooltip open={errorTooltip.open} title={errorTooltip.message} disableFocusListener placement="top" arrow>
                        <div style={{ width: '100%' }}>
                            <FieldDatePicker
                                ref={ref as RefObject<HTMLInputElement>}
                                fullWidth
                                sx={{
                                    minWidth: 'auto',
                                    '& .MuiInputBase-input': { padding: '8.5px 11px' },
                                    height: '38px',
                                    background: 'white',
                                    ...sx,
                                }}
                                datePickerRef={datePickerRef}
                                InputProps={{ ref: formControlRef }}
                                formControlSx={{ width: '100%', minWidth: 'auto', ...formControlSx }}
                                value={value ? new Date(value as string | number) : null}
                                onChange={(date, isValidDate) => {
                                    if (isValidDate?.validationError) {
                                        const newValue = date;
                                        setErrorTooltip({
                                            open: true,
                                            message: t(`validation_datepicker_${isValidDate?.validationError}`),
                                        });
                                        onChange?.(newValue, false);
                                        return;
                                    }
                                    if (validate) {
                                        const newValue = date;
                                        const isValid = handleValidate(newValue);
                                        onChange?.(newValue, typeof isValid === 'string' ? false : true);
                                        return;
                                    }
                                    setErrorTooltip((prev) => ({
                                        ...prev,
                                        open: false,
                                    }));

                                    onChange?.(date);
                                }}
                                customIcon={(open) => (
                                    <Icon style={{ color: 'var(--color-light-4)' }} name={open ? 'dropUp' : 'dropDown'} />
                                )}
                                slotProps={{
                                    field: {
                                        sx: {
                                            display: 'grid',
                                            gridTemplateColumns: '1fr',
                                            gridAutoColumns: '35.5px',
                                            gridAutoFlow: 'column',
                                            justifyContent: 'space-between',
                                            alignItems: 'center',
                                            minWidth: 'auto',
                                            '& .MuiInputAdornment-root': {
                                                marginLeft: 0,
                                            },
                                            '.MuiIconButton-root': {
                                                width: '28px !important',
                                                height: '28px !important',
                                                '& svg': {
                                                    fontSize: 20,
                                                },
                                            },
                                        },
                                    } as any,
                                    openPickerButton: {
                                        disabled: true,
                                    },
                                }}
                                placeholder={placeholder || 'MM/DD/YYYY'}
                                {...restFieldProps}
                            />
                        </div>
                    </Tooltip>
                );
            }
            case 'Time': {
                const {
                    sx,
                    formControlSx,
                    timePickerRef,
                    autoFocus = true,
                    ...restFieldProps
                } = (fieldProps as FieldProps<FieldTimePickerProps>) ?? {};
                return (
                    <FieldTimePicker
                        ref={ref as RefObject<HTMLInputElement>}
                        fullWidth
                        defaultValue={null}
                        sx={{
                            minWidth: 'auto',
                            '& .MuiInputBase-input': { padding: '8.5px 11px' },
                            height: '38px',
                            background: 'white',
                            ...sx,
                        }}
                        timePickerRef={timePickerRef}
                        InputProps={{ ref: formControlRef }}
                        formControlSx={{ width: '100%', minWidth: 'auto', ...formControlSx }}
                        value={(value as string) || null}
                        onChange={(date) => {
                            if (validate) {
                                const newValue = date;
                                const isValid = handleValidate(newValue);
                                onChange?.(newValue, typeof isValid === 'string' ? false : true);
                                return;
                            }

                            onChange?.(date);
                        }}
                        autoFocus={autoFocus}
                        customIcon={(open) => <Icon style={{ color: 'var(--color-light-4)' }} name={open ? 'dropUp' : 'dropDown'} />}
                        slotProps={{
                            field: {
                                sx: {
                                    display: 'grid',
                                    gridTemplateColumns: '1fr',
                                    gridAutoColumns: '35.5px',
                                    gridAutoFlow: 'column',
                                    justifyContent: 'space-between',
                                    alignItems: 'center',
                                    minWidth: 'auto',
                                    '& .MuiInputAdornment-root': {
                                        marginLeft: 0,
                                    },
                                    '.MuiIconButton-root': {
                                        width: '28px !important',
                                        height: '28px !important',
                                        '& svg': {
                                            fontSize: 20,
                                        },
                                    },
                                },
                            } as any,
                            openPickerButton: {
                                disabled: true,
                            },
                        }}
                        {...restFieldProps}
                    />
                );
            }
            case 'LongText': {
                const { sx, formControlSx, customIcon, ...restFieldProps } =
                    (fieldProps as FieldProps<FieldTextProps> & { customIcon?: () => ReactNode }) ?? {};
                return (
                    <FieldText
                        ref={ref as RefObject<HTMLInputElement>}
                        fullWidth
                        sx={{
                            minWidth: 'auto',
                            '& .MuiInputBase-input': { padding: '8.5px 11px' },
                            background: 'white',
                            ...sx,
                        }}
                        InputProps={{ ref: formControlRef }}
                        formControlSx={{ width: '100%', minWidth: 'auto', ...formControlSx }}
                        value={value as string}
                        onChange={handleOnChange}
                        onBlur={onBlur}
                        placeholder={placeholder}
                        multiline
                        {...(typeof restFieldProps.minRows === 'undefined' &&
                            typeof restFieldProps.maxRows === 'undefined' && {
                                rows: 4,
                            })}
                        endAdornment={customIcon?.()}
                        {...restFieldProps}
                    />
                );
            }
            case 'Email': {
                const { sx, formControlSx, ...restFieldProps } = (fieldProps as FieldProps<FieldTextProps>) ?? {};

                return (
                    <Tooltip open={errorTooltip.open} title={errorTooltip.message} disableFocusListener placement="top" arrow>
                        <div style={{ width: '100%' }}>
                            <FieldText
                                ref={ref as RefObject<HTMLInputElement>}
                                fullWidth
                                sx={{
                                    minWidth: 'auto',
                                    '& .MuiInputBase-input': { padding: '8.5px 11px' },
                                    height: '38px',
                                    background: 'white',
                                    ...sx,
                                }}
                                InputProps={{ ref: formControlRef }}
                                formControlSx={{ width: '100%', minWidth: 'auto', ...formControlSx }}
                                value={value as string}
                                placeholder={placeholder}
                                {...restFieldProps}
                                onChange={(e) => {
                                    const emailPattern = /^[a-zA-Z\d._%-]+@[[a-zA-Z\d.\-@]+\.[a-zA-Z]{2,4}$/;
                                    if (!emailPattern.test(e.target.value)) {
                                        setErrorTooltip({
                                            open: true,
                                            message: t('validation_email_pattern'),
                                        });
                                        onChange?.(e.target.value, false);
                                        return;
                                    }
                                    setErrorTooltip((prev) => ({
                                        ...prev,
                                        open: false,
                                    }));

                                    handleOnChange(e);
                                }}
                                onBlur={onBlur}
                            />
                        </div>
                    </Tooltip>
                );
            }
            case 'Phone': {
                const { sx, formControlSx, ...restFieldProps } = (fieldProps as FieldProps<FieldTextProps>) ?? {};

                return (
                    <Tooltip open={errorTooltip.open} title={errorTooltip.message} disableFocusListener placement="top" arrow>
                        <div style={{ width: '100%' }}>
                            <FieldPhone
                                ref={ref as RefObject<HTMLInputElement>}
                                fullWidth
                                sx={{
                                    minWidth: 'auto',
                                    height: '38px',
                                    background: 'white',
                                    ...sx,
                                }}
                                InputProps={{ ref: formControlRef }}
                                formControlSx={{ width: '100%', minWidth: 'auto', ...formControlSx }}
                                defaultCountryCode={settings?.defaultCountryCode as CountryCode}
                                value={
                                    value && typeof value === 'object' && 'phone' in value && 'country_code' in value
                                        ? (value as {
                                              country_code: CountryCode;
                                              phone: string;
                                              country_calling_code?: string;
                                              calling_code_with_number?: string;
                                              national_number?: string;
                                          })
                                        : undefined
                                }
                                onBlur={onBlur}
                                placeholder={placeholder}
                                {...restFieldProps}
                                onChange={(phoneValue, isValid) => {
                                    const newValue: {
                                        country_code?: CountryCode;
                                        phone?: string;
                                        country_calling_code?: string;
                                        calling_code_with_number?: string;
                                        national_number?: string;
                                    } = {
                                        ...phoneValue,
                                    };

                                    if (!phoneValue) {
                                        onChange?.({ phone: '', country_code: settings?.defaultCountryCode as CountryCode });
                                        return;
                                    }

                                    if (typeof isValid === 'string') {
                                        setErrorTooltip({
                                            open: true,
                                            message: t('validation_phone_field_pattern'),
                                        });
                                    } else {
                                        setErrorTooltip({
                                            open: false,
                                            message: '',
                                        });
                                    }

                                    onChange?.(newValue, typeof isValid === 'string' ? false : true);
                                }}
                            />
                        </div>
                    </Tooltip>
                );
            }
            case 'Country': {
                const { sx, formControlSx, ...restFieldProps } = (fieldProps as FieldProps<FieldTextProps>) ?? {};
                return (
                    <FieldCountry
                        fullWidth
                        popoverProps={{
                            disablePortal: false,
                        }}
                        formControlSx={{ width: '100%', minWidth: 'auto', ...formControlSx }}
                        value={value as string}
                        onChange={(countryCode?: string) => {
                            onChange?.(countryCode as string);
                        }}
                        {...restFieldProps}
                    />
                );
            }
            case 'Origin': {
                return (
                    <OriginField
                        disabled={props.fieldProps?.disabled as boolean}
                        enum={props.enum}
                        value={value as API.OriginValue}
                        onChange={(newValue) => {
                            onChange?.(newValue);
                        }}
                        selectRef={ref as RefObject<SelectRef>}
                    />
                );
            }
            case 'Attachment': {
                const { ...restProps } = (fieldProps as FieldProps<FieldUploadProps>) ?? {};

                return (
                    <FieldUpload
                        fullWidth
                        multiple
                        max={10}
                        containerRef={formControlRef}
                        accept={getAcceptAttribute(boardType)}
                        fileValidation={async (file: File) => {
                            const { size, name, type: fileType } = file;
                            const extension = name.slice(name.lastIndexOf('.') + 1).toLowerCase();
                            const allowedExtensions = getFilteredFileExtensions(boardType);
                            const allowedMimeTypes = getFilteredFileMIME(boardType);
                            if (
                                (!extension || allowedExtensions.indexOf(extension) === -1) &&
                                allowedMimeTypes.indexOf(fileType) === -1
                            ) {
                                return t('error_only_accept_file', { file: getFileTypeErrorMessage(boardType) });
                            }
                            if (size > 5 * 1000 * 1000) {
                                return t('error_file_size', { size: '5 MB' });
                            }
                            return true;
                        }}
                        {...restProps}
                        type="input"
                        value={
                            Array.isArray(value)
                                ? (value as AttachmentValue[])?.map((attachment, index) => ({
                                      id: attachment?.data?.key || `${fieldId}-attachment-${index}`,
                                      status: 'ok',
                                      url: attachment?.data?.url,
                                      name: attachment?.data?.name,
                                      fileId: attachment?.data.key,
                                      type: attachment?.data.extension,
                                      ...attachment.extra,
                                  }))
                                : []
                        }
                        onChange={(attachments) => {
                            onChange?.(
                                attachments?.map(
                                    (attachment) =>
                                        ({
                                            type: !!attachment.file || attachment.name !== attachment.url ? 'file' : 'url',
                                            data: {
                                                key: attachment.fileId,
                                                name: attachment.name || '',
                                                url: attachment.url || '',
                                                extension: attachment.type,
                                            },
                                            extra: attachment,
                                        } as AttachmentValue),
                                ),
                            );
                        }}
                    />
                );
            }
            case 'Notes': {
                const { ...restFieldProps } = (fieldProps as FieldProps<NotesProps>) ?? {};
                return (
                    <Notes
                        editing
                        {...restFieldProps}
                        bordered
                        style={{ padding: '0 12px' }}
                        ref={formControlRef as RefObject<HTMLInputElement>}
                        notes={(value as NotesValue[]) || []}
                        onChange={(notes) => {
                            onChange?.(notes);
                        }}
                    />
                );
            }
            case 'Currency': {
                const { sx, formControlSx, ...restFieldProps } = (fieldProps as FieldProps<FieldCurrencyProps>) ?? {};

                return (
                    <Tooltip open={errorTooltip.open} title={errorTooltip.message} disableFocusListener placement="top" arrow>
                        <div style={{ width: '100%' }}>
                            <FieldCurrency
                                ref={ref as RefObject<HTMLInputElement>}
                                fullWidth
                                sx={{
                                    minWidth: 'auto',
                                    height: '38px',
                                    background: 'white',
                                    ...sx,
                                }}
                                InputProps={{ ref: formControlRef }}
                                formControlSx={{ width: '100%', minWidth: 'auto', ...formControlSx }}
                                defaultCurrency={settings?.defaultCurrencyCode}
                                value={
                                    value && typeof value === 'object' && 'amounts' in value && 'currency_code' in value ? value : undefined
                                }
                                onBlur={onBlur}
                                placeholder={placeholder}
                                {...restFieldProps}
                                onChange={(currencyValue, isValid) => {
                                    if (!isValid) {
                                        setErrorTooltip({
                                            open: true,
                                            message: t('crm_number_field_validation_tooltip'),
                                        });
                                        return;
                                    }

                                    setErrorTooltip((prev) => ({
                                        ...prev,
                                        open: false,
                                    }));

                                    onChange?.(currencyValue, true);
                                }}
                            />
                        </div>
                    </Tooltip>
                );
            }
            case 'Checkbox': {
                const { sx, formControlSx, autoFocus = true, ...restFieldProps } = (fieldProps as FieldProps<FieldCheckboxProps>) ?? {};
                return (
                    <div>
                        <FieldCheckbox
                            containerRef={formControlRef}
                            sx={{
                                ...sx,
                            }}
                            autoFocus={autoFocus}
                            InputProps={{ ref: formControlRef }}
                            formControlSx={{ width: '100%', minWidth: 'auto', ...formControlSx }}
                            checked={value as boolean}
                            placeholder={placeholder}
                            onChange={async (e) => {
                                onChange?.(e);
                            }}
                            {...restFieldProps}
                        />
                    </div>
                );
            }
            case 'Link':
            case 'ShortText':
            default: {
                const { sx, formControlSx, ...restFieldProps } = (fieldProps as FieldProps<FieldTextProps>) ?? {};

                return (
                    <Tooltip open={errorTooltip.open} title={errorTooltip.message} disableFocusListener placement="top" arrow>
                        <div style={{ width: '100%' }}>
                            <FieldText
                                ref={ref as RefObject<HTMLInputElement>}
                                fullWidth
                                sx={{
                                    minWidth: 'auto',
                                    '& .MuiInputBase-input': { padding: '8.5px 11px' },
                                    height: '38px',
                                    background: 'white',
                                    ...sx,
                                }}
                                InputProps={{ ref: formControlRef }}
                                formControlSx={{ width: '100%', minWidth: 'auto', ...formControlSx }}
                                value={value as string}
                                onBlur={onBlur}
                                placeholder={placeholder}
                                {...restFieldProps}
                                onChange={handleOnChange}
                            />
                        </div>
                    </Tooltip>
                );
            }
        }
    };

    return renderField();
});

const Fields = forwardRef<HTMLInputElement | SelectRef, FieldsProps>((props, ref) => {
    const { fieldProps } = props;

    return (
        <Tooltip
            disableHoverListener={!fieldProps?.disabledTooltip ? true : !fieldProps?.disabled}
            disableTouchListener
            disableFocusListener
            placement="bottom"
            title={fieldProps?.disabledTooltip}
            arrow
        >
            <div style={{ width: '100%' }}>
                <Field {...props} ref={ref} />
            </div>
        </Tooltip>
    );
});

export default typedMemo(Fields);
