import { format } from 'date-fns';
import dayjs from 'dayjs';
import equal from 'fast-deep-equal/es6';
import { useEffect, useMemo, useRef } from 'react';

import type { ColumnType, ColumnValue } from './types';
/**
 * for Attachment field
 */
export const supportedFileExtensions = ['jpg', 'png', 'svg', 'jpeg', 'gif', 'tiff', 'tif', 'pdf', 'csv', 'mp4', 'xlsx', 'xls'];
export const supportedFileMIME = [
    'image/png',
    'image/jpeg',
    'image/svg+xml',
    'image/gif',
    'image/tiff',
    'application/pdf',
    'text/csv',
    'video/mp4',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-excel',
];

export const getFilteredFileExtensions = (boardType?: API.BoardType) => {
    if (boardType === 'KnowledgeHub') {
        return supportedFileExtensions.filter(ext => ext !== 'xlsx' && ext !== 'xls');
    }
    return supportedFileExtensions;
};

export const getFilteredFileMIME = (boardType?: API.BoardType) => {
    if (boardType === 'KnowledgeHub') {
        return supportedFileMIME.filter(mime => 
            mime !== 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' && 
            mime !== 'application/vnd.ms-excel'
        );
    }
    return supportedFileMIME;
};

export const getAcceptAttribute = (boardType?: API.BoardType) => {
    const extensions = getFilteredFileExtensions(boardType);
    const mimeTypes = getFilteredFileMIME(boardType);
    
    const extensionString = extensions.map(ext => `.${ext}`).join(', ');
    const mimeString = mimeTypes.join(', ');
    
    return `${extensionString}, ${mimeString}`;
};

export const getFileTypeErrorMessage = (boardType?: API.BoardType) => {
    const extensions = getFilteredFileExtensions(boardType);
    return extensions.map(ext => ext.toUpperCase()).join(', ');
};

export const filterFnMap = (type?: ColumnType['type']) => {
    switch (type) {
        case 'Number':
            return 'equals';
        default:
            return 'auto';
    }
};

export const getDefaultSize = (type?: ColumnType['type']) => {
    switch (type) {
        case 'LongText':
        case 'MultipleSelection':
            return 256;
        case 'SingleSelection':
        case 'Priority':
        case 'Link':
        case 'ShortText':
        case 'Date':
        case 'Number':
        case 'Phone':
        case 'Email':
        case 'Assignee':
        case 'Time':
        default:
            return 200;
    }
};

export const getCorrectSize = ({
    currentSize,
    minSize,
    maxSize,
    fullWidth,
}: {
    currentSize: number;
    size?: number;
    minSize?: number;
    maxSize?: number;
    fullWidth?: boolean;
}) => {
    let correctSize = currentSize;
    if (fullWidth) {
        if (typeof minSize === 'number' && typeof maxSize === 'number' && maxSize !== Number.MAX_SAFE_INTEGER) {
            if (minSize > maxSize) {
                return `${maxSize}px`;
            }
            return `minmax(${minSize}px, ${maxSize}px)`;
        } else if (typeof minSize === 'number') {
            return `minmax(${minSize}px, 1fr)`;
        } else if (typeof maxSize === 'number' && maxSize !== Number.MAX_SAFE_INTEGER) {
            return `minmax(${maxSize}px, 1fr)`;
        }
        return '1fr';
    }
    if (typeof minSize === 'number') {
        correctSize = Math.max(minSize, currentSize);
    }
    if (typeof maxSize === 'number') {
        correctSize = Math.min(maxSize, correctSize);
    }

    return `${correctSize}px`;
};

function useDeepCompareMemoize<T>(value: T) {
    const ref = useRef<T>(value);
    const signalRef = useRef<number>(0);

    if (!equal(value, ref.current)) {
        ref.current = value;
        signalRef.current += 1;
    }

    // eslint-disable-next-line react-hooks/exhaustive-deps
    return useMemo(() => ref.current, [signalRef.current]);
}
type UseEffectParams = Parameters<typeof useEffect>;
type EffectCallback = UseEffectParams[0];
type DependencyList = UseEffectParams[1];

type UseEffectReturn = ReturnType<typeof useEffect>;

export function useDeepCompareEffect(callback: EffectCallback, dependencies: DependencyList): UseEffectReturn {
    // eslint-disable-next-line react-hooks/exhaustive-deps
    return useEffect(callback, useDeepCompareMemoize(dependencies));
}

export const formatDate = ({ columnValue, dateFormat }: { columnValue?: ColumnValue; dateFormat: string }) => {
    return columnValue instanceof Date || dayjs(columnValue as unknown as Date).isValid()
        ? format(new Date(columnValue as Date), dateFormat)
        : '';
};
