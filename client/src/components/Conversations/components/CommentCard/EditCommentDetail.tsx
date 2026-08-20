import 'simplebar-react/dist/simplebar.min.css';

import { Dialog, FieldText } from '@imbrace/ui';
import { CircularProgress, ClickAwayListener, Typography } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { format, isToday } from 'date-fns';
import { forwardRef, useCallback, useImperativeHandle, useRef, useState } from 'react';
import { Controller, useForm } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import Linkify from 'react-linkify';
import SimpleBar from 'simplebar-react';

import { getTeamConversationLabelById } from '@/services/api/teamConversation';
import apiFetch from '@/services/axios/handler';
import clsx from '@/utils/clsx';

import ChipsLabel from '../ChipsLabel';
import ChipsSelectLabel from '../ChipsLabel/ChipsSelectLabel';
import CommentHeader from './CommentHeader';
import styles from './index.module.scss';

export type MessageCommentsSaveType = {
    id?: string;
    content: string;
    labels: string[];
};
interface CommentEditDetailType {
    commentData?: API.ConversationMessageComments;
    handleClickSave: (formData: MessageCommentsSaveType) => Promise<void>;
    isFromConversation: boolean;
    onDeleteComment?: (id?: string) => void;
    setShownEditConversationComment?: (show: boolean) => void;
    deletingComment?: boolean;
    chatName?: string;
    channelType?: string;
    msgId?: string;
    viewModalMode?: boolean;
    teamId: string;
}
export interface CommentEditDetailSave {
    onSave: () => void;
}
const fetchTeamLabels = async ({ queryKey }: { queryKey: string[] }) => {
    try {
        if (!queryKey[0]) {
            throw new Error('team id is missing');
        }
        const limit = 50;
        const api = getTeamConversationLabelById.api(queryKey[0], limit, 0);

        const { data } = await apiFetch<API.TeamConversationLabelList>(api, getTeamConversationLabelById.method);
        return data.items;
    } catch (error) {
        console.log(error);
    }
};

const EditCommentDetail = forwardRef<CommentEditDetailSave, CommentEditDetailType>((props, ref) => {
    const {
        commentData,
        handleClickSave,
        isFromConversation,
        onDeleteComment,
        setShownEditConversationComment,
        chatName,
        channelType,
        msgId,
        viewModalMode = false,
        teamId,
    } = props;
    const { t } = useTranslation();
    const { data: teamLabels = [] } = useQuery({
        queryKey: [teamId, 'teamLabels'],
        queryFn: fetchTeamLabels,
    });

    const formRef = useRef<HTMLFormElement>(null);
    const [deleteDialog, setDeleteDialog] = useState<boolean>(false);
    const [isShownAddLabel, setIsShownAddLabel] = useState<boolean>(false);
    const [isEditing, setIsEditing] = useState(false);

    useImperativeHandle(ref, () => ({
        onSave() {
            onSave();
        },
    }));

    const {
        control,
        handleSubmit,
        watch,
        formState: { errors },
        setValue,
        getValues,
        trigger,
    } = useForm<API.ConversationMessageComments>({
        mode: 'all',
        defaultValues: {
            content: commentData?.content || '',
            labels: commentData?.labels || [],
        },
    });
    const selectedLabels = watch('labels');

    /* Submit comment data and save */
    const onSubmit = async (formData: API.ConversationMessageComments) => {
        setIsEditing(true);
        if ((formData.content && formData.content.length > 0) || (formData.labels && formData.labels.length > 0)) {
            const labelsIds = [...Array.from(new Set(formData.labels.map(({ _id }) => _id)))];
            const tempFormData = {
                id: commentData?._id,
                content: formData.content,
                labels: labelsIds,
            };
            await handleClickSave(tempFormData);
        }
        setShownEditConversationComment && setShownEditConversationComment(false);
        setIsShownAddLabel(false);
        setIsEditing(false);
    };

    const onFinishEdit = () => {
        formRef.current?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
    };

    const onSave = async () => {
        const isValidate = await trigger();
        if (isValidate) {
            formRef.current?.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
        }
    };

    /* delete, filter and add label */
    const onDeleteLabel = (key: string) => {
        const labels = getValues('labels');
        labels.splice(
            labels.findIndex((label: API.TeamConversationLabel) => label._id === key),
            1,
        );

        setValue('labels', labels);
    };

    const onAddLabel = (data: API.TeamConversationLabel) => {
        const labels = getValues('labels');
        const newlabels = [...Array.from(new Set([...labels, data]))];
        setValue('labels', newlabels);
    };

    /* delete confirm and do delete */
    const onDeleteDialogShow = () => {
        const dontAskedAgain = window.localStorage.getItem('dont_asked_delete_comment_again');
        if (dontAskedAgain !== 'true') {
            setDeleteDialog(true);
        } else {
            onDeleteDialogConfirm();
        }
    };

    const onDeleteDialogConfirm = async (dontAskedAgain?: boolean) => {
        if (dontAskedAgain) {
            window.localStorage.setItem('dont_asked_delete_comment_again', 'true');
        }
        onDeleteComment && (await onDeleteComment(commentData?._id));
        setDeleteDialog(false);
        return true;
    };

    /* comment content */
    const renderCommentContent = () => {
        const comment = (
            <Controller
                name={'content'}
                control={control}
                render={({ field }) => (
                    <FieldText
                        placeholder={t('conversation_comment_placeholder_edit')}
                        error={!!errors?.content}
                        helperText={errors?.content?.message}
                        multiline
                        fullWidth
                        rows={isFromConversation ? 4 : 10}
                        sx={{
                            fontSize: '0.875rem',
                            '& .MuiOutlinedInput-root': {
                                '& .MuiOutlinedInput-input': {
                                    padding: '0',
                                    border: 'none',
                                    fontSize: '0.875rem',
                                    overflow: isFromConversation ? 'hidden' : 'auto',
                                },
                            },
                            '& textarea ~ fieldset': {
                                border: 'none',
                            },
                            '& ::-webkit-input-placeholder': { color: 'var(--color-light-5)' },
                        }}
                        autoFocus
                        {...field}
                    />
                )}
            />
        );
        if (isFromConversation) {
            if (isEditing) {
                return comment;
            }
            if (viewModalMode) {
                return (
                    <Linkify
                        componentDecorator={(decoratedHref, decoratedText, key) => (
                            <a target="_blank" rel="noreferrer" href={decoratedHref} key={key}>
                                {decoratedText}
                            </a>
                        )}
                    >
                        <Typography className={watch('content') ? styles.commentText : styles.commentNoText}>
                            {watch('content') ? watch('content') : t('conversation_comment_placeholder')}
                        </Typography>
                    </Linkify>
                );
            }
            return (
                <Linkify
                    componentDecorator={(decoratedHref, decoratedText, key) => (
                        <a target="_blank" rel="noreferrer" href={decoratedHref} key={key}>
                            {decoratedText}
                        </a>
                    )}
                >
                    <Typography
                        onClick={() => {
                            // dispatch(editingComments({ messageId: msgId }));
                        }}
                        className={watch('content') ? styles.commentText : styles.commentNoText}
                    >
                        {watch('content') ? watch('content') : t('conversation_comment_placeholder')}
                    </Typography>
                </Linkify>
            );
        } else {
            return comment;
        }
    };

    /* Label content */
    const renderLabelContent = () => {
        return (
            <ChipsLabel
                setIsShownAddLabel={setIsShownAddLabel}
                data={watch('labels') ?? commentData?.labels}
                editCommentMode
                onSave={onSave}
                onDeleteLabel={onDeleteLabel}
                onDeleteComment={onDeleteDialogShow}
                showDeleteIcon={commentData && (commentData?.content.length > 0 || commentData?.labels.length > 0)}
                isFromConversation={isFromConversation}
                viewModalMode={viewModalMode}
                msgId={msgId}
                isShownAddLabel={isShownAddLabel}
            />
        );
    };

    const renderTimestamp = useCallback(() => {
        if (commentData?.updated_at) {
            const time = commentData.updated_at;
            if (isToday(new Date(time))) {
                return format(new Date(time), 'HH:mm');
            }

            return format(new Date(time), 'dd/MM/yyyy HH:mm');
        }
        if (commentData?.created_at) {
            const time = commentData.created_at;
            if (isToday(new Date(time))) {
                return format(new Date(time), 'HH:mm');
            }

            return format(new Date(time), 'dd/MM/yyyy HH:mm');
        }
        return '';
    }, [commentData?.created_at, commentData?.updated_at]);

    const renderEditCommentContent = () => {
        return (
            <form ref={formRef} onSubmit={handleSubmit(onSubmit)} style={{ width: '100%' }}>
                <div
                    className={clsx(
                        styles.card,
                        styles.conversationCommentsCardEdit,
                        isFromConversation ? styles.conversationCommentsCardShadow : '',
                    )}
                    style={{ border: isFromConversation ? '1px solid #e0e0e0' : '' }}
                >
                    {/* header */}
                    {!(isEditing && isFromConversation) && (
                        <CommentHeader
                            editCommentMode
                            isFromConversation={isFromConversation}
                            title={isFromConversation ? (commentData ? commentData.from.display_name : '') : channelType}
                            chatName={chatName ?? ''}
                            time={renderTimestamp()}
                        />
                    )}
                    {/* comment */}
                    <div
                        className={clsx(
                            styles.conversationCommentsComment,
                            !isFromConversation ? styles.conversationCommentsHeight : '',
                            styles.noScrollbars,
                        )}
                        style={{ overflow: isFromConversation ? 'hidden scroll' : 'hidden' }}
                    >
                        <SimpleBar autoHide={false} style={{ maxHeight: isFromConversation ? 50 : 250 }}>
                            {renderCommentContent()}
                        </SimpleBar>
                    </div>
                    {/* label */}
                    <div className={styles.conversationCommentsLabel}>{renderLabelContent()}</div>
                </div>
                {isShownAddLabel && (
                    <div
                        className={clsx(styles.chipsAddLabelContainer, isFromConversation ? styles.chipsAddLabelConversationContainer : '')}
                    >
                        <ChipsSelectLabel
                            data={teamLabels.filter((label) => selectedLabels.findIndex((sLabel) => sLabel._id === label._id) === -1)}
                            onAddLabel={onAddLabel}
                        />
                    </div>
                )}
            </form>
        );
    };

    const handleClickAway = () => {
        !deleteDialog && isEditing && onFinishEdit();
    };

    return isFromConversation && !viewModalMode ? (
        isEditing ? (
            <CircularProgress size={'25px'} />
        ) : (
            <ClickAwayListener onClickAway={handleClickAway}>
                <div style={{ width: isFromConversation ? '414px' : '' }}>
                    {renderEditCommentContent()}
                    <Dialog
                        open={deleteDialog}
                        title={t('conversation_comment_delete_title')}
                        content={t('conversation_comment_delete_content')}
                        onClose={() => setDeleteDialog(false)}
                        onConfirm={onDeleteDialogConfirm}
                        showDontAskedAgain
                        confirmButtonProps={{
                            type: 'danger',
                        }}
                    />
                </div>
            </ClickAwayListener>
        )
    ) : (
        <div style={{ width: isFromConversation ? '414px' : '100%' }}>{renderEditCommentContent()}</div>
    );
});
export default EditCommentDetail;
