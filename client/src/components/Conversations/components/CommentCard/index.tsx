import { EllipsisText, Typography, useDialog } from '@imbrace/ui';
import type { DialogProps } from '@mui/material';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import DialogModal from '@/components/DialogModal';
import { getMessageIndex } from '@/services/api/messages';
import {
    deleteConversationMessageComment,
    postConversationMessageComment,
    putConversationMessageComment,
} from '@/services/api/teamConversation';
import apiFetch from '@/services/axios/handler';

import ChipsLabel from '../ChipsLabel';
import MessageListHeader from '../MessageListHeader';
import MessageModalListBody from '../MessageModalListBody';
import CommentHeader from './CommentHeader';
import type { CommentEditDetailSave, MessageCommentsSaveType } from './EditCommentDetail';
import EditCommentDetail from './EditCommentDetail';
import styles from './index.module.scss';
interface CommentCardProps {
    comment: API.ConversationMessageContactComments;
    reload: () => void;
    onClose?: () => void;
}
interface MessageIndexType {
    count: number;
}
const CommentCard = (props: CommentCardProps) => {
    const { comment, reload, onClose } = props;
    const { t } = useTranslation();
    const [editCommentMode, setEditCommentMode] = useState<boolean>(false);
    const [comments, setComments] = useState<API.ConversationMessageComments>();
    const [commentsIndex, setCommentsIndex] = useState<number>();
    const [showMessageMode, setShowMessageMode] = useState<boolean>(false);
    const editCommentDetailRef = useRef<CommentEditDetailSave>(null);
    const [{ dialog }, dialogHolder] = useDialog();

    const handleClickSave = async (formData: MessageCommentsSaveType) => {
        const conversationId = comment.conversation_id;
        const msgId = comment._id;
        let api;
        if (formData.id) {
            api = putConversationMessageComment.api(conversationId, formData.id);
        } else {
            api = postConversationMessageComment.api(conversationId, msgId);
        }
        const requestBody: {
            content: string;
            labels: string[];
        } = {
            content: formData.content,
            labels: formData.labels,
        };
        await apiFetch(api, formData.id ? putConversationMessageComment.method : postConversationMessageComment.method, requestBody);
        reload();
        setEditCommentMode(false);
    };

    useEffect(() => {
        if (comment.comments && comment.comments.length > 0) {
            setComments(comment.comments[0]);
        }
    }, [comment]);

    /* delete confirm and do delete */
    const onDeleteDialogShow = async () => {
        const onDelete = async (dontAskAgain?: boolean) => {
            if (dontAskAgain) {
                window.localStorage.setItem('dont_asked_delete_comment_again', 'true');
            }
            await handleClickDelete(comments?._id);
            return true;
        };
        const dontAskedAgain = window.localStorage.getItem('dont_asked_delete_comment_again');
        if (dontAskedAgain !== 'true') {
            dialog({
                title: t('conversation_comment_delete_title'),
                content: t('conversation_comment_delete_content'),
                showDontAskedAgain: true,
                confirmButtonProps: {
                    type: 'danger',
                },
                onConfirm: async (dontAskAgain) => {
                    await onDelete(dontAskAgain);
                    return true;
                },
                onClose: () => {},
            });
        } else {
            await onDelete();
        }
    };

    const handleClickDelete = async (commentId?: string) => {
        if (commentId && comment.conversation_id) {
            const res = await deleteComment(comment.conversation_id, commentId);
            if (res === undefined) {
                return;
            }
            if (res.status === 201) {
                setEditCommentMode(false);
                reload();
            }
        }
    };

    const deleteComment = useCallback(async (convId: string, commentId: string) => {
        try {
            return await apiFetch(deleteConversationMessageComment.api(convId, commentId), deleteConversationMessageComment.method);
        } catch (error) {
            console.log('deleteComment error: ', error);
        }
    }, []);

    const fetchMessageIndex = useCallback(async () => {
        try {
            const { data } = await apiFetch<MessageIndexType>(
                getMessageIndex.api(comment.team_conversation.conversation_id, comment._id),
                getMessageIndex.method,
            );
            if (data) {
                setCommentsIndex(data.count);
            }
        } catch (error) {
            console.log(error);
        }
    }, [comment._id, comment.team_conversation.conversation_id]);

    const onShowMessage = async () => {
        await fetchMessageIndex();
        setShowMessageMode(true);
    };

    const onCloseShowMessageMode = () => {
        setShowMessageMode(false);
    };

    const openUnSaveDialog = () => {
        dialog({
            title: t('contacts_done_dialog_title'),
            content: t('contacts_done_dialog_content'),
            cancelText: t('contacts_done_dialog_exit_only'),
            confirmText: t('contacts_done_dialog_save_and_exit'),
            onConfirm: async () => {
                editCommentDetailRef?.current?.onSave();
                return true;
            },
            onClose: () => {
                setEditCommentMode(false);
            },
        });
    };

    const onEditCommitModalClose: DialogProps['onClose'] = (event, reason: 'backdropClick' | 'escapeKeyDown') => {
        if (reason === 'backdropClick') {
            openUnSaveDialog();
        } else {
            setEditCommentMode(false);
        }
    };

    return (
        <>
            {dialogHolder}
            <div className={styles.card}>
                {/* header */}
                <CommentHeader
                    handleClickEdit={() => setEditCommentMode(true)}
                    onDeleteDialogShow={onDeleteDialogShow}
                    editCommentMode={false}
                    title={comment?.team_conversation?.channel_type}
                    chatName={comment?.team_conversation?.contact?.display_name}
                    isEditable
                />
                {/* comment */}
                <div className={styles.conversationCommentsComment} style={{ height: '32px' }}>
                    <EllipsisText
                        text={comments ? comments.content : ''}
                        element={
                            <Typography
                                variant="Caption"
                                className={styles.commentText}
                                style={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    WebkitLineClamp: 2,
                                    display: '-webkit-box',
                                    WebkitBoxOrient: 'vertical',
                                }}
                            />
                        }
                        whiteSpace="pre-wrap"
                    />
                </div>
                {/* label */}
                <div className={styles.conversationCommentsLabel}>
                    <ChipsLabel data={comments ? comments.labels : []} editCommentMode={false} onShowMessage={onShowMessage} />
                </div>
            </div>

            {/* for edit comment modal */}
            <DialogModal
                open={editCommentMode}
                onClose={onEditCommitModalClose}
                showHeader={false}
                sxContent={{
                    '.MuiInputBase-input': { fontSize: '1rem !important' },
                    '.MuiTypography-root': { fontSize: '0.875rem !important' },
                    '#commentsRow': { width: 'auto' },
                    '#chip': { height: '30px' },
                }}
                sxDialog={{ '& .MuiPaper-root': { width: '600px', padding: '12px 16px' } }}
            >
                <EditCommentDetail
                    ref={editCommentDetailRef}
                    handleClickSave={handleClickSave}
                    commentData={comments}
                    isFromConversation={false}
                    chatName={comment?.team_conversation?.contact?.display_name}
                    channelType={comment?.channel_type}
                    msgId={comment?._id}
                    teamId={comment?.team_conversation.team_id}
                />
            </DialogModal>

            {/* for view Message comment modal */}
            <DialogModal
                open={showMessageMode}
                onClose={onCloseShowMessageMode}
                handleClose={onCloseShowMessageMode}
                showHeader
                showClose
                sxDialog={{ '& .MuiPaper-root': { width: '832px', padding: '11px 0' } }}
                sxHeader={{ padding: '0 11px' }}
            >
                <div className={styles.messageListRoot}>
                    <MessageListHeader
                        teamConvId={comment.team_conversation.id}
                        teamConversation={comment.team_conversation}
                        onClose={onClose}
                    />

                    <MessageModalListBody
                        drawersOpen={false}
                        isSmallScreen={false}
                        commentsIndex={commentsIndex}
                        msgId={comment._id}
                        teamConversationUserId={comment.team_conversation.id}
                        teamConversationContact={comment.team_conversation?.contact}
                        teamConversationUsers={comment.team_conversation?.users}
                        contactId={comment.team_conversation?.contact?.id}
                    />
                </div>
            </DialogModal>
        </>
    );
};

export default CommentCard;
