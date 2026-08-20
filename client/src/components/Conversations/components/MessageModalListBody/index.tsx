import { CircularProgress } from '@mui/material';
import { uniqBy } from 'lodash';
import type { FC } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import SimpleBar from 'simplebar-react';

import useIntersectionObserver from '@/hooks/useIntersectionObserver';
import { useQuery } from '@/hooks/useQuery';
import type { ReduxMessage } from '@/redux/slices/message.types';
import { getConversationMessagesByTeamId } from '@/services/api/teamConversation';
import apiFetch from '@/services/axios/handler';

import Message from '../Message';
import styles from './index.module.scss';

interface MessageModalListBodyProps {
    drawersOpen: boolean;
    isSmallScreen: boolean;
    commentsIndex?: number;
    msgId: string;
    teamConversationUsers?: API.SimpleUser[];
    teamConversationContact?: API.Contact;
    isJoined?: boolean;
    contactId?: string;
    channelType?: API.ChannelType;
}

const MessageModalListBody: FC<MessageModalListBodyProps> = (props) => {
    const { commentsIndex, msgId, isJoined, teamConversationUsers, teamConversationContact, contactId, channelType } = props;
    const scrollRef = useRef<HTMLDivElement>(null);

    const query = useQuery();
    const [loading, setLoading] = useState(false);
    const [loadingDown, setLoadingDown] = useState(false);

    const [messages, setMessages] = useState<ReduxMessage[]>([]);
    const [pagination, setPagination] = useState({
        limit: commentsIndex ? 7 : 50,
        skip: Math.max(0, (commentsIndex ?? 0) - 3),
        hasMoreUp: false,
        count: 0,
    });
    const [paginationDown, setPaginationDown] = useState({
        skipDown: Math.max(0, (commentsIndex ?? 0) - 3),
        hasMoreDown: !((commentsIndex ?? 0) - 3 <= 0),
    });
    const [messageRef, setMessageRef] = useState<HTMLDivElement | null>(null);
    const [lock, setLock] = useState(true);
    const [setLatestMsgNode, LatestMsgEntry] = useIntersectionObserver({ lock });
    const isLatestMsgVisible = !!LatestMsgEntry?.isIntersecting;

    const [setOldestMsgNode, OldestMsgEntry] = useIntersectionObserver({ lock });
    const isOldestMsgVisible = !!OldestMsgEntry?.isIntersecting;

    const fetchMessage = useCallback(async () => {
        try {
            setLoading(true);
            const teamConvId = query.get('conv_id') || '';
            const api = getConversationMessagesByTeamId.api(teamConvId, pagination.limit, pagination.skip);
            const response = await apiFetch<
                API.PaginatedResponse<
                    API.ConversationMessage[],
                    {
                        users: {
                            [key: string]: API.User;
                        };
                    }
                >
            >(api, getConversationMessagesByTeamId.method);
            const message = response.data.data.reverse();
            setMessages((prevState) => uniqBy([...message, ...prevState], (data) => data.id));
            setPagination((prev) => ({
                ...prev,
                hasMoreUp: response.data.has_more,
                count: response.data.count,
            }));
            setLoading(false);
        } catch (error) {
            console.log(error);
            setLoading(false);
        }
    }, [pagination.skip, query, pagination.limit]);

    useEffect(() => {
        fetchMessage();
    }, [fetchMessage]);

    const fetchMessageDown = useCallback(
        async (skipDown: number) => {
            try {
                setLoadingDown(true);
                const teamConvId = query.get('conv_id') || '';
                const api = getConversationMessagesByTeamId.api(teamConvId, 50, skipDown);
                const response = await apiFetch<
                    API.PaginatedResponse<
                        API.ConversationMessage[],
                        {
                            users: {
                                [key: string]: API.User;
                            };
                        }
                    >
                >(api, getConversationMessagesByTeamId.method);
                const message = response.data.data.reverse();
                setMessages((prevState) => uniqBy([...message, ...prevState], (data) => data.id));
                setPaginationDown((prev) => ({
                    ...prev,
                    hasMoreDown: prev.skipDown > 0,
                    skipDown: skipDown,
                }));
                setLoadingDown(false);
            } catch (error) {
                console.log(error);
                setLoadingDown(false);
            }
        },
        [query],
    );

    useEffect(() => {
        if (isLatestMsgVisible && !loading && pagination.hasMoreUp) {
            setPagination((prev) => ({
                ...prev,
                skip: prev.skip + prev.limit,
                limit: 50,
            }));
        }
    }, [isLatestMsgVisible, loading, pagination.hasMoreUp]);

    useEffect(() => {
        if (isOldestMsgVisible && !loadingDown && paginationDown.hasMoreDown) {
            fetchMessageDown(paginationDown.skipDown - 50 < 0 ? 0 : paginationDown.skipDown - 50);
        }
    }, [isOldestMsgVisible, fetchMessageDown, paginationDown.skipDown, loadingDown, paginationDown.hasMoreDown]);

    useEffect(() => {
        if (msgId && messageRef) {
            messageRef.scrollIntoView({ behavior: 'smooth', block: 'center' });
            setTimeout(() => {
                setLock(false);
            }, 500);
        }
    }, [msgId, messageRef]);

    return (
        <div className={styles.container}>
            <SimpleBar className={styles.outer} scrollableNodeProps={{ ref: scrollRef }}>
                <div className={styles.reverseContainer}>
                    {loadingDown ? (
                        <div className={styles.messageListLoading}>
                            <CircularProgress color="primary" />
                        </div>
                    ) : null}
                    <div className={styles.messageListBody}>
                        {messages.map((el, index) => {
                            const user =
                                el.contact ||
                                teamConversationUsers?.find((userItem: API.SimpleUser) => userItem.id === el.from) ||
                                teamConversationContact;
                            return (
                                <Message
                                    containerRef={
                                        index === 0 ? setLatestMsgNode : index === messages.length - 1 ? setOldestMsgNode : undefined
                                    }
                                    {...(el.id === msgId && { setMessageRef })}
                                    index={index}
                                    key={el.id}
                                    id={el.id}
                                    from={el.from}
                                    type={el.type}
                                    createdAt={el.created_at}
                                    content={el.content}
                                    comments={el.comments}
                                    conversationId={el.conversation_id}
                                    msgId={el.id}
                                    viewMode
                                    messages={messages}
                                    user={user}
                                    contactId={contactId}
                                    channelType={channelType}
                                    isJoined={isJoined}
                                    fromUser={el.contact}
                                    isPinned={el.pinned}
                                />
                            );
                        })}

                        {loading ? (
                            <div className={styles.messageListLoading}>
                                <CircularProgress color="primary" />
                            </div>
                        ) : null}
                    </div>
                </div>
            </SimpleBar>
        </div>
    );
};

export default MessageModalListBody;
