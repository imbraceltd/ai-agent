import { DropdownMenu, DropdownMenuItem, EllipsisText, Icon, IconButton, Space, Typography } from '@imbrace/ui';
import { Divider } from '@mui/material';
import type { FC, MouseEvent } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './index.module.scss';

interface CommentHeaderType {
    editCommentMode: boolean;
    isFromConversation?: boolean;
    handleClickEdit?: () => void;
    onDeleteDialogShow?: () => void;
    title?: string;
    chatName?: string;
    time?: string;
    isEditable?: boolean;
}
enum channelTypeEnum {
    web = 'Web',
    whatsapp = 'WhatsApp',
    facebook = 'Facebook',
    email = 'Email',
    wechat = 'WeChat',
    line = 'Line',
    instagram = 'Instagram',
}
const CommentHeader: FC<CommentHeaderType> = (props) => {
    const { t } = useTranslation();
    const { editCommentMode, handleClickEdit, title, chatName, time, isFromConversation, onDeleteDialogShow, isEditable } = props;
    const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
    const openEditAndDelete = Boolean(anchorEl);

    const handleClick = (event: MouseEvent<HTMLButtonElement>) => {
        setAnchorEl(event.currentTarget);
    };

    const handleClose = () => {
        setAnchorEl(null);
    };

    const handleEdit = () => {
        if (handleClickEdit) {
            handleClickEdit();
        }
        setAnchorEl(null);
    };
    const handleDelete = () => {
        setAnchorEl(null);
        onDeleteDialogShow && onDeleteDialogShow();
    };

    return (
        <>
            <div className={styles.conversationCommentsRow} style={{ width: '100%' }}>
                <Space size={8} className={styles.conversationCommentsHeaderText} style={{ width: isFromConversation ? '100%' : '80%' }}>
                    {title &&
                        (isFromConversation ? (
                            <EllipsisText
                                text={title}
                                element={
                                    <Typography variant={isFromConversation ? 'BodyBold' : 'Caption'} className={styles.titleBlueText} />
                                }
                                style={{
                                    width: '230px',
                                }}
                            />
                        ) : (
                            <Typography variant={'Caption'} className={styles.titleText}>
                                {channelTypeEnum[title as keyof typeof channelTypeEnum]}
                            </Typography>
                        ))}
                    {chatName && (
                        <>
                            <Divider className={styles.dividerStyle} orientation="vertical" variant="middle" flexItem />
                            <EllipsisText text={chatName} element={<Typography variant="Caption" className={styles.titleText} />} />
                        </>
                    )}
                    {isFromConversation && <Typography className={styles.titleText}>{time}</Typography>}
                </Space>
                {!editCommentMode && !isFromConversation && isEditable && (
                    <IconButton variant="text" type="secondary" size="xs" onClick={handleClick} sx={{ padding: 0 }}>
                        <Icon name="more" />
                    </IconButton>
                )}
            </div>
            <DropdownMenu anchorEl={anchorEl} open={openEditAndDelete} onClose={handleClose}>
                <DropdownMenuItem onClick={handleEdit}>{t('form_edit')}</DropdownMenuItem>
                <DropdownMenuItem onClick={handleDelete}>{t('form_delete')}</DropdownMenuItem>
            </DropdownMenu>
        </>
    );
};

export default CommentHeader;
