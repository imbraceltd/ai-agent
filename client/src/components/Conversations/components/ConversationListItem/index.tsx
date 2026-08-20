import { EllipsisText, Icon } from '@imbrace/ui';
import LoadingButton from '@mui/lab/LoadingButton';
import { Box, ListItemText, Typography } from '@mui/material';
import type { CSSProperties, FC } from 'react';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { CONVERSATION_MODE } from '@/constants/conversation';
import { fetchViewsCountThunk, joinTeamConversationThunk, leaveTeamConversationThunk } from '@/redux/slices/teamConversation';
import { useAppDispatch, useAppSelector } from '@/redux/store';
import clsx from '@/utils/clsx';

import MailIcon from '../mailIcon';
import styles from './index.module.scss';
import { StyledListItemAvatar } from './style';
import TeamTags from './TeamTags';

const conversationChannelIcon = {
    web: <Icon namespace="channel" name="web" fontSize={25} />,
    facebook: <Icon namespace="channel" name="facebook" fontSize={25} />,
    whatsapp: <Icon namespace="channel" name="whatsapp" fontSize={25} />,
    instagram: <Icon namespace="channel" name="instagram" fontSize={25} />,
    email: <Icon namespace="channel" name="email" fontSize={25} />,
    wechat: <Icon namespace="channel" name="wechat" fontSize={25} />,
    line: <Icon namespace="channel" name="line" fontSize={25} />,
};

interface ConversationProps {
    name: string;
    status: API.StatusType;
    timestamp: string;
    channelType: API.ChannelType;
    onClick?: () => void;
    id: string;
    isJoined: boolean;
    isAgentJoined: boolean;
    conversationId: string;
    teamName?: string;
    style?: CSSProperties;
    isPresence?: boolean;
    latestMessage: API.LatestMessage;
    contact: API.Contact;
}

const StatusI18n = {
    active: 'conversation_room_active',
    closed: 'conversation_room_closed',
    agent_needed: '',
    spam: 'conversation_room_spam',
    'soon to be': 'conversation_status_soon_to_be',
    overdue: 'conversation_status_overdue',
    'rep needed': 'conversation_status_rep_needed',
    unassigned: 'conversation_status_unassigned',
    pending: 'conversation_status_pending',
    online: 'conversation_status_online',
};

const buttonStyle = {
    padding: '2px 0',
    boxShadow: 'none',
    fontSize: '0.75rem',
    lineHeight: '0.875rem',
    fontWeight: 500,
    minWidth: 50,
    '&:hover': {
        boxShadow: 'none',
    },
    '&:focus': {
        boxShadow: 'none',
    },
};

const Conversation: FC<ConversationProps> = (props) => {
    const chipbarRef = useRef<HTMLDivElement>(null);
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const teamConversation = useAppSelector((state) => state.TeamConversation.teamConversation);
    const { name, status, timestamp, channelType, onClick, id, isJoined, teamName, style, isPresence, latestMessage, contact } = props;
    const [isJoiningRoom, setIsJoiningRoom] = useState(false);
    const [isLeavingRoom, setIsLeavingRoom] = useState(false);

    const renderTimestamp = useCallback(() => {
        if (
            new Date(timestamp).getDate() === new Date().getDate() && // if today, render the time
            new Date(timestamp).getMonth() === new Date().getMonth() &&
            new Date(timestamp).getFullYear() === new Date().getFullYear()
        ) {
            return (
                <Typography variant="caption" sx={{ color: '#bdbdbd' }}>
                    {new Date(timestamp).getHours().toString().padStart(2, '0')}:
                    {new Date(timestamp).getMinutes().toString().padStart(2, '0')}
                </Typography>
            );
        }

        return (
            <Typography variant="caption" sx={{ color: '#bdbdbd' }}>
                {new Date(timestamp).getDate()}/{new Date(timestamp).getMonth() + 1}/{new Date(timestamp).getFullYear()}
            </Typography>
        );
    }, [timestamp]);

    const handleJoinRoom = useCallback(async () => {
        setIsJoiningRoom(true);

        await dispatch(joinTeamConversationThunk({ teamConvId: id, mode: CONVERSATION_MODE.MANUAL }));
        setIsJoiningRoom(false);
        dispatch(fetchViewsCountThunk());
    }, [dispatch, id]);

    const handleLeaveRoom = useCallback(async () => {
        setIsLeavingRoom(true);

        await dispatch(
            leaveTeamConversationThunk({
                teamConvId: id,
            }),
        );
        setIsLeavingRoom(false);
        dispatch(fetchViewsCountThunk());
    }, [dispatch, id]);

    const renderLatestMessage = () => {
        if (latestMessage) {
            switch (latestMessage.type) {
                case 'response':
                case 'text':
                case 'jaas.conference':
                case 'message_template':
                    return <EllipsisText style={{ color: 'var(--color-light-6)' }} text={latestMessage.content.text} />;
                case 'quick_reply':
                    return <EllipsisText style={{ color: 'var(--color-light-6)' }} text={latestMessage.content.title} />;
                case 'image':
                case 'whatsapp.sticker':
                    return <EllipsisText style={{ color: 'var(--color-light-6)' }} text={t('send_image')} />;
                case 'video':
                case 'audio':
                case 'pdf':
                    return <EllipsisText style={{ color: 'var(--color-light-6)' }} text={t(`send_${latestMessage.type}`)} />;
                case 'whatsapp.template':
                    let message = latestMessage.content.text;
                    latestMessage.content.variables.forEach((variable, index) => {
                        message = message.replace(`{{${index + 1}}}`, variable);
                    });
                    return <EllipsisText style={{ color: 'var(--color-light-6)' }} text={message} />;
                default:
                    return <div />;
            }
        }
        return <div />;
    };

    return (
        <div
            className={clsx(
                styles.conversationItemRoot,
                isPresence ? styles.online : '',
                teamConversation?.id === id ? styles.selected : '',
            )}
            style={style}
            onClick={onClick}
        >
            <Box className={styles.conversationItemMain} sx={{ padding: 0, gap: '12px' }}>
                <StyledListItemAvatar sx={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
                    {conversationChannelIcon[channelType]}
                    {channelType === 'web' && contact?.email && (
                        <div className={styles.hasEmail}>
                            <MailIcon iconWidth={12} />
                        </div>
                    )}
                </StyledListItemAvatar>

                <ListItemText
                    disableTypography
                    sx={{ margin: 0 }}
                    primary={
                        <div className={styles.titleContainer}>
                            <EllipsisText
                                text={name}
                                element={
                                    <Typography
                                        sx={{
                                            fontSize: '0.875rem',
                                            color: 'var(--color-primary-1)',
                                            fontWeight: 'bold',
                                            width: '100%',
                                            display: 'inline-block',
                                        }}
                                    />
                                }
                            />
                        </div>
                    }
                    secondary={
                        <div className={styles.subTitleContainer}>
                            {renderLatestMessage()}
                            <div className={styles.timeStampContainer}>{renderTimestamp()}</div>
                        </div>
                    }
                />
            </Box>
            <div className={styles.conversationItemBottom}>
                <div className={styles.conversationItemBottomChipBar} ref={chipbarRef}>
                    <TeamTags teamName={teamName} />
                </div>

                <div className={styles.conversationItemBottomRoot}>
                    {isJoined ? (
                        <>
                            <LoadingButton
                                variant="contained"
                                size="small"
                                color="leave_btn"
                                loading={isLeavingRoom}
                                sx={buttonStyle}
                                onClick={handleLeaveRoom}
                            >
                                {t('conversation_room_leave')}
                            </LoadingButton>
                        </>
                    ) : (
                        <LoadingButton
                            variant="contained"
                            size="small"
                            color="imbrace_blue"
                            loading={isJoiningRoom}
                            sx={buttonStyle}
                            onClick={handleJoinRoom}
                        >
                            {t('conversation_room_join')}
                        </LoadingButton>
                    )}
                </div>
            </div>
        </div>
    );
};

export default Conversation;
