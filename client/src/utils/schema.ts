import type { TFunction } from 'i18next';
import { z } from 'zod';

import { urlRegex } from '.';

export const FileStatusSchema = z.enum([
    'ok',
    'pending',
    'uploading',
    'deleted',
    'deleting',
    'validationError',
    'uploadError',
    'missingFile',
]);

export const AttachmentSchema = z
    .object({
        file: z.instanceof(File).optional(),
        id: z.string(),
        fileId: z.string().optional(),
        url: z.string().optional(),
        status: FileStatusSchema.optional(),
        isValid: z.boolean().optional(),
        error: z.string().optional(),
        name: z.string().optional(),
        size: z.number().optional(),
    })
    .array();

export const RequiredStringSchema = (t: TFunction<'translation', undefined>) =>
    z.string({ required_error: t('validation_field_required') }).superRefine((val, ctx) => {
        if (!val || val.length < 1 || val.trim().length <= 0) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                message: t('validation_field_required'),
                fatal: true,
            });

            return z.NEVER;
        }
    });

export const RequiredAndMaxLengthStringSchema = (t: TFunction<'translation', undefined>, maxLength: number) =>
    z
        .string({ required_error: t('validation_field_required') })
        .max(maxLength, { message: t('error_field_maxlength', { length: maxLength }) })
        .superRefine((val, ctx) => {
            if (!val || val.length < 1 || val.trim().length <= 0) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: t('validation_field_required'),
                    fatal: true,
                });

                return z.NEVER;
            }
        });

export const MaxLengthStringSchema = (t: TFunction<'translation', undefined>, maxLength: number) =>
    z
        .string()
        .max(maxLength, { message: t('error_field_maxlength', { length: maxLength }) })
        .optional()
        .superRefine((val, ctx) => {
            if (val && val.trim().length <= 0) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: t('validation_field_required'),
                    fatal: true,
                });

                return z.NEVER;
            }
        });
export const SpaceCheckStringSchema = (t: TFunction<'translation', undefined>) =>
    z
        .string()
        .optional()
        .superRefine((val, ctx) => {
            if (val && val.trim().length <= 0) {
                ctx.addIssue({
                    code: z.ZodIssueCode.custom,
                    message: t('validation_field_required'),
                    fatal: true,
                });

                return z.NEVER;
            }
        });
export const URLStringSchema = (t: TFunction<'translation', undefined>) =>
    z
        .string({ required_error: t('validation_field_required') })
        .refine((val) => !val || val.trim().length > 0, {
            message: t('validation_field_required'),
        })
        .refine((val) => !val || urlRegex.test(val), {
            message: t('validation_url_pattern'),
        });
