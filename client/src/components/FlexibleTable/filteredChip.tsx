import type { Option } from '@imbrace/ui';
import { EllipsisText, Icon } from '@imbrace/ui';
import { Chip } from '@mui/material';
import { getCountry } from 'countries-and-timezones';
import { forwardRef, type MouseEvent as ReactMouseEvent, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { attachmentSupportedFileTypes } from '@/pages/Databoards/utils';
import { eventType } from '@/pages/Events/utils';

import styles from './index.module.scss';
import type { ColumnType, ColumnValue } from './types';
import { formatDate } from './utils';

interface FilteredChipProps {
    header: string;
    value?: ColumnValue;
    onClick: (event: ReactMouseEvent<HTMLDivElement, MouseEvent>) => void;
    onDelete?: () => void;
    operator?: API.Operator;
    fieldType?: ColumnType['type'];
    remoteEnum?: () => Promise<Option[]>;
    disabled?: boolean;
}

const FilteredChip = forwardRef<HTMLDivElement, FilteredChipProps>(
    ({ header, value, operator, onClick, onDelete, fieldType, remoteEnum, disabled }, ref) => {
        const { t } = useTranslation();
        const [labelValue, setLabelValue] = useState(value);

        useEffect(() => {
            if (remoteEnum && value) {
                const request = async () => {
                    const options = await remoteEnum();
                    if (Array.isArray(value)) {
                        const targetOption = options
                            .filter((option) => (value as (string | number)[]).indexOf(option.value) !== -1)
                            .map((option) => option.text);
                        if (targetOption) {
                            setLabelValue(`${targetOption}`);
                        }
                    } else {
                        const targetOption = options.find((option) => option.value === value);
                        if (targetOption) {
                            setLabelValue(`${targetOption.text}`);
                        }
                    }
                };
                request();
            } else {
                setLabelValue(value);
            }
        }, [remoteEnum, value]);

        const renderDateLabel = () => {
            if (operator === 'is_between' && Array.isArray(labelValue) && labelValue.length !== 0) {
                let displayValue = '';
                if (
                    (typeof labelValue[0] !== 'object' || labelValue[0] instanceof Date) &&
                    (typeof labelValue[1] !== 'object' || labelValue[1] instanceof Date)
                ) {
                    displayValue = `${formatDate({ columnValue: labelValue[0], dateFormat: 'MM/dd/yyyy' })} - ${formatDate({
                        columnValue: labelValue[1],
                        dateFormat: 'MM/dd/yyyy',
                    })}`;
                }
                return <EllipsisText text={`${header}: ${t(`${operator}_display`, { value: displayValue })}`} />;
            }

            if (Array.isArray(labelValue) && labelValue[0] === 'empty') {
                switch (operator) {
                    case 'is':
                        return <EllipsisText text={`${header}: ${t('is_empty')}`} />;
                    case 'is_not':
                        return <EllipsisText text={`${header}: ${t('is_not_empty')}`} />;
                    default:
                        return null;
                }
            }
            if (Array.isArray(labelValue) && labelValue[0] === 'exactly') {
                let date = '';
                if (typeof labelValue[1] !== 'object' || labelValue[1] instanceof Date) {
                    date = formatDate({ columnValue: labelValue[1], dateFormat: 'MM/dd/yyyy' });
                }
                switch (operator) {
                    case 'is':
                        return <EllipsisText text={`${header}: ${date ?? ''}`} />;
                    case 'is_after':
                    case 'is_after_and_on':
                    case 'is_before':
                    case 'is_before_and_on':
                    case 'is_not':
                        return <EllipsisText text={`${header}: ${t(`${operator}_display`, { value: date })}`} />;
                    default:
                        return null;
                }
            }

            if (Array.isArray(labelValue) && (labelValue[0] === 'next' || labelValue[0] === 'last')) {
                const relative = labelValue[0];
                const displayValue = labelValue[1] ?? '';
                const unit = labelValue[2] as string;
                switch (operator) {
                    case 'is':
                        return (
                            <EllipsisText
                                text={
                                    <>
                                        <span>{`${header}: `}</span>
                                        <span style={{ textTransform: 'capitalize' }}>{t(relative)}</span>
                                        <span className={styles.filterChip}>{` ${displayValue} ${t(unit, {
                                            count: +displayValue || 0,
                                        })}`}</span>
                                    </>
                                }
                            />
                        );
                    case 'is_after':
                    case 'is_after_and_on':
                    case 'is_before':
                    case 'is_before_and_on':
                    case 'is_not':
                        return (
                            <EllipsisText
                                text={
                                    <>
                                        <span>{`${header}: `}</span>
                                        <span>{t(operator)}</span>
                                        <span className={styles.filterChip}>{` ${t(relative)} ${displayValue} ${t(unit, {
                                            count: +displayValue || 0,
                                        })}`}</span>
                                    </>
                                }
                            />
                        );
                    default:
                        return null;
                }
            }
            return null;
        };

        const renderDateTimeLabel = () => {
            if (operator === 'is_between' && Array.isArray(labelValue) && labelValue.length !== 0) {
                let displayValue = '';
                if (
                    (typeof labelValue[0] !== 'object' || labelValue[0] instanceof Date) &&
                    (typeof labelValue[1] !== 'object' || labelValue[1] instanceof Date)
                ) {
                    displayValue = `${formatDate({ columnValue: labelValue[0], dateFormat: 'MM/dd/yyyy HH:mm' })} - ${formatDate({
                        columnValue: labelValue[1],
                        dateFormat: 'MM/dd/yyyy HH:mm',
                    })}`;
                }
                return <EllipsisText text={`${header}: ${t(`${operator}_display`, { value: displayValue })}`} />;
            }
            const displayValue = `${formatDate({ columnValue: labelValue, dateFormat: 'MM/dd/yyyy HH:mm' })}`;
            switch (operator) {
                case 'is':
                    return <EllipsisText text={`${header}: ${displayValue ?? ''}`} />;
                case 'is_after':
                case 'is_after_and_on':
                case 'is_before':
                case 'is_before_and_on':
                case 'is_not':
                    return <EllipsisText text={`${header}: ${t(`${operator}_display`, { value: displayValue })}`} />;
                default:
                    return null;
            }
        };

        const renderTimeLabel = () => {
            if (operator === 'is_between' && Array.isArray(labelValue) && labelValue.length !== 0) {
                let displayValue = '';
                if (
                    (typeof labelValue[0] !== 'object' || labelValue[0] instanceof Date) &&
                    (typeof labelValue[1] !== 'object' || labelValue[1] instanceof Date)
                ) {
                    displayValue = `${formatDate({ columnValue: labelValue[0], dateFormat: 'HH:mm' })} - ${formatDate({
                        columnValue: labelValue[1],
                        dateFormat: 'HH:mm',
                    })}`;
                }
                return <EllipsisText text={`${header}: ${t(`${operator}_display`, { value: displayValue })}`} />;
            }

            const displayValue = `${formatDate({ columnValue: labelValue, dateFormat: 'HH:mm' })}`;
            switch (operator) {
                case 'is':
                    return <EllipsisText text={`${header}: ${displayValue ?? ''}`} />;
                case 'is_after':
                case 'is_after_and_on':
                case 'is_before':
                case 'is_before_and_on':
                case 'is_not':
                    return <EllipsisText text={`${header}: ${t(`${operator}_display`, { value: displayValue })}`} />;
                default:
                    return null;
            }
        };

        const renderOriginLabel = () => {
            const origins = (labelValue as API.OriginValue[]) || [];
            if (operator === 'contains') {
                return <EllipsisText text={`${header}: ${origins.map((origin) => origin.data.name).join(', ')}`} />;
            }
            return (
                <EllipsisText
                    text={`${header}: ${t(`${operator}_display`, { value: origins.map((origin) => origin.data.name).join(', ') })}`}
                />
            );
        };

        const renderAttachmentLabel = () => {
            const fileTypes = ((labelValue as string[]) || [])
                ?.filter((type) => attachmentSupportedFileTypes[type])
                ?.map((type) => {
                    return attachmentSupportedFileTypes[type];
                });

            return <EllipsisText text={`${header}: ${fileTypes.join(', ')}`} />;
        };

        const renderLabel = () => {
            if (operator === 'is_empty' || operator === 'is_not_empty') {
                return <EllipsisText text={`${header}: ${t(`${operator}`)}`} />;
            }
            if (fieldType === 'Date') {
                return renderDateLabel();
            }
            if (fieldType === 'Datetime') {
                return renderDateTimeLabel();
            }
            if (fieldType === 'Time') {
                return renderTimeLabel();
            }
            if (fieldType === 'Origin') {
                return renderOriginLabel();
            }
            if (fieldType === 'Attachment') {
                return renderAttachmentLabel();
            }
            if (header === 'Event Type' && fieldType === 'SingleSelection') {
                const displayValue = (labelValue as string[])?.map((key) => eventType[key as keyof typeof eventType]).join(', ');
                if (operator === 'contains') {
                    return <EllipsisText text={`${header}: ${displayValue ?? ''}`} />;
                }
                // rest operator
                return <EllipsisText text={`${header}: ${t(`${operator}`, { value: displayValue })}`} />;
            }

            if (operator === 'is_between' && Array.isArray(labelValue) && labelValue.length !== 0) {
                const displayValue = `${labelValue[0] ?? ''} - ${labelValue[1] ?? ''}`;
                return <EllipsisText text={`${header}: ${t(`${operator}_display`, { value: displayValue })}`} />;
            }
            if (operator === 'is_after' || operator === 'is_after_and_on' || operator === 'is_before' || operator === 'is_before_and_on') {
                const date = labelValue;
                return <EllipsisText text={`${header}: ${t(`${operator}_display`, { value: date })}`} />;
            }

            if (operator === 'is_not' || operator === 'not_contains') {
                if (fieldType === 'Country' && typeof labelValue === 'string') {
                    const displayValue = getCountry(labelValue)?.name || '';
                    return <EllipsisText text={`${header}: ${t(`${operator}_display`, { value: displayValue })}`} />;
                }
                const displayValue =
                    fieldType === 'Phone' && labelValue && typeof labelValue === 'object' && 'calling_code_with_number' in labelValue
                        ? labelValue.calling_code_with_number
                        : labelValue;
                return <EllipsisText text={`${header}: ${t(`${operator}_display`, { value: displayValue })}`} />;
            }

            if (fieldType === 'Phone' && labelValue && typeof labelValue === 'object' && 'calling_code_with_number' in labelValue) {
                const displayValue = labelValue.calling_code_with_number;
                return <EllipsisText text={`${header}: ${displayValue ?? ''}`} />;
            }

            if (Array.isArray(labelValue)) {
                const displayValue = labelValue.join(', ');
                return <EllipsisText text={`${header}: ${displayValue ?? ''}`} />;
            }

            if (fieldType === 'Country' && typeof labelValue === 'string') {
                const displayValue = getCountry(labelValue)?.name || '';
                return <EllipsisText text={`${header}: ${displayValue ?? ''}`} />;
            }

            const displayValue = labelValue;
            return <EllipsisText text={`${header}: ${displayValue ?? ''}`} />;
        };

        return (
            <Chip
                ref={ref}
                label={renderLabel()}
                sx={{
                    maxWidth: '280px',
                    background: 'var(--color-primary-3)',
                    padding: '8px 12px 8px 12px',
                    borderRadius: '4px',
                    height: '40px',
                    gap: '4px',
                    cursor: 'pointer',
                    '&:hover': {
                        background: 'var(--color-primary-5)',
                    },
                    '&:active': {
                        boxShadow: 'none',
                    },
                    '& .MuiChip-deleteIcon': {
                        margin: 0,
                        display: 'flex',
                    },
                    '& .MuiChip-label': {
                        fontSize: 14,
                        lineHeight: '16px',
                        padding: 0,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        WebkitLineClamp: 2,
                        display: '-webkit-box',
                        WebkitBoxOrient: 'vertical',
                    },
                    '&.Mui-disabled': {
                        opacity: 1,
                        background: 'var(--color-primary-8)',
                        pointerEvents: 'initial',
                    },
                }}
                onClick={onClick}
                {...(onDelete && {
                    deleteIcon: (
                        <div>
                            <Icon
                                name="close"
                                style={{
                                    fontSize: 16,
                                    color: 'var(--color-primary-1)',
                                }}
                            />
                        </div>
                    ),
                    onDelete: (e: ReactMouseEvent<HTMLButtonElement, MouseEvent>) => {
                        e.stopPropagation();
                        onDelete();
                    },
                })}
                disabled={disabled}
            />
        );
    },
);

export default FilteredChip;
