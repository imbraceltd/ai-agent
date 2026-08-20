import type { Attachment as AttachmentType } from '@imbrace/ui';
import { Typography, Upload } from '@imbrace/ui';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';

import type { AttachmentValue } from './types';
import { supportedFileExtensions, supportedFileMIME } from './utils';

const Attachment = ({
    value,
    fieldId,
    onUpdate,
}: {
    value?: AttachmentValue[];
    fieldId: string;
    onUpdate: (value?: AttachmentValue[]) => void;
}) => {
    const [attachments, setAttachments] = useState<AttachmentType[]>(
        Array.isArray(value)
            ? (value as AttachmentValue[])?.map((attachment, index) => ({
                  id: attachment?.data.key || `${fieldId}-attachment-${index}`,
                  status: 'ok',
                  url: attachment?.data?.url,
                  name: attachment?.data?.name,
                  fileId: attachment?.data.key,
                  type: attachment?.data.extension,
                  ...attachment.extra,
              }))
            : [],
    );
    const { t } = useTranslation();

    useEffect(() => {
        setAttachments(
            Array.isArray(value)
                ? (value as AttachmentValue[])?.map((attachment, index) => ({
                      id: attachment?.data.key || `${fieldId}-attachment-${index}`,
                      status: 'ok',
                      url: attachment?.data?.url,
                      name: `${attachment?.data?.name}`,
                      fileId: attachment?.data.key,
                      type: attachment?.data.extension,
                      ...attachment.extra,
                  }))
                : [],
        );
    }, [value, fieldId]);

    if (attachments.length === 0) {
        return (
            <Typography
                style={{
                    color: 'var(--color-light-4)',
                }}
            >
                —
            </Typography>
        );
    }

    return (
        <Upload
            type="input"
            value={attachments}
            hideAddButton
            containerStyle={{ padding: 0, height: 'auto', border: 'none' }}
            accept=".csv, .pdf , .jpeg, .jpg, .gif, .tiff, .tif .svg, .png, .mp4, image/svg+xml, image/png, image/jpeg"
            fileValidation={async (file: File) => {
                const { size, name, type: fileType } = file;
                const extension = name.split('.')[1];
                if ((!extension || supportedFileExtensions.indexOf(extension) === -1) && supportedFileMIME.indexOf(fileType) === -1) {
                    return t('error_only_accept_file', { file: 'JPG, PNG, SVG, GIF, TIFF, TIF, PDF, CSV, MP4' });
                }
                if (size > 5 * 1000 * 1000) {
                    return t('error_file_size', { size: '5 MB' });
                }
                return true;
            }}
            onChange={(files) => {
                onUpdate?.(
                    files?.map(
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
};

export default Attachment;
