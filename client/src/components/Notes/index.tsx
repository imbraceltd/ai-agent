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
import styles from './index.module.scss';

export interface NotesProps extends Omit<FieldTextProps, 'onChange'> {
    notes: API.NotesValue[];
    type?: 'latestNote' | 'list';
    style?: CSSProperties;
    bordered?: boolean;
    onChange?: (notes: API.NotesValue[]) => void;
    editing?: boolean;
    onExpand?: (e: ReactMouseEvent<HTMLButtonElement, MouseEvent>) => void;
    containerStyle?: CSSProperties;
    innerStyle?: CSSProperties;
    hideButton?: boolean;
    buttonDisplayType?: 'always' | 'hover';
    onAdd?: () => void;
    inModal?: boolean;
}

const Notes = forwardRef<HTMLDivElement, NotesProps>((props, ref) => {
    const {
        notes,
        type = 'latestNote',
        style,
        bordered = false,
        onChange,
        editing,
        onExpand,
        containerStyle,
        innerStyle,
        hideButton = false,
        buttonDisplayType = 'always',
        onAdd,
        inModal = true,
        ...restProps
    } = props;
    const { t } = useTranslation();
    const [controlledEditing, setControlledEditing] = useState(editing);
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

    if (type === 'latestNote') {
        return (
            <Space size={8} className={clsx(styles.latestNote, bordered && styles.boarder)} style={style}>
                {editing && !notes?.[notes.length - 1]?.message ? (
                    <div ref={ref} style={{ flex: 1, overflow: 'hidden' }} />
                ) : (
                    <>
                        <Tooltip
                            title={
                                <Space
                                    className={clsx(styles.note, bordered && styles.boarder, styles.noBackground)}
                                    size={12}
                                    direction="vertical"
                                    align="start"
                                >
                                    <SimpleBar style={{ maxHeight: '368px', width: '100%' }}>
                                        <Typography style={{ whiteSpace: 'pre-wrap' }}>{notes[notes.length - 1]?.message}</Typography>
                                    </SimpleBar>
                                    <Space size={12}>
                                        <Typography variant="BodyBold" style={{ color: 'var(--color-light-5)' }}>
                                            {`#${notes.length}`}
                                        </Typography>
                                        <Space size={8}>
                                            <div>
                                                <Avatar
                                                    src={notes[notes.length - 1]?.author_avatar}
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
                                                {notes[notes.length - 1]?.author_name}
                                            </Typography>
                                        </Space>
                                        <Typography style={{ color: 'var(--color-light-5)' }}>
                                            {dayjs(notes[notes.length - 1]?.updated_at).format('MM/DD/YYYY HH:mm')}
                                        </Typography>
                                    </Space>
                                </Space>
                            }
                            slotProps={{
                                popper: {
                                    sx: {
                                        padding: '0px',
                                        margin: '0px',
                                        width: '436px',
                                    },
                                },
                                tooltip: {
                                    sx: {
                                        padding: '0px',
                                        margin: '0px',
                                        marginLeft: '-12px !important',
                                        marginTop: '6px !important',
                                        overflow: 'hidden',
                                        background: 'white',
                                        borderRadius: '4px',
                                        width: '100%',
                                        color: 'var(--color-light-7)',
                                        boxShadow: '0px 2px 24px 0px #E0E0E033, 0px 4px 8px 0px #BDBDBD14',
                                        maxWidth: '100%',
                                    },
                                },
                            }}
                            placement="bottom-start"
                        >
                            <Space
                                size={0}
                                align="start"
                                justify="center"
                                direction="vertical"
                                ref={ref}
                                style={{ flex: 1, overflow: 'hidden' }}
                            >
                                <div style={{ width: '100%' }}>
                                    <Typography
                                        style={{
                                            textOverflow: 'ellipsis',
                                            whiteSpace: 'nowrap',
                                            overflow: 'hidden',
                                            color: notes[notes.length - 1]?.message ? 'var(--color-light-7)' : 'var(--color-light-4)',
                                        }}
                                    >
                                        {notes[notes.length - 1]?.message || '—'}
                                    </Typography>
                                </div>

                                <Typography variant="Caption" style={{ color: 'var(--color-light-5)' }}>
                                    {notes[notes.length - 1]?.updated_at
                                        ? dayjs(notes[notes.length - 1]?.updated_at).format('MM/DD/YYYY HH:mm')
                                        : ''}
                                </Typography>
                            </Space>
                        </Tooltip>
                    </>
                )}
                {editing && (
                    <IconButton
                        variant="text"
                        type="secondary"
                        size="s"
                        fontSize={20}
                        onClick={(e) => {
                            e.stopPropagation();
                            onExpand?.(e);
                        }}
                    >
                        <Icon name="more" />
                    </IconButton>
                )}
            </Space>
        );
    }

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
            <SimpleBar style={{ maxHeight: '368px', minHeight: '156px', ...innerStyle }}>
                <Space size={8} align="stretch" justify="start" direction="vertical" style={{ position: 'relative' }}>
                    {notes.map((note, index) => {
                        return (
                            <Space
                                className={clsx(styles.note, bordered && styles.boarder)}
                                size={12}
                                direction="vertical"
                                align="start"
                                key={note._id}
                            >
                                <Typography style={{ whiteSpace: 'pre-wrap' }}>{note.message}</Typography>
                                <Space size={12}>
                                    <Typography variant="BodyBold" style={{ color: 'var(--color-light-5)' }}>
                                        {`#${index + 1}`}
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
                                    <Typography style={{ color: 'var(--color-light-5)' }}>
                                        {dayjs(note.updated_at).format('MM/DD/YYYY HH:mm')}
                                    </Typography>
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
                                            onClick={handleSubmit(onSubmit)}
                                        />
                                    </Space>
                                }
                            />
                        )}
                    />
                </div>
            )}
            {!controlledEditing && !hideButton && (
                <div className={clsx(styles.addButton, buttonDisplayType === 'hover' && styles.hover, inModal && styles.inModal)}>
                    <IconButton
                        onClick={() => {
                            setControlledEditing(true);
                            onAdd?.();
                        }}
                        sx={{ borderRadius: '4px' }}
                    >
                        <Icon name="add" />
                    </IconButton>
                </div>
            )}
        </Space>
    );
});

export default Notes;
