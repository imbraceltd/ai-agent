import 'simplebar-react/dist/simplebar.min.css';

import { IconButton, Space, Typography } from '@imbrace/ui';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import { CircularProgress } from '@mui/material';
import type { QueryFunction } from '@tanstack/react-query';
import { useInfiniteQuery } from '@tanstack/react-query';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { FC } from 'react';
import { useEffect, useMemo, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useLocation } from 'react-router';
import { push, replace } from 'redux-first-history';
import SimpleBar from 'simplebar-react';

import useDebounce from '@/hooks/useDebounce';
import { clearShowLatestUnreadMsg } from '@/redux/slices/message';
import { resetMessageTemplate } from '@/redux/slices/messageTemplates';
import { selectConversation } from '@/redux/slices/teamConversation';
import type { ReduxTeamConversations, Views } from '@/redux/slices/teamConversation.types';
import { resetSelectWhatsAppMessage } from '@/redux/slices/whatsAppTemplates';
import { useAppDispatch, useAppSelector } from '@/redux/store';
import { getTeamConversations, getTeamConversationsByTextSearch } from '@/services/api/teamConversation';
import { ImbraceClient } from '@/services/axios';
import apiFetch from '@/services/axios/handler';

import Conversation from '../ConversationListItem';
import styles from './index.module.scss';

const serializeTeamConversation = (
    teamConvs: ReduxTeamConversations[],
    teams?: {
        [key: string]: API.Team;
    },
): ReduxTeamConversations[] => {
    return teamConvs.map((teamConv) => {
        if (teamConv.conversation) {
            const { name, status, timestamp, is_agent_joined, channel_type } = teamConv.conversation;
            return {
                ...teamConv,
                id: teamConv._id,
                name,
                status,
                timestamp,
                is_agent_joined,
                channel_type,
                team_name: teams?.[teamConv.team_id]?.name || teamConv.team_name,
            };
        }
        return {
            ...teamConv,
            team_name: teams?.[teamConv.team_id]?.name || teamConv.team_name,
        };
    });
};

export type TeamConversationsQueryData = {
    data: ReduxTeamConversations[];
    previousSkip: number;
    nextSkip?: number;
    currentSkip: number;
};
export type TeamConversationsQueryParams = [
    'teamConversations',
    {
        channelTypes?: API.ChannelType[];
        view?: Views;
        teamId?: string;
        search?: string;
        limit: number;
        businessUnitId: string;
    },
];

const fetchTeamConversations: QueryFunction<TeamConversationsQueryData, TeamConversationsQueryParams, number> = async ({
    queryKey,
    pageParam,
    signal,
}) => {
    if (!queryKey[1]) {
        throw Error('wrong parameters');
    }
    if (!queryKey[1]?.businessUnitId) {
        throw Error('missing business unit id');
    }
    const { limit = 50, view = 'all', channelTypes = [], teamId, search, businessUnitId } = queryKey[1];

    let api = getTeamConversations.api(businessUnitId, view, channelTypes, pageParam, limit);

    if (view === 'team') {
        api = api.concat(`&team_id=${teamId}`);
    }

    if (search) {
        api = getTeamConversationsByTextSearch.api(businessUnitId, search, pageParam, limit);
    }

    const response = await apiFetch<
        API.PaginatedResponse<
            API.TeamConversationListItem[],
            {
                teams: {
                    [key: string]: API.Team;
                };
            }
        >
    >(api, getTeamConversations.method, {}, ImbraceClient, {
        signal,
    });

    const responseList = serializeTeamConversation(response.data.data, response.data?.nested?.teams);

    return {
        data: responseList,
        previousSkip: Math.max(pageParam - 20, 0),
        nextSkip: response.data.has_more ? pageParam + 20 : undefined,
        currentSkip: pageParam,
    };
};

const ConversationList: FC = () => {
    const dispatch = useAppDispatch();
    const businessUnitList = useAppSelector((state) => state.BusinessUnit.businessUnitList);
    const { t } = useTranslation();
    const location = useLocation();
    const { onBoarding } = (location.state || {}) as { onBoarding?: boolean };
    const viewFilter = useAppSelector((state) => state.TeamConversation.viewFilter);
    const channelFilter = useAppSelector((state) => state.TeamConversation.channelFilter);
    const viewFilterTeamId = useAppSelector((state) => state.TeamConversation.viewFilterTeamId);

    const search = useAppSelector((state) => state.TeamConversation.teamConversationSearchQuery);
    const parentRef = useRef<HTMLDivElement>(null);
    const debouncedSearch = useDebounce(search, 200);

    const { data, hasNextPage, fetchNextPage, isFetchingNextPage, isFetching, isRefetching, refetch, isError } = useInfiniteQuery({
        queryKey: [
            'teamConversations',
            {
                businessUnitId: businessUnitList[0].id,
                search: debouncedSearch,
                limit: 50,
                view: viewFilter,
                channelTypes: channelFilter,
                teamId: viewFilterTeamId,
            },
        ],
        queryFn: fetchTeamConversations,
        initialPageParam: 0,
        getPreviousPageParam: (firstPage) => firstPage.previousSkip ?? undefined,
        getNextPageParam: (lastPage, groups) => lastPage.nextSkip,
        enabled: !!businessUnitList[0]?.id,
    });

    const allRows = useMemo(() => {
        return data ? data.pages.flatMap((d) => d.data) : [];
    }, [data]);

    const rowVirtualizer = useVirtualizer({
        count: hasNextPage ? allRows.length + 1 : allRows.length,
        getScrollElement: () => parentRef.current,
        estimateSize: () => 100,
        overscan: 5,
    });
    const [lastItem] = [...rowVirtualizer.getVirtualItems()].reverse();
    const lastRow = useMemo(() => lastItem, [lastItem]);

    useEffect(() => {
        if (onBoarding && allRows.length >= 1 && !isFetching) {
            dispatch(resetMessageTemplate());
            dispatch(resetSelectWhatsAppMessage());
            dispatch(selectConversation(allRows[0]._id));
            dispatch(clearShowLatestUnreadMsg());
            dispatch(replace(`/chatroom?conv_id=${allRows[0]._id}`));
        }
    }, [onBoarding, allRows, dispatch, isFetching]);

    useEffect(() => {
        if (!lastRow) {
            return;
        }

        if (lastRow.index >= allRows.length - 1 && hasNextPage && !isFetchingNextPage) {
            fetchNextPage();
        }
    }, [hasNextPage, fetchNextPage, allRows.length, isFetchingNextPage, lastRow]);

    const refreshing = (isFetching || isRefetching) && !isFetchingNextPage;

    return (
        <>
            {(!isError || refreshing) && (
                <div className={styles.conversationListContainer}>
                    <SimpleBar className={styles.listContainer} scrollableNodeProps={{ ref: parentRef }} autoHide>
                        <div
                            className={refreshing ? styles.blur : ''}
                            style={{
                                height: `${rowVirtualizer.getTotalSize()}px`,
                                width: '100%',
                                position: 'relative',
                            }}
                        >
                            {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                                const isLoaderRow = virtualRow.index > allRows.length - 1;
                                if (isLoaderRow) {
                                    return (
                                        <div
                                            key={virtualRow.index}
                                            style={{
                                                position: 'absolute',
                                                top: 0,
                                                left: 0,
                                                width: '100%',
                                                height: `${virtualRow.size}px`,
                                                transform: `translateY(${virtualRow.start}px)`,
                                            }}
                                        >
                                            {hasNextPage ? (
                                                <div className={styles.loading} style={{ marginTop: 20 }}>
                                                    <CircularProgress size={25} />
                                                </div>
                                            ) : null}
                                        </div>
                                    );
                                }
                                const {
                                    id,
                                    conversation_id,
                                    name,
                                    status,
                                    timestamp,
                                    channel_type,
                                    team_name,
                                    is_agent_joined,
                                    is_joined,
                                    is_presence,
                                    latest_message,
                                    contact,
                                } = allRows[virtualRow.index];

                                return (
                                    <div
                                        key={virtualRow.index}
                                        style={{
                                            position: 'absolute',
                                            top: 0,
                                            left: 0,
                                            width: '100%',
                                            height: `${virtualRow.size}px`,
                                            transform: `translateY(${virtualRow.start}px)`,
                                        }}
                                    >
                                        <Conversation
                                            key={id}
                                            id={id}
                                            conversationId={conversation_id}
                                            name={name}
                                            status={status}
                                            timestamp={timestamp}
                                            channelType={channel_type}
                                            teamName={team_name}
                                            isAgentJoined={is_agent_joined}
                                            isJoined={is_joined}
                                            onClick={() => {
                                                dispatch(resetMessageTemplate());
                                                dispatch(resetSelectWhatsAppMessage());
                                                dispatch(selectConversation(id));
                                                dispatch(clearShowLatestUnreadMsg());
                                                dispatch(push(`/chatroom?conv_id=${id}`));
                                            }}
                                            isPresence={is_presence}
                                            latestMessage={latest_message}
                                            contact={contact}
                                        />
                                    </div>
                                );
                            })}
                        </div>
                    </SimpleBar>
                    {refreshing && (
                        <div className={styles.loadingContainer}>
                            <CircularProgress size={25} />
                        </div>
                    )}
                </div>
            )}
            {isError && !refreshing && (
                <div className={styles.errorContainer}>
                    <Space direction="vertical" justify="center">
                        <Typography variant="Caption">{t('error_something_went_wrong')}</Typography>
                        <IconButton type="secondary" variant="text" size="s" onClick={() => refetch()}>
                            <AutorenewIcon />
                        </IconButton>
                    </Space>
                </div>
            )}
        </>
    );
};

export default ConversationList;
