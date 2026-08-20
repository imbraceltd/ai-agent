import type { FieldTextProps } from '@imbrace/ui';
import { Button, FieldText, Icon, IconButton, Space, Typography } from '@imbrace/ui';
import { Avatar, Tooltip } from '@mui/material';
import clsx from 'clsx';
import dayjs from 'dayjs';
import type { CSSProperties, MouseEvent as ReactMouseEvent } from 'react';
import { forwardRef, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import SimpleBar from 'simplebar-react';
import styles from './note.module.scss';

export interface NotesProps extends Omit<FieldTextProps, 'onChange'> {
    fieldName: string;
    notes?: API.NotesValue[];
    style?: CSSProperties;
    bordered?: boolean;
    onChange?: (notes: API.NotesValue[]) => void;
    containerStyle?: CSSProperties;
    innerStyle?: CSSProperties;
    hideButton?: boolean;
    buttonDisplayType?: 'always' | 'hover';
    readOnly?: boolean;
}

const Notes = forwardRef<HTMLDivElement, NotesProps>((props, ref) => {
    const {
        fieldName,
        notes = [],
        style,
        bordered = false,
        onChange,
        containerStyle,
        innerStyle,
        hideButton = false,
        buttonDisplayType = 'always',
        readOnly = false,
        ...restProps
    } = props;
    const { t } = useTranslation();
    const [controlledEditing, setControlledEditing] = useState(false);
    const lastElement = useRef<HTMLDivElement>(null);

    const {
        control,
        handleSubmit,
        formState: { isDirty, isValid },
        reset,
    } = useForm<{ message: string }>({
        defaultValues: {
            message: '',
        },
        mode: 'all',
    });

    const handleDelete = (index: number) => {
        const newNotes = [...(notes || [])];
        newNotes.splice(index, 1);
        onChange?.(newNotes);
    };

    return (
        <Space
            ref={ref}
            className={clsx(styles.container, buttonDisplayType === 'hover' && styles.hover)}
            size={16}
            align="stretch"
            justify="start"
            direction="vertical"
            style={containerStyle}
        >
            <Space style={{ width: '100%', marginTop: '20px' }} align="center" justify="between">
                <Space size={8} style={{ color: 'var(--color-light-5)', fontSize: 20 }}>
                    <Icon name="notes" />
                    <Typography variant="BodyTight" style={{ color: 'var(--color-light-5)' }}>
                        {fieldName}
                    </Typography>
                </Space>
                <Button
                    onClick={() => {
                        setControlledEditing(true);
                    }}
                    disabled={readOnly}
                    variant="link"
                    size="xs"
                    sx={{ fontWeight: '400' }}
                    startIcon={<Icon name="add" />}
                    text="Add Notes"
                />
            </Space>
            <SimpleBar style={{ maxHeight: '368px', minHeight: '30px', ...innerStyle }}>
                <Space size={8} align="stretch" justify="start" direction="vertical" style={{ position: 'relative' }}>
                    {(notes || []).map((note, index) => {
                        return (
                            <Space
                                className={clsx(styles.note, bordered && styles.boarder)}
                                size={12}
                                direction="vertical"
                                align="start"
                                key={notes.length - index - 1}
                            >
                                <Typography style={{ whiteSpace: 'pre-wrap' }}>{note.message}</Typography>
                                <Space size={12} style={{ width: '100%' }}>
                                    <Typography variant="BodyBold" style={{ color: 'var(--color-light-5)' }}>
                                        {`#${notes.length - index}`}
                                    </Typography>
                                    <Space size={8}>
                                        <div>
                                            <Avatar
                                                src={note.author_avatar}
                                                sx={{
                                                    width: 24,
                                                    height: 24,
                                                    border: '1px solid #3333331A',
                                                    background: 'var(--color-light-3)',
                                                }}
                                            >
                                                <Icon name="person" fontSize={16} />
                                            </Avatar>
                                        </div>
                                        <Typography variant="BodyBold" style={{ color: 'var(--color-light-5)' }}>
                                            {note.author_name}
                                        </Typography>
                                    </Space>
                                    <Space justify="between" style={{ width: '100%' }}>
                                        <Typography style={{ color: 'var(--color-light-5)' }}>
                                            {dayjs(note.updated_at).format('MM/DD/YYYY HH:mm')}
                                        </Typography>
                                        <Icon
                                            onClick={() => handleDelete(index)}
                                            style={{ fontSize: 24, cursor: 'pointer' }}
                                            color="#EE7D7D"
                                            name="delete"
                                        />
                                    </Space>
                                </Space>
                            </Space>
                        );
                    })}
                    <div ref={lastElement} style={{ position: 'absolute', bottom: 0 }} />
                </Space>
            </SimpleBar>
            {controlledEditing && (
                <div>
                    <Controller
                        name="message"
                        control={control}
                        render={({ field }) => (
                            <FieldText
                                {...field}
                                {...restProps}
                                placeholder={t('note_placeholder')}
                                fullWidth
                                multiline
                                minRows={2}
                                maxRows={2}
                                containerSpaceProps={{
                                    direction: 'vertical',
                                }}
                                inputProps={{
                                    autoFocus: true,
                                }}
                                suffix={
                                    <Space size={8} justify="end" style={{ width: '100%', padding: '12px', paddingTop: 0 }}>
                                        <Button
                                            sx={{ borderRadius: '4px' }}
                                            variant="text"
                                            size="xs"
                                            text={t('cancel')}
                                            onClick={() => {
                                                reset();
                                                if (!hideButton) {
                                                    setControlledEditing(false);
                                                }
                                            }}
                                        />
                                        <Button
                                            sx={{ borderRadius: '4px' }}
                                            size="xs"
                                            disabled={!isValid || !isDirty}
                                            text={t('post')}
                                        />
                                    </Space>
                                }
                            />
                        )}
                    />
                </div>
            )}
        </Space>
    );
});

export default Notes;
