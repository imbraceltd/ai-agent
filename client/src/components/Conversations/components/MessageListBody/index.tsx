import 'simplebar-react/dist/simplebar.min.css';

import { EllipsisText, Typography } from '@imbrace/ui';
import { KeyboardArrowDown as KeyboardArrowDownIcon, Refresh as RefreshIcon } from '@mui/icons-material';
import { CircularProgress, Fab, Slide, Button } from '@mui/material';
import debounce from 'lodash/debounce';
import { forwardRef, useCallback, useEffect, useImperativeHandle, useMemo, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import SimpleBar from 'simplebar-react';

import { FETCH_IN_PROGRESS, FETCH_SUCCEEDED } from '@/constants/app';
import useIntersectionObserver from '@/hooks/useIntersectionObserver';
import { clearShowLatestUnreadMsg, fetchMessagesThunk } from '@/redux/slices/message';
import { useAppDispatch, useAppSelector } from '@/redux/store';
import clsx from '@/utils/clsx';

import Message from '../Message';
import styles from './index.module.scss';

interface MessageListBodyProps {
    drawersOpen: boolean;
    isSmallScreen: boolean;
    messageIndex?: string;
}

export interface MessageListBodyRef {
    scrollToBottom: () => void;
}

const MessageListBody = forwardRef<MessageListBodyRef, MessageListBodyProps>((props, ref) => {
    const { drawersOpen, isSmallScreen, messageIndex } = props;
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const messages = useAppSelector((state) => state.Message.messages);
    const hasMore = useAppSelector((state) => state.Message.hasMore);
    const limit = useAppSelector((state) => state.Message.limit);
    const skip = useAppSelector((state) => state.Message.skip);
    const loadingStatus = useAppSelector((state) => state.Message.loadingStatus);
    const showLatestUnreadMsg = useAppSelector((state) => state.Message.showLatestUnreadMsg);
    const teamConversationLoadingStatus = useAppSelector((state) => state.TeamConversation.getTeamConversationByIdStatus);
    const teamConversationId = useAppSelector((state) => state.TeamConversation.teamConversation?.id);
    const teamConversationTeamId = useAppSelector((state) => state.TeamConversation.teamConversation?.team_id);
    const teamConversationUsers = useAppSelector((state) => state.TeamConversation.teamConversation?.users);
    const teamConversationContact = useAppSelector((state) => state.TeamConversation.teamConversation?.contact);
    const teamConversationChannelType = useAppSelector((state) => state.TeamConversation.teamConversation?.channel_type);
    const isJoined = useAppSelector((state) => state.TeamConversation.teamConversation?.is_joined);
    // const accountId = useAppSelector((state) => state.Account.id);
    const scrollRef = useRef<HTMLDivElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const fetchedLastMessage = useRef(false);
    const [targetMessageRef, setTargetMessageRef] = useState<HTMLDivElement | null>(null);
    const [hasScrolledToTarget, setHasScrolledToTarget] = useState(false);
    
    // Lock intersection observer when scrolling to target message
    const [lock, setLock] = useState(false);
    
    const [setLatestMsgNode, LatestMsgEntry] = useIntersectionObserver({
        lock: loadingStatus === FETCH_IN_PROGRESS || teamConversationLoadingStatus === FETCH_IN_PROGRESS || lock,
    });
    const isLatestMsgVisible = !!LatestMsgEntry?.isIntersecting;

    const [setOldestMsgNode, OldestMsgEntry] = useIntersectionObserver({
        lock: loadingStatus === FETCH_IN_PROGRESS || teamConversationLoadingStatus === FETCH_IN_PROGRESS || lock,
    });
    const isOldestMsgVisible = !!OldestMsgEntry?.isIntersecting;

    const visible = showLatestUnreadMsg && !isLatestMsgVisible;

    // Calculate target message index from messageIndex
    const targetMessageIndex = messageIndex ? parseInt(messageIndex) : null;

    // Check if we should show the fetch latest button
    const shouldShowFetchLatestButton = messageIndex && !fetchedLastMessage.current && loadingStatus === FETCH_SUCCEEDED;
    
    useImperativeHandle(ref, () => ({
        scrollToBottom: () => {
            if (scrollRef.current && loadingStatus === FETCH_SUCCEEDED) {
                scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
            }
        },
    }));

    // Scroll to target message when it's available and not yet scrolled
    useEffect(() => {
        if (targetMessageRef && !hasScrolledToTarget && loadingStatus === FETCH_SUCCEEDED) {
            setLock(true);
            targetMessageRef.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setHasScrolledToTarget(true);
            // Unlock intersection observer after scroll animation
            setTimeout(() => {
                setLock(false);
            }, 1000);
        }
    }, [targetMessageRef, hasScrolledToTarget, loadingStatus]);

    // Reset scroll state when messageIndex changes
    useEffect(() => {
        fetchedLastMessage.current = false;
        if (messageIndex) {
            setHasScrolledToTarget(false);
            setTargetMessageRef(null);
        }
    }, [messageIndex]);

    const fetchNextPage = useMemo(
        () =>
            debounce(() => {
                if (isOldestMsgVisible && loadingStatus !== FETCH_IN_PROGRESS && hasMore && teamConversationId) {
                    dispatch(
                        fetchMessagesThunk({
                            limit: 50,
                            skip: skip + 50,
                            teamConvId: teamConversationId,
                        }),
                    );
                }
            }, 300),
        [isOldestMsgVisible, dispatch, limit, skip, loadingStatus, hasMore, teamConversationId],
    );

    // Fetch latest message when target message is visible
    const fetchLatestMessageFromIndex = () => {
        if (loadingStatus === FETCH_SUCCEEDED && teamConversationId && messageIndex && !fetchedLastMessage.current) {
            dispatch(fetchMessagesThunk({ limit: parseInt(messageIndex) > 50 ? parseInt(messageIndex) - 1 : 50, skip: 0, teamConvId: teamConversationId }));
            fetchedLastMessage.current = true;
        }
    }

    useEffect(() => {
        fetchNextPage();
    }, [fetchNextPage]);

    const handleScrollToBottom = useCallback(() => {
        if (scrollRef.current && loadingStatus === FETCH_SUCCEEDED) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [loadingStatus]);

    useEffect(() => {
        if (teamConversationId && skip === 0) {
            handleScrollToBottom();
        }
    }, [teamConversationId, handleScrollToBottom, skip]);

    useEffect(() => {
        if (showLatestUnreadMsg && isLatestMsgVisible) {
            dispatch(clearShowLatestUnreadMsg());
        }
    }, [showLatestUnreadMsg, isLatestMsgVisible, dispatch]);

    useEffect(() => {
        if (isLatestMsgVisible) {
            handleScrollToBottom();
        }
    }, [messages, handleScrollToBottom, isLatestMsgVisible]);

    const renderLatestMessage = () => {
        const renderMessage = () => {
            switch (latestMessage.type) {
                case 'response':
                case 'text':
                case 'jaas.conference':
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
        };
        const latestMessage = messages[messages.length - 1];
        if (latestMessage && latestMessage.from !== accountId) {
            const username =
                latestMessage.from === latestMessage.contact?._id
                    ? latestMessage.contact?.display_name
                    : teamConversationUsers?.find((user) => user.id === latestMessage.from)?.display_name;
            return (
                <>
                    <Typography variant="BodyBold" className={styles.username}>
                        {username}
                    </Typography>
                    <span>: </span>
                    {renderMessage()}
                </>
            );
        }
        return null;
    };

    return (
        <div className={styles.container} ref={containerRef}>
            <SimpleBar className={styles.outer} scrollableNodeProps={{ ref: scrollRef }}>
                <div className={styles.reverseContainer}>
                    <div className={styles.messageListBody}>
                        {messages.map((el, index) => {
                            const user =
                                el.contact ||
                                teamConversationUsers?.find((userItem: API.SimpleUser) => userItem.id === el.from) ||
                                teamConversationContact;
                            
                            // Check if this is the target message to scroll to
                            const isTargetMessage = targetMessageIndex !== null && index === targetMessageIndex;
                            
                            return (
                                <Message
                                    containerRef={
                                        index === messages.length - 1 ? setLatestMsgNode : index === 0 ? setOldestMsgNode : undefined
                                    }
                                    {...(isTargetMessage && { setMessageRef: setTargetMessageRef })}
                                    index={index}
                                    key={el.id}
                                    from={el.from}
                                    type={el.type}
                                    contactId={teamConversationContact?.id}
                                    createdAt={el.created_at}
                                    content={el.content}
                                    viewMode={false}
                                    comments={el.comments}
                                    conversationId={el.conversation_id}
                                    msgId={el.id}
                                    messages={messages}
                                    user={user}
                                    isJoined={isJoined}
                                    channelType={teamConversationChannelType}
                                    onLoad={() => {
                                        if (index === messages.length - 1 && isLatestMsgVisible) {
                                            handleScrollToBottom();
                                        }
                                    }}
                                    fromUser={el.contact}
                                    teamId={teamConversationTeamId}
                                    isPinned={(el as any).pinned || false}
                                />
                            );
                        })}
                        
                        {/* New button to fetch latest messages - positioned at bottom of message list */}
                        {shouldShowFetchLatestButton ? (
                            <div className={styles.fetchLatestButtonContainer}>
                                <Button
                                    variant="contained"
                                    color="primary"
                                    className={styles.fetchLatestButton}
                                    onClick={() => {
                                        fetchLatestMessageFromIndex();
                                    }}
                                    startIcon={<RefreshIcon />}
                                >
                                    Load Latest Messages
                                </Button>
                            </div>
                        ) : null}
                    </div>

                    {loadingStatus === 'FETCH_IN_PROGRESS' && skip !== 0 ? (
                        <div className={styles.messageListLoading}>
                            <CircularProgress color="imbrace_blue" />
                        </div>
                    ) : null}
                    
                </div>
            </SimpleBar>
            {/* <Slide direction="up" in={visible} container={containerRef.current}>
                <div
                    className={styles.latestUnreadMsg}
                    onClick={() => {
                        dispatch(clearShowLatestUnreadMsg());
                        const scrollEl = scrollRef.current;
                        if (scrollEl) {
                            scrollEl.scrollTo({ behavior: 'smooth', top: scrollEl.scrollHeight });
                        }
                    }}
                >
                    {renderLatestMessage()}
                </div>
            </Slide> */}
        </div>
    );
});

export default MessageListBody;
