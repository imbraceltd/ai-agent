import 'simplebar-react/dist/simplebar.min.css';

import { EllipsisText, Tooltip } from '@imbrace/ui';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import ArrowDropDownIcon from '@mui/icons-material/ArrowDropDown';
import ArrowDropUpIcon from '@mui/icons-material/ArrowDropUp';
import type { CSSObject, Theme } from '@mui/material';
import { Collapse, List, styled } from '@mui/material';
import MuiDrawer from '@mui/material/Drawer';
import { type QueryFunction, useQuery } from '@tanstack/react-query';
import type { FC } from 'react';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import SimpleBar from 'simplebar-react';

import ChildListItemText from '@/components/Conversation/ChildListItemText';
import CountText from '@/components/Conversation/CountText';
import HeaderListItemText from '@/components/Conversation/HeaderListItemText';
import ListItemButton from '@/components/Conversation/ListItemButton';
import SideBar from '@/components/SideBar';
import StatusDot from '@/components/StatusDot';
import { updateViewFilter } from '@/redux/slices/teamConversation';
import { useAppDispatch, useAppSelector } from '@/redux/store';
import { getTeamConversationViewsCount } from '@/services/api/teamConversation';
import apiFetch from '@/services/axios/handler';

import styles from './index.module.scss';

interface ConversationSideBarProps {
    sideBarDrawerOpen: boolean;
    setSideBarDrawerOpen: (value: boolean) => void;
}
const openedMixin = (theme: Theme): CSSObject => ({
    width: 270,
    transition: theme.transitions.create('width', {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.enteringScreen,
    }),
    overflowX: 'hidden',
});

const closedMixin = (theme: Theme): CSSObject => ({
    transition: theme.transitions.create('width', {
        easing: theme.transitions.easing.sharp,
        duration: theme.transitions.duration.leavingScreen,
    }),
    overflowX: 'hidden',
    width: 0,
});

const Drawer = styled(MuiDrawer, { shouldForwardProp: (prop) => prop !== 'open' })(({ theme, open }) => ({
    flexShrink: 0,
    whiteSpace: 'nowrap',
    boxSizing: 'border-box',
    ...(open && {
        ...openedMixin(theme),
    }),
    ...(!open && {
        ...closedMixin(theme),
    }),
}));

const handleFetchViewCount: QueryFunction<API.TeamConversationViewCount, ['viewsCount', string | undefined]> = async ({ queryKey }) => {
    const [, businessId] = queryKey;

    if (!businessId) {
        throw new Error('missing business id');
    }
    const { data } = await apiFetch<API.TeamConversationViewCount>(
        getTeamConversationViewsCount.api(businessId),
        getTeamConversationViewsCount.method,
    );
    return data;
};

const ConversationSideBar: FC<ConversationSideBarProps> = (props) => {
    const { sideBarDrawerOpen, setSideBarDrawerOpen } = props;
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const business = useAppSelector((state) => state.BusinessUnit.businessUnitList);
    const viewFilterTeamId = useAppSelector((state) => state.TeamConversation.viewFilterTeamId);
    const viewFilter = useAppSelector((state) => state.TeamConversation.viewFilter);
    const team_roles = useAppSelector((state) => state.Account.team_roles);
    const [isStatusBarOpen, setIsStatusBarOpen] = useState(true);
    const [isViewBarOpen, setIsViewBarOpen] = useState(true);
    const [isTeamsBarOpen, setIsTeamsBarOpen] = useState(true);

    const { data } = useQuery({
        queryKey: ['viewsCount', business?.[0]?.id],
        queryFn: handleFetchViewCount,
    });

    return (
        <>
            <Drawer
                variant="permanent"
                open={sideBarDrawerOpen}
                PaperProps={{
                    sx: {
                        position: 'relative',
                        border: 'none',
                    },
                }}
            >
                <SimpleBar autoHide style={{ maxHeight: '100%' }}>
                    <SideBar title={t('conversation_heading')} withBorder={false}>
                        {/* Views */}
                        <List dense={true} sx={{ padding: 0 }}>
                            <ListItemButton onClick={() => setIsViewBarOpen((prevState) => !prevState)} sx={{ paddingRight: '10px' }}>
                                <HeaderListItemText>{t('conversation_views')}</HeaderListItemText>
                                {isViewBarOpen ? (
                                    <ArrowDropUpIcon sx={{ color: 'var(--color-light-5)' }} />
                                ) : (
                                    <ArrowDropDownIcon sx={{ color: 'var(--color-light-5)' }} />
                                )}
                            </ListItemButton>
                            <Collapse in={isViewBarOpen} timeout="auto" unmountOnExit>
                                <List dense={true} sx={{ padding: 0 }} className={styles.conversationStatusNav}>
                                    <ListItemButton
                                        onClick={() => dispatch(updateViewFilter({ view: 'all' }))}
                                        isActive={viewFilter === 'all'}
                                        sx={{ paddingRight: '41px' }}
                                    >
                                        <ChildListItemText>{t('conversation_views_all')}</ChildListItemText>
                                        <CountText variant="body1" align="left">
                                            {data?.all || 0}
                                        </CountText>
                                    </ListItemButton>

                                    <ListItemButton
                                        onClick={() => dispatch(updateViewFilter({ view: 'yours' }))}
                                        isActive={viewFilter === 'yours'}
                                        sx={{ paddingRight: '41px' }}
                                    >
                                        <ChildListItemText>{t('conversation_views_joined')}</ChildListItemText>
                                        <CountText variant="body1">{data?.yours || 0}</CountText>
                                    </ListItemButton>

                                    {/* <ListItemButton className={styles.conversationAddNewViewButton} sx={{ gap: '7px' }}>
                                        <AddIcon />
                                        <Typography variant="body2">Add New Views</Typography>
                                    </ListItemButton> */}
                                </List>
                            </Collapse>
                        </List>
                        {/* Teams */}
                        <List dense={true} sx={{ padding: 0, mt: '95px' }}>
                            <ListItemButton onClick={() => setIsTeamsBarOpen((prevState) => !prevState)} sx={{ paddingRight: '10px' }}>
                                <HeaderListItemText>{t('conversation_teams')}</HeaderListItemText>
                                {isTeamsBarOpen ? (
                                    <ArrowDropUpIcon sx={{ color: 'var(--color-light-5)' }} />
                                ) : (
                                    <ArrowDropDownIcon sx={{ color: 'var(--color-light-5)' }} />
                                )}
                            </ListItemButton>
                            <Collapse in={isTeamsBarOpen} timeout="auto" unmountOnExit>
                                <List dense={true} sx={{ padding: 0 }} className={styles.conversationStatusNav}>
                                    {Object.keys(data || {}).map((teamId: string) => {
                                        const existTeamRole = team_roles.find((teamRole: API.TeamRole) => teamRole.team_id === teamId);
                                        if (existTeamRole) {
                                            return (
                                                <ListItemButton
                                                    key={teamId}
                                                    onClick={() => dispatch(updateViewFilter({ view: 'team', teamId }))}
                                                    isActive={viewFilter === 'team' && viewFilterTeamId === teamId}
                                                    sx={{ paddingRight: '41px' }}
                                                >
                                                    <ChildListItemText>
                                                        <EllipsisText text={existTeamRole.team?.name} />
                                                    </ChildListItemText>
                                                    <CountText variant="body1" align="left">
                                                        {data?.[teamId] ? data[teamId] : 0}
                                                    </CountText>
                                                </ListItemButton>
                                            );
                                        }
                                        return null;
                                    })}
                                </List>
                            </Collapse>
                        </List>
                        {/* Status */}
                        <List dense={true} sx={{ padding: 0, mt: '95px' }}>
                            <ListItemButton onClick={() => setIsStatusBarOpen((prevState) => !prevState)} sx={{ paddingRight: '10px' }}>
                                <HeaderListItemText>{t('conversation_status')}</HeaderListItemText>
                                {isStatusBarOpen ? (
                                    <ArrowDropUpIcon sx={{ color: 'var(--color-light-5)' }} />
                                ) : (
                                    <ArrowDropDownIcon sx={{ color: 'var(--color-light-5)' }} />
                                )}
                            </ListItemButton>
                            <Collapse in={isStatusBarOpen} timeout="auto" unmountOnExit>
                                <List dense={true} sx={{ padding: 0 }} className={styles.conversationStatusNav}>
                                    {/* <ListItemButton //TODO: UNSUPPORTED FEATURES IN PHASE 1 RELEASE
                                    onClick={() => dispatch(updateRoomStatusFilterThunk('agent_needed'))}
                                >
                                    <ChildListItemText isStatus statusType={'agent_needed'}>
                                        Agent Needed
                                    </ChildListItemText>
                                    <CountText variant="body1">???</CountText>
                                </ListItemButton>
                                <ListItemButton onClick={() => dispatch(updateRoomStatusFilterThunk('active'))}>
                                    <ChildListItemText isStatus statusType={'active'}>
                                        Active
                                    </ChildListItemText>
                                    <CountText variant="body1">{room.activeRoomCount}</CountText>
                                </ListItemButton>*/}
                                    {/* <ListItemButton
                                        isActive={viewFilter === 'spam'}
                                        onClick={() => dispatch(updateViewFilter({ view: 'spam' }))}
                                        sx={{ paddingRight: '41px' }}
                                    >
                                        <ChildListItemText isStatus statusType={'spam'}>
                                            {t('conversation_status_spam')}
                                        </ChildListItemText>
                                        <CountText variant="body1">{data?.spam || 0}</CountText>
                                    </ListItemButton> */}
                                    <Tooltip
                                        disableFocusListener
                                        disableTouchListener
                                        disableInteractive
                                        placement="right"
                                        arrow
                                        enterDelay={500}
                                        enterNextDelay={500}
                                        title={t('conversation_status_online_tooltip')}
                                    >
                                        <ListItemButton
                                            isActive={viewFilter === 'online'}
                                            onClick={() => dispatch(updateViewFilter({ view: 'online' }))}
                                            sx={{ paddingRight: '41px' }}
                                        >
                                            <ChildListItemText isStatus statusType={'online'}>
                                                {t('conversation_status_online')}
                                            </ChildListItemText>
                                            <CountText variant="body1">{data?.online || 0}</CountText>
                                        </ListItemButton>
                                    </Tooltip>
                                    <Tooltip
                                        disableFocusListener
                                        disableTouchListener
                                        disableInteractive
                                        placement="right"
                                        arrow
                                        enterDelay={500}
                                        enterNextDelay={500}
                                        title={t('conversation_status_overdue_tooltip')}
                                    >
                                        <ListItemButton
                                            isActive={viewFilter === 'overdue'}
                                            onClick={() => dispatch(updateViewFilter({ view: 'overdue' }))}
                                            sx={{ paddingRight: '41px', minHeight: 35 }}
                                        >
                                            <StatusDot text={t('conversation_status_overdue')} statusType={'overdue'} isFormBar />
                                            <CountText variant="body1">{data?.overdue || 0}</CountText>
                                        </ListItemButton>
                                    </Tooltip>
                                    <Tooltip
                                        disableFocusListener
                                        disableTouchListener
                                        disableInteractive
                                        placement="right"
                                        arrow
                                        enterDelay={500}
                                        enterNextDelay={500}
                                        title={t('conversation_status_soon_to_be_tooltip')}
                                    >
                                        <ListItemButton
                                            isActive={viewFilter === 'soon to be'}
                                            onClick={() => dispatch(updateViewFilter({ view: 'soon to be' }))}
                                            sx={{ paddingRight: '41px', minHeight: 35 }}
                                        >
                                            <StatusDot text={t('conversation_status_soon_to_be')} statusType={'soon to be'} isFormBar />
                                            <CountText variant="body1">{data?.soon_to_be || 0}</CountText>
                                        </ListItemButton>
                                    </Tooltip>
                                    <Tooltip
                                        disableFocusListener
                                        disableTouchListener
                                        disableInteractive
                                        placement="right"
                                        arrow
                                        enterDelay={500}
                                        enterNextDelay={500}
                                        title={t('conversation_status_rep_needed_tooltip')}
                                    >
                                        <ListItemButton
                                            isActive={viewFilter === 'rep needed'}
                                            onClick={() => dispatch(updateViewFilter({ view: 'rep needed' }))}
                                            sx={{ paddingRight: '41px', minHeight: 35 }}
                                        >
                                            <StatusDot text={t('conversation_status_rep_needed')} statusType={'rep needed'} isFormBar />
                                            <CountText variant="body1">{data?.rep_needed || 0}</CountText>
                                        </ListItemButton>
                                    </Tooltip>
                                    <Tooltip
                                        disableFocusListener
                                        disableTouchListener
                                        disableInteractive
                                        placement="right"
                                        arrow
                                        enterDelay={500}
                                        enterNextDelay={500}
                                        title={t('conversation_status_pending_tooltip')}
                                    >
                                        <ListItemButton
                                            isActive={viewFilter === 'pending'}
                                            onClick={() => dispatch(updateViewFilter({ view: 'pending' }))}
                                            sx={{ paddingRight: '41px', minHeight: 35 }}
                                        >
                                            <StatusDot text={t('conversation_status_pending')} statusType={'pending'} isFormBar />
                                            <CountText variant="body1">{data?.pending || 0}</CountText>
                                        </ListItemButton>
                                    </Tooltip>
                                    <Tooltip
                                        disableFocusListener
                                        disableTouchListener
                                        disableInteractive
                                        placement="right"
                                        arrow
                                        enterDelay={500}
                                        enterNextDelay={500}
                                        title={t('conversation_status_closed_tooltip')}
                                    >
                                        <ListItemButton
                                            isActive={viewFilter === 'closed'}
                                            onClick={() => dispatch(updateViewFilter({ view: 'closed' }))}
                                            sx={{ paddingRight: '41px', minHeight: 35 }}
                                        >
                                            <StatusDot text={t('conversation_status_closed')} statusType={'closed'} isFormBar />
                                            <CountText variant="body1">{data?.closed || 0}</CountText>
                                        </ListItemButton>
                                    </Tooltip>
                                </List>
                            </Collapse>
                        </List>
                    </SideBar>
                </SimpleBar>
            </Drawer>
            <div className={styles.listIcon} onClick={() => setSideBarDrawerOpen(!sideBarDrawerOpen)}>
                {sideBarDrawerOpen ? (
                    <ArrowBackIosNewIcon sx={{ width: 18, color: '#0000008a' }} />
                ) : (
                    <ArrowBackIosNewIcon sx={{ width: 18, color: '#0000008a', transform: 'rotate(180deg)' }} />
                )}
            </div>
        </>
    );
};

export default ConversationSideBar;
