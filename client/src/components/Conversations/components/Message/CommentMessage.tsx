import MessageOutlinedIcon from '@mui/icons-material/MessageOutlined';
import { IconButton } from '@mui/material';
import type { FC } from 'react';
import { useCallback, useContext, useState } from 'react';

import type { MessageCommentsSaveType } from '@/pages/Databoards/components/Conversations/CommentCard/EditCommentDetail';
import {
    deleteConversationMessageComment,
    postConversationMessageComment,
    putConversationMessageComment,
} from '@/services/api/teamConversation';
import apiFetch from '@/services/axios/handler';

import { CommentContext } from '../CommentContext';
import CommentDetail from './commentDetail';
import styles from './index.module.scss';

interface CommentMessageProps {
    comments?: API.ConversationMessageComments[];
    conversationId: string;
    msgId: string;
    viewMode: boolean;
    contactId?: string;
    teamId?: string;
    isEditing?: boolean;
    onEditingChange?: (editing: boolean) => void;
}
const CommentMessage: FC<CommentMessageProps> = (props) => {
    const { comments, conversationId, msgId, viewMode, contactId, teamId, isEditing, onEditingChange } = props;
    const { onFinish } = useContext(CommentContext);
    const [editingComment, setEditingComment] = useState(false);

    return (
        <>
            <div
                className={styles.commentMessageContent}
                style={{ width: editingComment || isEditing || (comments && comments.length > 0) ? '414px' : '100%' }}
            >
                {/* Show existing comments */}
                {contactId && comments && comments.length > 0 && (
                    <>
                        {comments.map((comment) => (
                            <div>
                                <CommentDetail
                                    handleClickSave={() => {}}
                                    onDeleteComment={() => {}}
                                    msgId={msgId}
                                    defaultEditing={false}
                                    commentId={comment._id}
                                    contactId={contactId}
                                    teamId={teamId}
                                    readonly={true}
                                />
                            </div>
                        ))}
                    </>
                )}

                {/* Show new comment form when editing */}
                {(editingComment || isEditing) && (
                    <div style={{ marginTop: 8 }}>
                        <CommentDetail
                            handleClickSave={() => {}}
                            onDeleteComment={() => {}}
                            msgId={msgId}
                            defaultEditing={true}
                            contactId={contactId}
                            teamId={teamId}
                            readonly={true}
                        />
                    </div>
                )}
            </div>
        </>
    );
};

export default CommentMessage;
