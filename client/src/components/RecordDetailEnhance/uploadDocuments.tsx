import { urlRegex } from '@/utils';
import { AttachmentSchema, URLStringSchema } from '@/utils/schema';
import { FieldText, FieldUpload, Space } from '@imbrace/ui';
import { ListUploadProps, UploadBaseProps } from '@imbrace/ui/dist/components/Upload/types';
import { Divider, Typography } from '@mui/material';
import type { TFunction } from 'i18next';
import type { ReactNode } from 'react';
import { Controller, type UseFormReturn, useWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import SimpleBar from 'simplebar-react';
import { z } from 'zod';

export const UploadFormSchema = (t: TFunction<'translation', undefined>) =>
    z.object({
        files: AttachmentSchema.optional().superRefine((val, ctx) => {
            if (val?.some((attachment) => attachment.error)) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: val.filter((attachment) => attachment.error)[0].error,
                    fatal: true,
                });
                return z.NEVER;
            }
        }),
        url: URLStringSchema(t).optional(),
    });

export type UploadFormType = z.infer<ReturnType<typeof UploadFormSchema>>;

const UploadForm = ({
    max,
    leftAmounts,
    uploadProps,
    methods,
    hint,
}: {
    max?: number;
    leftAmounts?: number;
    uploadProps: Omit<UploadBaseProps & ListUploadProps, 'value' | 'onChange'>;
    methods: UseFormReturn<UploadFormType>;
    hint?: string | ReactNode;
}) => {
    const {
        control,
        trigger,
        formState: { errors },
    } = methods;
    const { t } = useTranslation();
    const files = useWatch({
        control,
        name: 'files',
    });
    const url = useWatch({
        control,
        name: 'url',
    });
    return (
        <SimpleBar style={{ width: 'calc(100% + 64px)', margin: '0 -32px', padding: '0 32px', maxHeight: 500, overflow: 'auto' }} autoHide>
            <Space size={16} align="start" direction="vertical" style={{ width: '100%' }}>
                <Space size={8} align="start" direction="vertical" style={{ width: '100%' }}>
                    {hint && <Typography variant="body2" style={{ color: 'var(--color-light-5)' }}>{hint}</Typography>}
                    <Controller
                        control={control}
                        name="files"
                        rules={{
                            required: {
                                value: !url,
                                message: t('validation_field_required'),
                            },
                            pattern: {
                                value: urlRegex,
                                message: t('validation_url_pattern'),
                            },
                            validate: {
                                maxLength: (val) => {
                                    if (typeof leftAmounts === 'number') {
                                        if (val && val.length > leftAmounts - 1 && url) {
                                            return t('error_max_attach_files', {
                                                max,
                                            });
                                        }
                                        if (val && val.length > leftAmounts && !url) {
                                            return t('error_max_attach_files', {
                                                max,
                                            });
                                        }
                                    }
                                    return true;
                                },
                                fileError: (val) => {
                                    if (val?.some((attachment) => attachment.error)) {
                                        return val.filter((attachment) => attachment.error)[0].error;
                                    }
                                    return true;
                                },
                            },
                        }}
                        render={({ field, fieldState: { error } }) => (
                            <FieldUpload
                                direction={'vertical-reverse'}
                                fullWidth
                                {...uploadProps}
                                {...field}
                                onChange={(eFiles) => {
                                    if (eFiles && typeof leftAmounts === 'number' && eFiles.length > leftAmounts) {
                                        let filesList = eFiles;
                                        filesList = filesList.slice(0, leftAmounts);
                                        field.onChange(filesList);
                                    } else {
                                        field.onChange(eFiles);
                                    }
                                    if (errors.url) {
                                        setTimeout(() => {
                                            trigger('url');
                                        }, 10);
                                    }
                                }}
                                error={!!error}
                                helperText={error?.message}
                            />
                        )}
                    />
                </Space>
                <Divider flexItem>
                    <Typography variant="body2" style={{ color: 'var(--color-light-5)', textTransform: 'lowercase' }}>{t('or')}</Typography>
                </Divider>
                <Controller
                    control={control}
                    name="url"
                    rules={{
                        pattern: {
                            value: urlRegex,
                            message: t('validation_url_pattern'),
                        },
                        validate: {
                            maxLength: (val) => {
                                if (typeof leftAmounts === 'number') {
                                    if (files && files.length > leftAmounts - 1 && val) {
                                        return t('error_max_attach_files', {
                                            max,
                                        });
                                    }
                                    if (files && files.length > leftAmounts && !val) {
                                        return t('error_max_attach_files', {
                                            max,
                                        });
                                    }
                                }
                                return true;
                            },
                        },
                    }}
                    render={({ field, fieldState: { error } }) => (
                        <FieldText
                            label={t('upload_attach_files_modal_url_label')}
                            placeholder="http://"
                            fullWidth
                            {...field}
                            onChange={(e) => {
                                field.onChange(e.target.value);
                                if (errors.files) {
                                    setTimeout(() => {
                                        trigger('files');
                                    }, 10);
                                }
                            }}
                            error={!!error}
                            helperText={error?.message}
                        />
                    )}
                />
            </Space>
        </SimpleBar>
    );
};

export default UploadForm;
