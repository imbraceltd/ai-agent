import {
    channelIconMapping,
    DatePickerRef,
    DateTimePickerRef,
    FieldTextProps,
    Option,
    SelectRef,
    TimePickerRef,
    Checkbox,
    EllipsisText,
    FieldText,
    Icon,
    IconButton,
    Space,
    Tooltip,
    Typography,
} from '@imbrace/ui';
import { Chip, ClickAwayListener } from '@mui/material';
import clsx from 'clsx';
import { isValid } from 'date-fns';
import dayjs from 'dayjs';
import { forwardRef, useEffect, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import Fields from '@/components/FlexibleTable/fields';
import LinkPreviewField from '@/components/FlexibleTable/linkPreview';
import type { ColumnValue } from '@/components/FlexibleTable/types';
import { getMembers } from '@/services/api/user';
import apiFetch from '@/services/axios/handler';
import styles from './editableColumn.module.scss';
import type { RecordValue } from '../types';
import { queryClient } from '@/App';

const validateText = (text?: ColumnValue) => {
    if (text === '' || typeof text === 'undefined') {
        return '—';
    }
    return text;
};

interface FieldColumnProps {
    editable?: boolean;
    fieldType: API.FieldType;
    fieldId: string;
    fieldProps?: FieldTextProps;
    value: API.RecordValue;
    record: API.BoardItem;
    dataEnum?: Record<string | number, string>;
    request?: () => Promise<Option[]>;
    validate?: (value?: unknown) => boolean | string;
    disabled?: (() => boolean) | boolean;
    meta?: {
        defaultCountryCode?: string;
        defaultFieldName?: string;
        defaultCurrencyCode?: string;
    };
    updateData?: (value: { fieldId: string; value: RecordValue; recordId: string }) => void;
    readonly?: boolean;
    bordered?: 'hover' | 'always';
    editing?: boolean;
    setEditing?: (value: boolean) => void;
    currentValue: API.RecordValue;
    onChange?: (value: API.RecordValue, isValid?: boolean) => void;
    onKeyDownCapture?: (event: React.KeyboardEvent<HTMLDivElement>) => void;
    onClick?: (event: React.MouseEvent<HTMLDivElement>) => void;
    disabledTooltip?: string;
    notesProps?: {
        hideButton?: boolean;
        buttonDisplayType?: 'always' | 'hover';
        onAdd?: () => void;
        inModal?: boolean;
    };
    focus?: boolean;
}

export const FieldColumn = forwardRef<HTMLDivElement, FieldColumnProps>((props, ref) => {
    const {
        value,
        editable,
        fieldType,
        fieldId,
        fieldProps,
        record,
        meta,
        dataEnum,
        request,
        validate,
        disabled,
        readonly,
        editing,
        setEditing,
        currentValue,
        onChange,
        onKeyDownCapture,
        bordered,
        disabledTooltip,
        focus,
        onClick,
    } = props;
    const containerRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement | SelectRef>(null);
    const formControlRef = useRef<HTMLDivElement>(null);
    const datePickerRef = useRef<DatePickerRef>(null);
    const timePickerRef = useRef<TimePickerRef>(null);
    const datetimePickerRef = useRef<DateTimePickerRef>(null);
    const { t } = useTranslation();

    const renderField = () => {
        switch (fieldType) {
            case 'Checkbox':
                return (
                    <div
                        style={{
                            padding: '9px 0px 9px 12px',
                        }}
                    >
                        <Fields
                            ref={inputRef}
                            type="Checkbox"
                            fieldId={fieldId}
                            value={value}
                            checked={value as unknown as boolean}
                            onChange={(v) => {
                                onChange?.(v as API.RecordValue);
                            }}
                            formControlRef={formControlRef}
                            fieldProps={{
                                inputProps: {
                                    autoFocus: false,
                                },
                                autoFocus: false,
                            }}
                        />
                    </div>
                );
            case 'MultipleSelection':
                return (
                    <Fields
                        ref={inputRef}
                        type={fieldType}
                        value={typeof value === 'string' && value === '' ? [] : value}
                        enum={dataEnum}
                        fieldId={fieldId}
                        onChange={(v, newIsValid = true) => {
                            onChange?.(v as API.RecordValue, newIsValid);
                        }}
                        formControlRef={formControlRef}
                        validate={validate}
                        fieldProps={{
                            ...fieldProps,
                            enableSorting: false,
                            sx: {
                                height: '100%',
                            },
                            ...(disabled &&
                                typeof disabled === 'function' && {
                                    disabled: disabled(),
                                }),
                        }}
                    />
                );
            default:
                return (
                    <Fields
                        key={`${record.id}`}
                        type={fieldType}
                        fieldId={fieldId}
                        ref={inputRef}
                        value={
                            typeof value === 'object' && !Array.isArray(value) && value && !(value instanceof Date)
                                ? '_id' in value
                                    ? value?._id
                                    : 'country_code' in value && fieldType === 'Country'
                                    ? value?.country_code
                                    : value
                                : value
                        }
                        enum={dataEnum}
                        formControlRef={formControlRef}
                        onChange={async (v, newIsValid = true) => {
                            onChange?.(v as API.RecordValue, newIsValid);
                        }}
                        validate={validate}
                        fieldProps={{
                            ...(disabled && typeof disabled === 'function'
                                ? {
                                      disabled: disabled(),
                                      disabledTooltip,
                                  }
                                : {
                                      disabled,
                                      disabledTooltip,
                                  }),
                            ...(fieldType === 'Datetime' && { datetimePickerRef: datetimePickerRef }),
                            ...(fieldType === 'Date' && { datePickerRef: datePickerRef }),
                            ...(fieldType === 'Time' && { timePickerRef: timePickerRef }),
                            ...((fieldType === 'SingleSelection' || fieldType === 'Assignee' || fieldType === 'Priority') && {
                                request,
                            }),
                            ...(fieldType === 'Assignee' &&
                                value && {
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
                            ...(fieldType === 'Assignee' && {
                                request: async () => {
                                    const { data } = await apiFetch<API.User[]>(getMembers.api, getMembers.method, {
                                        status: 'active',
                                    });
                                    return data;
                                },
                                querySelect: (users: API.User[]) => {
                                    return users.map((user) => ({
                                        value: user.id,
                                        text: user.display_name,
                                    }));
                                },
                            }),
                            ...(fieldType === 'MultipleAssignee' && {
                                request: async () => {
                                    const { data } = await apiFetch<API.User[]>(getMembers.api, getMembers.method, {
                                        status: 'active',
                                    });
                                    return data;
                                },
                                querySelect: (users: API.User[]) => {
                                    return users.map((user) => ({
                                        value: user.id,
                                        text: user.display_name,
                                    }));
                                },
                            }),
                            // ...(fieldType !== 'Datetime' &&
                            //     fieldType !== 'Date' &&
                            //     fieldType !== 'Time' && {
                            //         inputProps: {
                            //             autoFocus: true,
                            //         },
                            //     }),
                            ...(fieldType === 'LongText' && {
                                minRows: 4,
                                maxRows: 1000,
                                sx: {
                                    '& .MuiInputBase-input': { padding: '12px' },
                                },
                            }),
                            ...(fieldType === 'Origin' && {
                                disabled: record.created_type === 'system',
                                disabledTooltip: t('origin_system_filled_tooltip'),
                            }),
                            inputProps: {
                                autoFocus: true,
                            },
                            autoFocus: true,
                        }}
                        settings={{
                            defaultCountryCode: meta?.defaultCountryCode,
                            defaultCurrencyCode: meta?.defaultCurrencyCode,
                        }}
                    />
                );
        }
    };

    const renderFormattedValue = () => {
        if (typeof currentValue === 'undefined' || currentValue === null) {
            if (fieldType === 'Link') {
                return <Typography style={{ color: 'var(--color-light-4)' }}>—</Typography>;
            }
            if (fieldType === 'Checkbox') {
                return <Checkbox checked={false} disabled />;
            }
            return <Typography style={{ color: 'var(--color-light-4)' }}>—</Typography>;
        }
        if (dataEnum) {
            if (Array.isArray(currentValue)) {
                if (fieldType === 'MultipleSelection') {
                    const valueToDisplay = Array.isArray(currentValue) ? currentValue : [];
                    if (valueToDisplay.length > 0) {
                        return (
                            <Space size={8}>
                                {valueToDisplay
                                    .filter((enumValue) => enumValue !== undefined && enumValue !== null)
                                    .map((enumValue, optionIndex) => (
                                        <Chip
                                            key={`${record.id}-${optionIndex}`}
                                            sx={{
                                                height: 24,
                                                background: 'rgba(250, 153, 23, 0.2)',
                                                maxWidth: 'none',
                                            }}
                                            label={enumValue as string}
                                        />
                                    ))}
                            </Space>
                        );
                    }
                    return <Typography style={{ color: 'var(--color-light-4)' }}>—</Typography>;
                }
                const text = currentValue.map((v) => dataEnum?.[`${v}`]).join(', ');
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
            const text = `${validateText(dataEnum[`${currentValue}`] ?? currentValue)}`;

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
        if (fieldType === 'Link') {
            if (meta?.defaultFieldName !== 'contact_record' && meta?.defaultFieldName !== 'opportunity_record') {
                return <LinkPreviewField value={currentValue as string} />;
            }
        }
        if (fieldType === 'Assignee') {
            if (typeof currentValue === 'object') {
                const displayName = (currentValue as Record<string, string>)?.display_name;
                return (
                    <EllipsisText
                        text={`${displayName ?? '—'}`}
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
            } else {
                const users = queryClient.getQueryData<API.User[]>(['FlexibleTable', { type: 'Assignee', fieldId: fieldId }]);
                const targetUser = users?.find((user: API.User) => user.id === currentValue);
                const displayName = targetUser?.display_name ?? '—';
                return (
                    <EllipsisText
                        text={`${displayName ?? '—'}`}
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
        }
        if (fieldType === 'MultipleAssignee') {
            if (!currentValue || Array.isArray(currentValue) && currentValue.length === 0) return <Typography style={{ color: 'var(--color-light-4)' }}>—</Typography>;

            const values = Array.isArray(currentValue) ? currentValue : [];
            const users = queryClient.getQueryData<API.User[]>(['FlexibleTable', { type: 'MultipleAssignee', fieldId: fieldId }]);

            return (
                <Space size={8}>
                    {values.map((value, index) => {
                        let displayName;
                        if (typeof value === 'object' && value?.display_name) {
                            displayName = value.display_name;
                        } else {
                            const targetUser = users?.find((user: API.User) => user.id === value);
                            displayName = targetUser?.display_name ?? value;
                        }

                        return (
                            <Chip
                                key={index}
                                sx={{
                                    height: 24,
                                    background: 'rgba(250, 153, 23, 0.2)',
                                    maxWidth: 'none',
                                }}
                                label={displayName}
                            />
                        );
                    })}
                </Space>
            );
        }
        if (fieldType === 'Country') {
            const countryName = (currentValue as Record<string, string>)?.country_name;
            return (
                <EllipsisText
                    text={`${countryName ?? '—'}`}
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
        if (fieldType === 'Phone') {
            const phoneData = currentValue as Record<string, string>;
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
                    text={`${currentValue || '—'}`}
                    element={
                        <Typography
                            style={{
                                color: !currentValue ? 'var(--color-light-4)' : 'inherit',
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
        if (fieldType === 'Origin') {
            const {
                type,
                data: { name, type: dataType },
            } = currentValue as API.OriginValue;

            if (!currentValue || typeof currentValue !== 'object') {
                return <Typography style={{ color: 'var(--color-light-4)' }}>—</Typography>;
            }

            const iconType: Record<API.ProductType, keyof typeof channelIconMapping> = {
                business_contact_collector: 'crm',
                email_campaign: 'email',
                facebook_leads_management: 'facebook',
                facebook_social_media_management: 'facebook',
                'ai-assistant_management': 'imbraceai',
                form_management: 'formManagement',
                whatsapp_outbound: 'whatsapp',
                email_outbound: 'email',
            };

            if (type === 'customized') {
                return (
                    <EllipsisText
                        text={`${name ?? '—'}`}
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
                );
            }
            return (
                <Space size={12} align="center" justify="start" style={{ width: '100%' }}>
                    <Space>
                        <Icon
                            namespace="channel"
                            name={
                                type === 'channel' ? (dataType as keyof typeof channelIconMapping) : iconType[dataType as API.ProductType]
                            }
                            style={{ fontSize: 24 }}
                        />
                    </Space>

                    <EllipsisText
                        text={`${name ?? '—'}`}
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
        if (fieldType === 'Currency') {
            const currencyData = currentValue as API.CurrencyValue;
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
        if (fieldType === 'Checkbox') {
            return (
                <Checkbox
                    checked={currentValue as unknown as boolean}
                    color="secondary"
                    sx={{ cursor: 'default', color: 'red', '&.Mui-checked': { color: 'green' } }}
                    disabled
                />
            );
        }
        if (
            isValid(new Date(currentValue as string | number)) &&
            (fieldType === 'Datetime' || fieldType === 'Date' || fieldType === 'Time')
        ) {
            return (
                <EllipsisText
                    text={`${
                        fieldType === 'Datetime'
                            ? dayjs(currentValue as string | number).format('MM/DD/YYYY HH:mm')
                            : fieldType === 'Time'
                            ? dayjs(currentValue as string | number).format('HH:mm')
                            : dayjs(currentValue as string | number).format('MM/DD/YYYY')
                    }`}
                    element={
                        <Typography
                            style={{
                                color: currentValue === '' || typeof currentValue === 'undefined' ? 'var(--color-light-4)' : 'inherit',
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
        if (fieldType === 'LongText') {
            return <Typography>{currentValue as string}</Typography>;
        }
        return (
            <EllipsisText
                text={`${validateText(currentValue)}`}
                element={
                    <Typography
                        style={{
                            color: currentValue === '' || typeof currentValue === 'undefined' ? 'var(--color-light-4)' : 'inherit',
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
        if ((editing && editable) || record.id === 'new') {
            return (
                <div
                    className={styles.editing}
                    onKeyDownCapture={(event) => {
                        onKeyDownCapture?.(event);
                    }}
                >
                    {renderField()}
                </div>
            );
        }
        return (
            <div
                onClick={onClick}
                onDoubleClick={() => {
                    if (editable && !readonly) {
                        setEditing?.(true);

                        let isDisabled = false;
                        if (disabled && typeof disabled === 'function') {
                            isDisabled = disabled();
                        } else if (disabled && typeof disabled === 'boolean') {
                            isDisabled = disabled;
                        }

                        setTimeout(() => {
                            switch (fieldType) {
                                case 'Date':
                                    if (datePickerRef?.current && !isDisabled) {
                                        datePickerRef?.current.openPicker();
                                    }
                                    break;
                                case 'Time':
                                    if (timePickerRef?.current && !isDisabled) {
                                        timePickerRef?.current.openPicker();
                                    }
                                    break;
                                case 'SingleSelection':
                                case 'Assignee':
                                case 'Priority':
                                case 'MultipleSelection':
                                case 'MultipleAssignee':
                                case 'Origin':
                                    if (meta?.defaultFieldName === 'stage' && value === 'Unidentified Lead') {
                                        return;
                                    }

                                    if (inputRef?.current && !isDisabled) {
                                        (inputRef?.current as SelectRef).openPicker();
                                    }
                                    break;
                                default:
                                    break;
                            }
                        }, 100);
                    }
                }}
                ref={formControlRef}
                style={{
                    position: 'relative',
                    ...fieldProps?.sx,
                }}
            >
                <div
                    className={styles.valueContainer}
                    style={{
                        ...(fieldType === 'MultipleSelection' && {
                            padding: '7px 12px',
                        }),
                        // ...(fieldType === 'RichText' && {
                        //     padding: '0',
                        //     paddingLeft: '11px',
                        // }),
                        ...(fieldType === 'Link' && {
                            // padding: 0,
                            // paddingLeft:
                            //     meta?.defaultFieldName === 'contact_record' || meta?.defaultFieldName === 'opportunity_record'
                            //         ? '8.5px'
                            //         : 0,
                            height: '100%',
                            display: 'flex',
                            alignItems: 'center',
                        }),
                        ...(fieldType === 'LongText' && {
                            padding: '12px',
                        }),
                        ...(fieldType === 'Origin' && {
                            padding: '4px 11px',
                        }),
                        overflow: 'hidden',
                    }}
                >
                    {renderFormattedValue()}
                </div>

                {fieldType === 'MultipleSelection' && !readonly && (
                    <div className={styles.actionContainer}>
                        <IconButton
                            variant="text"
                            type="secondary"
                            size="s"
                            fontSize={20}
                            onClick={(e) => {
                                if (editable) {
                                    setEditing?.(true);
                                    let isDisabled = false;
                                    if (disabled && typeof disabled === 'function') {
                                        isDisabled = disabled();
                                    } else if (disabled && typeof disabled === 'boolean') {
                                        isDisabled = disabled;
                                    }

                                    setTimeout(() => {
                                        if (formControlRef?.current) {
                                            setTimeout(() => {
                                                switch (fieldType) {
                                                    case 'MultipleSelection':
                                                        if (inputRef?.current && !isDisabled) {
                                                            (inputRef?.current as SelectRef).openPicker();
                                                        }
                                                        break;
                                                    default:
                                                        break;
                                                }
                                            }, 100);
                                        }
                                    }, 100);
                                }
                            }}
                        >
                            <Icon name="more" fontSize={20} />
                        </IconButton>
                    </div>
                )}
                {(fieldType === 'Date' ||
                    fieldType === 'Time' ||
                    fieldType === 'SingleSelection' ||
                    fieldType === 'Priority' ||
                    fieldType === 'Assignee') &&
                    !readonly && (
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
                                {...(meta?.defaultFieldName === 'stage' && { disabled: value === 'Unidentified Lead' })}
                                onClick={(e) => {
                                    if (editable) {
                                        setEditing?.(true);
                                        // setFocus(false);

                                        let isDisabled = false;
                                        if (disabled && typeof disabled === 'function') {
                                            isDisabled = disabled();
                                        } else if (disabled && typeof disabled === 'boolean') {
                                            isDisabled = disabled;
                                        }
                                        setTimeout(() => {
                                            switch (fieldType) {
                                                case 'Date':
                                                    if (datePickerRef?.current && !isDisabled) {
                                                        datePickerRef?.current.openPicker();
                                                    }
                                                    break;
                                                case 'Time':
                                                    if (timePickerRef?.current && !isDisabled) {
                                                        timePickerRef?.current.openPicker();
                                                    }
                                                    break;
                                                case 'SingleSelection':
                                                case 'Assignee':
                                                case 'Priority':
                                                    if (inputRef?.current && !isDisabled) {
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
        <div
            ref={ref}
            className={clsx(
                styles.cell,
                !editable && styles.noEditable,
                bordered === 'always' && styles.bordered,
                readonly && styles.readonly,
                focus && styles.focus,
            )}
        >
            <div className={styles.inner}>
                <div ref={containerRef}>{renderContent()}</div>
            </div>
        </div>
    );
});

const EditableColumn = (
    props: Omit<FieldColumnProps, 'currentValue' | 'onChange'> & {
        disableClickAway?: boolean;
    },
) => {
    const { fieldId, record, updateData, bordered = 'hover', readonly, editing: controlledEditing, disableClickAway } = props;
    const [focus, setFocus] = useState(false);
    const [editing, setEditing] = useState(!!controlledEditing);
    const [value, setValue] = useState<API.RecordValue>(props.value ?? '');
    const [isValidValue, setIsValidValue] = useState(false);
    const loading = useRef(false);

    useEffect(() => {
        setEditing(!!controlledEditing);
    }, [controlledEditing]);

    useEffect(() => {
        setValue(props.value);
    }, [props.value]);

    const handleEdit = async () => {
        loading.current = true;
        if (focus) {
            setFocus(false);
        }
        const toggleEdit = () => {
            setValue(props.value);
            setEditing(false);
            loading.current = false;
        };

        if (!isValidValue && fieldId && !value && record.id === 'new') {
            toggleEdit();
            return;
        }
        if (fieldId && isValidValue && (editing || record.id === 'new')) {
            if (record.id === 'new') {
                if (value) {
                    await updateData?.({
                        fieldId,
                        value,
                        recordId: record.id,
                    });
                    toggleEdit();
                }
                return;
            }
            if (value !== record.fields[fieldId]) {
                if ((record.fields[fieldId] === null || record.fields[fieldId] === undefined) && value === '') {
                    toggleEdit();
                    return;
                }
                if (
                    Array.isArray(value) &&
                    (record.fields[fieldId] === null || record.fields[fieldId] === undefined) &&
                    value.length === 0
                ) {
                    toggleEdit();
                    return;
                }
                await updateData?.({
                    fieldId,
                    value,
                    recordId: record.id,
                });
                toggleEdit();
            }
        }

        if (editing) {
            toggleEdit();
        }
    };

    return (
        <ClickAwayListener
            onClickAway={() => {
                if (!readonly && !disableClickAway) {
                    if (editing) {
                        handleEdit();
                    } else {
                        setFocus(false);
                        setEditing(false);
                        loading.current = false;
                    }
                }
            }}
        >
            <div style={{ width: '100%' }}>
                <FieldColumn
                    {...props}
                    editing={editing}
                    value={value}
                    currentValue={props.value}
                    onChange={(v, newIsValid = true) => {
                        setIsValidValue(newIsValid);
                        setValue(v as API.RecordValue);
                    }}
                    focus={focus}
                    setEditing={setEditing}
                    onKeyDownCapture={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey && event.keyCode === 13 && !loading.current) {
                            if (props.fieldType === 'LongText') return;
                            handleEdit();
                        }
                        if (event.key === 'Escape') {
                            setValue(props.value);
                            setEditing(false);
                        }
                    }}
                    bordered={bordered}
                    notesProps={{
                        hideButton: true,
                        inModal: false,
                    }}
                    onClick={() => {
                        setFocus(true);
                    }}
                />
            </div>
        </ClickAwayListener>
    );
};

export const IdentifierField = forwardRef<
    HTMLInputElement,
    {
        value?: string;
        readonly?: boolean;
        editing?: boolean;
    } & FieldTextProps
>((props, ref) => {
    const { value, readonly, editing: controlledEditing, helperText, error, ...restProps } = props;
    const [editing, setEditing] = useState(!!controlledEditing);
    const inputRef = useRef<HTMLInputElement>(null);
    const { t } = useTranslation();

    useEffect(() => {
        setEditing(!!controlledEditing);
    }, [controlledEditing]);

    return (
        <>
            {editing && !readonly ? (
                <Tooltip title={helperText} arrow placement="bottom" open={!!error}>
                    <FieldText
                        fullWidth
                        formControlSx={{
                            '& > div': {
                                border: 'none',
                                padding: 0,
                            },
                            '.MuiInputBase-root': {
                                height: 'auto',
                            },
                        }}
                        sx={{
                            '.MuiInputBase-input': {
                                padding: 0,
                                fontWeight: 800,
                                fontSize: '20px',
                                lineHeight: '24px',
                                transition: 'all .3s ease',
                                height: 'auto',
                            },
                        }}
                        placeholder={t('name')}
                        autoFocus
                        inputRef={inputRef}
                        value={value}
                        {...restProps}
                    />
                </Tooltip>
            ) : (
                <Typography variant="Heading2">{value}</Typography>
            )}
        </>
    );
});

export const EditableIdentifier = ({
    fieldId,
    value,
    recordId,
    updateData,
    disableClickAway,
    readonly,
    editing: controlledEditing,
}: {
    fieldId: string;
    value?: string;
    recordId: string;
    updateData: (value: { fieldId: string; value: API.RecordValue; recordId: string }) => void;
    readonly?: boolean;
    editing?: boolean;
    disableClickAway?: boolean;
}) => {
    const [editing, setEditing] = useState(!!controlledEditing);
    const inputRef = useRef<HTMLInputElement>(null);
    const { t } = useTranslation();

    const { control, handleSubmit, reset, getValues } = useForm({
        defaultValues: {
            value: value,
        },
        mode: 'all',
    });

    useEffect(() => {
        reset({ value: value });
    }, [reset, value]);

    useEffect(() => {
        setEditing(!!controlledEditing);
    }, [controlledEditing]);

    const onSubmit = async (data: { value?: string }) => {
        await updateData({ fieldId, value: data.value, recordId });
    };

    const handleEdit = async () => {
        if (value === getValues('value')) {
            setEditing(false);
            reset({ value: value });
            return;
        }

        handleSubmit(onSubmit, (error) => {
            reset({ value: value });
        })();
        setEditing(false);
    };

    return (
        <ClickAwayListener
            onClickAway={(e) => {
                e.stopPropagation();
                if (!disableClickAway) {
                    if (editing) {
                        handleEdit();
                    }
                }
            }}
        >
            <div
                className={clsx(styles.editableField, styles.identifier, editing && styles.editing, readonly && styles.readonly)}
                {...(!editing && {
                    onDoubleClick: () => {
                        setEditing(true);
                        setTimeout(() => {
                            inputRef.current?.focus();
                        }, 10);
                    },
                })}
                {...(editing && {
                    onKeyDownCapture: (event) => {
                        if (event.key === 'Enter' && !event.shiftKey && event.keyCode === 13) {
                            handleEdit();
                        }
                        if (event.key === 'Escape') {
                            if (!disableClickAway) {
                                reset({ value: value });
                                setEditing(false);
                            }
                        }
                    },
                })}
            >
                <Controller
                    control={control}
                    name="value"
                    rules={{
                        required: {
                            value: true,
                            message: t('validation_field_required'),
                        },
                        maxLength: {
                            value: 150,
                            message: t('crm_field_short_text_length_limit'),
                        },
                    }}
                    render={({ field, fieldState: { error } }) => {
                        return (
                            <IdentifierField {...field} editing={editing} readonly={readonly} error={!!error} helperText={error?.message} />
                        );
                    }}
                />
            </div>
        </ClickAwayListener>
    );
};

export default EditableColumn;
