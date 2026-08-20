import { CircularProgress } from '@mui/material';
import useMediaQuery from '@mui/material/useMediaQuery';
import isEmpty from 'lodash/isEmpty';
import type { FC } from 'react';
import { useCallback, useEffect, useRef } from 'react';

import { useQuery } from '@/hooks/useQuery';
import { clearMessage, fetchMessagesCommentThunk, fetchMessagesThunk } from '@/redux/slices/message';
import { fetchTeamConversationByIdThunk } from '@/redux/slices/teamConversation';
import { useAppDispatch, useAppSelector } from '@/redux/store';

import CommentContextProvider from '../CommentContext';
import type { MessageListBodyRef } from '../MessageListBody';
import MessageListBody from '../MessageListBody';
import MessageListHeader from '../MessageListHeader';
import Empty from './Empty';
import styles from './index.module.scss';

interface MessageListProps {
    drawersOpen: boolean;
    currentDrawer: string;
    messageIndex?: string;
    setCurrentDrawer: (drawer: string) => void;
    insertedMessage?: { content: string; timestamp: number } | null;
    isInOverview?: boolean;
}

const MessageList: FC<MessageListProps> = (props) => {
    const { drawersOpen, currentDrawer, messageIndex, setCurrentDrawer, insertedMessage, isInOverview } = props;
    const dispatch = useAppDispatch();
    const query = useQuery();
    const msgLoadingStatus = useAppSelector((state) => state.Message.loadingStatus);
    const skip = useAppSelector((state) => state.Message.skip);
    const teamConversationLoadingStatus = useAppSelector((state) => state.TeamConversation.getTeamConversationByIdStatus);
    const teamConversation = useAppSelector((state) => state.TeamConversation.teamConversation);
    const teamId = useAppSelector((state) => state.TeamConversation.teamConversation?.team_id);
    const isSmallScreen = useMediaQuery('(max-width:1919px)');
    const isLoading = (msgLoadingStatus === 'FETCH_IN_PROGRESS' || teamConversationLoadingStatus === 'FETCH_IN_PROGRESS') && skip === 0;
    const messageListBodyRef = useRef<MessageListBodyRef>(null);
    const teamConversationId = query.get('conv_id') || teamConversation?.id;
    const onFinish = useCallback(async () => {
        try {
            if (teamConversation?.id) {
                dispatch(fetchMessagesCommentThunk(teamConversation.id));
            }
        } catch (error) {
            console.log(error);
        }
    }, [teamConversation?.id, dispatch]);

    useEffect(() => {
        const fetchMessage = async () => {
            try {
                const teamConvId = query.get('conv_id') || teamConversation?.id;
                if (teamConvId) {
                    await dispatch(fetchTeamConversationByIdThunk(teamConvId)).unwrap();
                    dispatch(fetchMessagesThunk({ limit: messageIndex ? 7 : 50, skip: messageIndex ? Math.max(0, parseInt(messageIndex) - 2) : 0, teamConvId }));
                }
            } catch (error) {
                console.log(error);
            }
        };
        if(messageIndex) {
            dispatch(clearMessage());
        }
        fetchMessage();
    }, [dispatch, teamId, teamConversation?.id, query, messageIndex]);

    return (
        <>
            <div className={styles.messageListRoot}>
                {!isEmpty(teamConversation) ? (
                    <>
                        <div className={`${styles.listContainer} ${isLoading ? styles.blur : ''}`}>
                            <CommentContextProvider onFinish={onFinish}>
                                <MessageListBody ref={messageListBodyRef} drawersOpen={drawersOpen} isSmallScreen={isSmallScreen} messageIndex={messageIndex} />
                            </CommentContextProvider>
                        </div>
                    </>
                ) : (
                    <Empty />
                )}

                {isLoading && (
                    <div className={styles.loadingContainer}>
                        <CircularProgress />
                    </div>
                )}
            </div>
        </>
    );
};

export default MessageList;
