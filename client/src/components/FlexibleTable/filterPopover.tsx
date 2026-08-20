import {
    Button,
    Dropdown,
    EllipsisText,
    FieldDateRangePicker,
    FieldDateTimeRangePicker,
    FieldNumber,
    FieldRangeNumber,
    FieldSelect,
    FieldTimeRangePicker,
    Icon,
    IconButton,
    Space,
    Tooltip,
    Typography,
} from '@imbrace/ui';
import { Popover } from '@mui/material';
import type { ColumnDef } from '@tanstack/react-table';
import type { TFunction } from 'i18next';
import { uniqueId } from 'lodash';
import type { ForwardedRef, ReactElement, ReactNode } from 'react';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useTranslation } from 'react-i18next';

import OriginFilterField from '../Origin/filter';
import Fields from './fields';
import styles from './index.module.scss';
import type { ColumnType, ColumnValue, FieldType } from './types';

export const OperatorMapper = {
    is: '{{id}} = {{value}}',
    is_for_date: '{{id}} >= {{value1}} AND {{id}} <= {{value2}}',
    is_not: '{{id}} != {{value}}',
    is_not_for_date: '{{id}} < {{value1}} OR {{id}} > {{value2}}',
    contains: '{{id}} IN {{[value]}}',
    not_contains: '{{id}} NOT IN {{[value]}}',
    is_empty: '({{id}} IS EMPTY OR {{id}} IS NULL OR {{id}} NOT EXISTS)',
    is_not_empty: '(NOT {{id}} IS EMPTY AND NOT {{id}} IS NULL AND {{id}} EXISTS)',
    is_smaller_than: '{{id}} < {{value}}',
    is_before: '{{id}} < {{value}}',
    is_smaller_or_equal_to: '{{id}} <= {{value}}',
    is_before_and_on: '{{id}} <= {{value}}',
    is_larger_than: '{{id}} > {{value}}',
    is_after: '{{id}} > {{value}}',
    is_larger_or_equal_to: '{{id}} >= {{value}}',
    is_after_and_on: '{{id}} >= {{value}}',
    is_between: '{{id}} > {{value1}} AND {{id}} < {{value2}}',
    is_checked: '{{id}} = true',
    is_not_checked: '{{id}} IS EMPTY OR {{id}} IS NULL OR {{id}} NOT EXISTS OR {{id}} = false',
};

export const TextOperatorOptions: (t: TFunction<'translation', undefined>) => { index: API.Operator; text: string }[] = (t) => [
    {
        index: 'is',
        text: t('is'),
    },
    {
        index: 'is_not',
        text: t('is_not'),
    },
    {
        index: 'is_empty',
        text: t('is_empty'),
    },
    {
        index: 'is_not_empty',
        text: t('is_not_empty'),
    },
];

export const SelectionOperatorOptions: (t: TFunction<'translation', undefined>) => { index: API.Operator; text: string }[] = (t) => [
    {
        index: 'contains',
        text: t('contains'),
    },
    {
        index: 'not_contains',
        text: t('not_contains'),
    },
    {
        index: 'is_empty',
        text: t('is_empty'),
    },
    {
        index: 'is_not_empty',
        text: t('is_not_empty'),
    },
];

export const NumberOperatorOptions: (t: TFunction<'translation', undefined>) => { index: API.Operator; text: string }[] = (t) => [
    {
        index: 'is',
        text: t('is'),
    },
    {
        index: 'is_not',
        text: t('is_not'),
    },
    {
        index: 'is_between',
        text: t('is_between'),
    },
    {
        index: 'is_smaller_than',
        text: `< (${t('is_smaller_than')})`,
    },
    {
        index: 'is_larger_than',
        text: `> (${t('is_larger_than')})`,
    },
    {
        index: 'is_smaller_or_equal_to',
        text: `<= (${t('is_smaller_or_equal_to')})`,
    },
    {
        index: 'is_larger_or_equal_to',
        text: `>= (${t('is_larger_or_equal_to')})`,
    },
    {
        index: 'is_empty',
        text: t('is_empty'),
    },
    {
        index: 'is_not_empty',
        text: t('is_not_empty'),
    },
];

export const DateOperatorOptions: (t: TFunction<'translation', undefined>) => { index: API.Operator; text: string }[] = (t) => [
    {
        index: 'is',
        text: t('is'),
    },
    {
        index: 'is_not',
        text: t('is_not'),
    },

    {
        index: 'is_before',
        text: t('is_before'),
    },
    {
        index: 'is_after',
        text: t('is_after'),
    },
    {
        index: 'is_before_and_on',
        text: t('is_before_and_on'),
    },
    {
        index: 'is_after_and_on',
        text: t('is_after_and_on'),
    },
    {
        index: 'is_between',
        text: t('is_between'),
    },
];

export const TimeOperatorOptions: (t: TFunction<'translation', undefined>) => { index: API.Operator; text: string }[] = (t) => [
    {
        index: 'is',
        text: t('is'),
    },
    {
        index: 'is_not',
        text: t('is_not'),
    },

    {
        index: 'is_before',
        text: t('is_before'),
    },
    {
        index: 'is_after',
        text: t('is_after'),
    },
    {
        index: 'is_before_and_on',
        text: t('is_before_and_on'),
    },
    {
        index: 'is_after_and_on',
        text: t('is_after_and_on'),
    },
    {
        index: 'is_between',
        text: t('is_between'),
    },
    {
        index: 'is_empty',
        text: t('is_empty'),
    },
    {
        index: 'is_not_empty',
        text: t('is_not_empty'),
    },
];

export const NotesOperatorOptions: (t: TFunction<'translation', undefined>) => { index: API.Operator; text: string }[] = (t) => [
    {
        index: 'is_empty',
        text: t('is_empty'),
    },
    {
        index: 'is_not_empty',
        text: t('is_not_empty'),
    },
];
export const CheckboxOperatorOptions: (t: TFunction<'translation', undefined>) => { index: API.Operator; text: string }[] = (t) => [
    {
        index: 'is_checked',
        text: t('is_checked'),
    },
    {
        index: 'is_not_checked',
        text: t('is_not_checked'),
    },
];

export type FilterValue = {
    operator?: API.Operator;
    value?: ColumnValue;
    condition?: 'and' | 'or';
};

const FilterPopover = <D extends { id: string }>({
    anchorEl,
    handleClose,
    title,
    type = 'ShortText',
    initialValue,
    valueEnum,
    onFilter,
    column,
}: {
    column: ColumnDef<D, ColumnValue> & ColumnType;
    anchorEl?: HTMLElement;
    handleClose: () => void;
    title: string | ReactNode;
    type: FieldType;
    initialValue?: FilterValue;
    valueEnum?: Record<string | number, string>;
    onFilter: (value?: FilterValue) => Promise<void>;
}) => {
    const { t } = useTranslation();
    const [value, setValue] = useState<ColumnValue | API.OriginValue[] | null>(initialValue?.value ?? '');
    const [operator, setOperator] = useState<API.Operator>(initialValue?.operator ?? 'is');
    const [errorTooltip, setErrorTooltip] = useState({
        open: false,
        message: '',
    });

    const open = Boolean(anchorEl);

    const fieldType = useMemo(() => {
        if (type === 'SingleSelection' || type === 'Assignee' || type === 'Priority' || type === 'Attachment') {
            if (['contains', 'not_contains'].indexOf(operator) !== -1) {
                return 'MultipleSelection';
            }
        }
        if (type === 'Currency') {
            return 'Number';
        }
        return type;
    }, [type, operator]);

    const operatorsOptions = useMemo(() => {
        if (type === 'Number') {
            return NumberOperatorOptions(t);
        }
        if (type === 'Date') {
            return DateOperatorOptions(t);
        }
        if (type === 'Time' || type === 'Datetime') {
            return TimeOperatorOptions(t);
        }
        if (type === 'Notes') {
            return NotesOperatorOptions(t);
        }
        if (type === 'Checkbox') {
            return CheckboxOperatorOptions(t);
        }

        if (
            type === 'MultipleSelection' ||
            type === 'SingleSelection' ||
            type === 'Assignee' ||
            type === 'Priority' ||
            type === 'Country' ||
            type === 'Attachment' ||
            type === 'Origin'
        ) {
            return SelectionOperatorOptions(t);
        }
        return TextOperatorOptions(t);
    }, [type, t]);

    useEffect(() => {
        if (initialValue?.operator && operatorsOptions.find((option) => option.index === initialValue?.operator)) {
            setOperator(initialValue?.operator);
        } else {
            setOperator(operatorsOptions[0].index);
        }
    }, [operatorsOptions, initialValue?.operator]);

    const renderRelativeSelector = useCallback(() => {
        if (
            ['is_empty', 'is_not_empty', 'is_between', 'is_after_and_on', 'is_before_and_on'].indexOf(operator) === -1 &&
            fieldType === 'Date'
        ) {
            return (
                <FieldSelect
                    queryKey={['dataBoard', 'filter', 'relativeCondition', operator]}
                    value={((value as string[])?.[0] as string) ?? ''}
                    onChange={(selectedValue) => {
                        setValue(
                            (prev) =>
                                [
                                    selectedValue,
                                    (prev as string[])[0] === 'exactly' && selectedValue !== 'exactly'
                                        ? '1'
                                        : selectedValue === 'exactly'
                                        ? null
                                        : (prev as string[])[1],
                                    (prev as string[])[2] ?? 'day',
                                ] as string[],
                        );
                    }}
                    request={async () => {
                        return operator === 'is' || operator === 'is_not'
                            ? [
                                  { text: t('relative_exactly'), value: 'exactly' },
                                  { text: t('relative_last'), value: 'last' },
                                  { text: t('relative_next'), value: 'next' },
                                  { text: t('relative_empty'), value: 'empty' },
                              ]
                            : [
                                  { text: t('relative_exactly'), value: 'exactly' },
                                  { text: t('relative_last'), value: 'last' },
                                  { text: t('relative_next'), value: 'next' },
                              ];
                    }}
                    formControlSx={{
                        width: 100,
                        minWidth: 100,
                    }}
                    fullWidth
                />
            );
        }
        return null;
    }, [fieldType, value, operator, t]);

    const renderFields = useCallback(() => {
        if (['is_empty', 'is_not_empty', 'is_between', 'is_checked', 'is_not_checked'].indexOf(operator) === -1) {
            if (fieldType === 'Date') {
                if ((value as string[])[0] === 'empty') {
                    return null;
                }
                if ((value as string[])[0] === 'last' || (value as string[])[0] === 'next') {
                    return (
                        <>
                            <Tooltip open={errorTooltip.open} title={errorTooltip.message} disableFocusListener placement="top" arrow>
                                <div style={{ width: 52 }}>
                                    <FieldNumber
                                        value={(value as string[])[1]}
                                        onChange={(e, valid) => {
                                            if (valid) {
                                                setValue(
                                                    (prev) => [(prev as string[])[0], +e.target.value, (prev as string[])[2]] as string[],
                                                );
                                                setErrorTooltip((prev) => ({
                                                    ...prev,
                                                    open: false,
                                                }));
                                                return;
                                            }
                                            setErrorTooltip({
                                                open: true,
                                                message: t('crm_number_field_validation_tooltip'),
                                            });
                                        }}
                                        formControlSx={{
                                            width: 52,
                                            minWidth: 52,
                                        }}
                                        sx={{
                                            height: 38,
                                        }}
                                        fullWidth
                                        min={1}
                                    />
                                </div>
                            </Tooltip>

                            <FieldSelect
                                queryKey={['dataBoard', 'filter', (value as string[])[0], 'condition']}
                                value={(value as string[])[2]}
                                onChange={(selectedValue) => {
                                    setValue((prev) => [(prev as string[])[0], (prev as string[])[1], selectedValue] as string[]);
                                }}
                                request={async () => {
                                    return [
                                        { text: t('day_other'), value: 'day' },
                                        { text: t('week_other'), value: 'week' },
                                        { text: t('month_other'), value: 'month' },
                                        { text: t('year_other'), value: 'year' },
                                    ];
                                }}
                                formControlSx={{
                                    width: 100,
                                    minWidth: 100,
                                }}
                                fullWidth
                            />
                        </>
                    );
                }
                return (
                    <Fields
                        type={fieldType}
                        value={(value as string[])[1] ?? ''}
                        fieldProps={{
                            inputProps: {
                                autoFocus: false,
                            },
                        }}
                        onChange={(v) => {
                            setValue((prev) => [(prev as string[])[0], v] as string[]);
                        }}
                    />
                );
            }
            if (fieldType === 'Origin') {
                return (
                    <OriginFilterField
                        value={(value as API.OriginValue[]) || []}
                        enum={valueEnum}
                        onChange={(newValue) => {
                            const prevValue = (value as API.OriginValue[]) || ([] as API.OriginValue[]);

                            const ids = new Set(prevValue.map((item) => item.data.id));
                            if (ids.has(newValue.data.id)) {
                                ids.delete(newValue.data.id);
                            } else {
                                ids.add(newValue.data.id);
                            }
                            setValue(
                                [...ids].map((id) => [...prevValue, newValue].find((item) => item.data.id === id)) as API.OriginValue[],
                            );
                        }}
                        onDelete={(id) => {
                            const prevValue = (value as API.OriginValue[]) || ([] as API.OriginValue[]);
                            const newValue = prevValue.filter((item) => item.data.id !== id);
                            setValue(newValue);
                        }}
                        onReset={() => {
                            setValue([]);
                        }}
                    />
                );
            }
            return (
                <Fields
                    type={fieldType}
                    value={
                        fieldType === 'MultipleSelection' && typeof value === 'string'
                            ? value === ''
                                ? []
                                : [value]
                            : (value as ColumnValue)
                    }
                    enum={valueEnum}
                    onChange={(v) => {
                        setValue(v);
                    }}
                    fieldId={column.id}
                    placeholder={''}
                    fieldProps={{
                        inputProps: {
                            autoFocus: false,
                        },

                        ...(fieldType === 'MultipleSelection' && {
                            sx: {
                                height: '100%',
                                maxHeight: 'auto',
                            },
                            selectProps: {
                                wrap: false,
                            },
                            allowOutOfRangeValue: true,
                            ...(Array.isArray(value) &&
                                value.length > 0 && {
                                    selectProps: {
                                        customIcon: () => (
                                            <IconButton
                                                variant="text"
                                                type="secondary"
                                                size="xs"
                                                sx={{
                                                    position: 'absolute',
                                                    right: '12px',
                                                    top: '7px',
                                                }}
                                                onClick={() => {
                                                    setValue([]);
                                                }}
                                            >
                                                <Icon name="close" fontSize={20} />
                                            </IconButton>
                                        ),
                                    },
                                }),
                        }),
                        ...((fieldType === 'SingleSelection' || fieldType === 'Assignee' || fieldType === 'Priority') && {
                            allowOutOfRangeValue: true,
                        }),
                        ...(type === 'Assignee' && {
                            request: column.request,
                        }),
                        ...(fieldType === 'Assignee' &&
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
                    }}
                />
            );
        }
    }, [column.request, fieldType, operator, type, value, valueEnum, t, errorTooltip, column.id]);

    const renderRangeComponent = useCallback(() => {
        if (fieldType === 'Number') {
            return (
                <FieldRangeNumber
                    onChange={(v) => {
                        setValue(v);
                    }}
                    placeholder={[t('min'), t('max')]}
                    fullWidth
                    value={(Array.isArray(value) ? value : []) as [string | number, string | number]}
                />
            );
        }
        if (fieldType === 'Date') {
            return (
                <FieldDateRangePicker
                    onChange={(v) => {
                        setValue(v || null);
                    }}
                    fullWidth
                    value={(Array.isArray(value) ? value : []) as [Date, Date]}
                    datePickerProps={{
                        start: {
                            customIcon: (pickerOpen) => (
                                <Icon style={{ color: 'var(--color-light-4)' }} name={pickerOpen ? 'dropUp' : 'dropDown'} />
                            ),
                        },
                        end: {
                            customIcon: (pickerOpen) => (
                                <Icon style={{ color: 'var(--color-light-4)' }} name={pickerOpen ? 'dropUp' : 'dropDown'} />
                            ),
                        },
                    }}
                />
            );
        }
        if (fieldType === 'Datetime') {
            return (
                <FieldDateTimeRangePicker
                    fullWidth
                    value={(Array.isArray(value) ? value : []) as [Date, Date]}
                    dateTimePickerProps={{
                        start: {
                            customIcon: (pickerOpen) => (
                                <Icon style={{ color: 'var(--color-light-4)' }} name={pickerOpen ? 'dropUp' : 'dropDown'} />
                            ),
                        },
                        end: {
                            customIcon: (pickerOpen) => (
                                <Icon style={{ color: 'var(--color-light-4)' }} name={pickerOpen ? 'dropUp' : 'dropDown'} />
                            ),
                        },
                    }}
                    onChange={(v) => {
                        setValue(v || null);
                    }}
                />
            );
        }
        if (fieldType === 'Time') {
            return (
                <FieldTimeRangePicker
                    onChange={(v) => {
                        setValue(v || null);
                    }}
                    fullWidth
                    value={(Array.isArray(value) ? value : []) as [Date, Date]}
                    timePickerProps={{
                        start: {
                            defaultValue: null,
                            customIcon: (pickerOpen) => (
                                <Icon style={{ color: 'var(--color-light-4)' }} name={pickerOpen ? 'dropUp' : 'dropDown'} />
                            ),
                        },
                        end: {
                            defaultValue: null,
                            customIcon: (pickerOpen) => (
                                <Icon style={{ color: 'var(--color-light-4)' }} name={pickerOpen ? 'dropUp' : 'dropDown'} />
                            ),
                        },
                    }}
                />
            );
        }
        return null;
    }, [fieldType, value, t]);

    return (
        <Popover
            open={open}
            anchorEl={anchorEl}
            onClose={(e, reason) => {
                if ('stopPropagation' in e) {
                    (e as MouseEvent).stopPropagation();
                }
                handleClose();
            }}
            anchorOrigin={{
                vertical: 'bottom',
                horizontal: 'left',
            }}
            transformOrigin={{
                vertical: 'top',
                horizontal: 'left',
            }}
            slotProps={{
                paper: {
                    sx: {
                        boxShadow: 'none',
                        overflow: 'visible',
                        background: 'transparent',
                    },
                    onClick: (e) => {
                        e.stopPropagation();
                    },
                },
            }}
            autoFocus={false}
            disableEnforceFocus
        >
            <div className={styles.filterContainer}>
                <Space size={12} direction="vertical">
                    <div className={styles.header}>
                        <Space size={12} style={{ flex: 1 }}>
                            <Typography style={{ color: 'var(--color-light-5)' }}>{title}</Typography>
                            <Dropdown<API.Operator>
                                text={operatorsOptions.filter((o) => o.index === operator)?.[0]?.text}
                                variant="text"
                                hideOnSelect
                                typographyProps={{
                                    variant: 'Body',
                                    style: {
                                        color: 'var(--color-light-7)',
                                        textTransform: 'initial',
                                    },
                                }}
                                menuPaperProps={{
                                    sx: {
                                        width: '150px',
                                    },
                                }}
                                transformOrigin={{
                                    horizontal: 'center',
                                    vertical: 'top',
                                }}
                                anchorOrigin={{
                                    horizontal: 'center',
                                    vertical: 'bottom',
                                }}
                                selectedIndex={operator}
                                options={operatorsOptions}
                                onSelect={(e, selectedIndex) => {
                                    setOperator(selectedIndex);
                                    if (selectedIndex !== 'is' && selectedIndex !== 'is_not' && fieldType === 'Date') {
                                        if (
                                            (value as string[])[0] === 'empty' ||
                                            selectedIndex === 'is_after_and_on' ||
                                            selectedIndex === 'is_before_and_on'
                                        ) {
                                            setValue((prev) => ['exactly', (prev as string[])?.[1], (prev as string[])?.[2]] as string[]);
                                        }
                                    }
                                }}
                            />
                        </Space>
                    </div>
                    <Space size={12} style={{ width: '100%' }}>
                        {renderRelativeSelector()}
                        {renderFields()}
                        {operator === 'is_between' && renderRangeComponent()}
                    </Space>
                    <Space justify="end" style={{ width: '100%' }}>
                        <Button
                            size="xxs"
                            text={t('apply')}
                            onClick={() => {
                                onFilter({
                                    operator,
                                    value: value as ColumnValue,
                                    condition: 'and',
                                });

                                handleClose();
                            }}
                        />
                    </Space>
                </Space>
            </div>
        </Popover>
    );
};

interface FilterPopoverHOCProps<D> {
    column: ColumnDef<D, ColumnValue> & ColumnType;
    anchorEl: HTMLElement;
    title: string | ReactNode;
    type: FieldType;
    initialValue?: FilterValue;
    valueEnum?: Record<string | number, string>;
    onFilter: (value?: FilterValue) => Promise<void>;
    onClose?: () => void;
}

const FilterPopoverHOC = <D extends { id: string }>({ onClose, anchorEl, ...restProps }: FilterPopoverHOCProps<D>) => {
    const [open, setOpen] = useState<HTMLElement | undefined>(anchorEl);
    return (
        <FilterPopover<D>
            {...restProps}
            anchorEl={open}
            handleClose={() => {
                setOpen(undefined);
                onClose?.();
            }}
        />
    );
};

interface FilterPopoversProps {
    container?: HTMLElement;
}

interface FilterPopoversRef<D extends { id: string }> {
    openFilterPopover: (props: FilterPopoverHOCProps<D>) => void;
}
type FilterPopoversItems<D extends { id: string }> = FilterPopoverHOCProps<D> & {
    key: string;
};

type FilterPopoversAPI<D extends { id: string }> = {
    openFilterPopover: (props: FilterPopoverHOCProps<D>) => void;
};

const ForwardedFilterPopovers = <D extends { id: string }>(props: FilterPopoversProps, ref: ForwardedRef<FilterPopoversRef<D>>) => {
    const [items, setItems] = useState<FilterPopoversItems<D>[]>([]);

    const onClose = (key: string) => {
        setItems((prev) => prev.filter((item) => item.key !== key));
    };
    useImperativeHandle(ref, () => ({
        openFilterPopover: (popoverProps: FilterPopoverHOCProps<D>) => {
            const key = uniqueId('databoard-filter-popover');
            setItems((prev) => {
                const clone = [...prev];
                clone.push({
                    key,
                    ...popoverProps,
                });
                return clone;
            });
        },
    }));
    return createPortal(
        <>
            {items.map((item) => {
                const { key, ...restProps } = item;
                return (
                    <FilterPopoverHOC
                        key={`databoard-filter-popover-${key}`}
                        {...restProps}
                        onClose={() => {
                            restProps.onClose?.();
                            onClose(key);
                        }}
                    />
                );
            })}
        </>,
        props.container || document.body,
    );
};

export const FilterPopovers = forwardRef(ForwardedFilterPopovers);

export const useFilterPopover = <D extends { id: string }>(props?: FilterPopoversProps) => {
    const filterPopoversRef = useRef<FilterPopoversRef<D>>(null);

    const contextHolder = useMemo(() => <FilterPopovers<D> ref={filterPopoversRef} {...props} />, [props]);

    const api = useMemo<FilterPopoversAPI<D>>(
        () => ({
            openFilterPopover: (filterPopoverProps: FilterPopoverHOCProps<D>) => {
                filterPopoversRef.current?.openFilterPopover(filterPopoverProps);
            },
        }),
        [],
    );

    return [api, contextHolder] satisfies [FilterPopoversAPI<D>, ReactElement];
};
