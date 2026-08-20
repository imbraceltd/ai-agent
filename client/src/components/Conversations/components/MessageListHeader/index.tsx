import { CopyButton, EllipsisText, Icon, IconButton, Space, Tooltip, Typography } from '@imbrace/ui';
import { Groups as GroupsIcon, MeetingRoom as MeetingRoomIcon } from '@mui/icons-material';
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded';
import { IconButton as MuiIconButton, List, ListItemButton, Popover } from '@mui/material';
import Divider from '@mui/material/Divider';
import isEmpty from 'lodash/isEmpty';
import type { FC } from 'react';
import { useCallback, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';

import Avatar from '@/components/Avatar';
import { env } from '@/env';
import { leaveTeamConversationThunk, updateStatusThunk } from '@/redux/slices/teamConversation';
import { useAppDispatch, useAppSelector } from '@/redux/store';

import { openInviteUserModal } from '../InviteUserModal';
import styles from './index.module.scss';
import UserItem from './userItem';
import { resetMessageTemplate } from '@/redux/slices/messageTemplates';

interface MessageListHeaderProps {
    setCurrentDrawer: (value: string) => void;
    viewMode?: boolean;
    teamConvId?: string;
}

const envMapping = {
    local: 'dev',
    dev: 'dev',
    staging: 'stg',
    demo: 'demo',
};

const MessageListHeader: FC<MessageListHeaderProps> = (props) => {
    const { setCurrentDrawer, viewMode = false } = props;
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const teamConversation = useAppSelector((state) => state.TeamConversation.teamConversation);
    const contact = useAppSelector((state) => state.Contact.contact);
    const status = useAppSelector((state) => state.TeamConversation.teamConversation?.status);
    const id = useAppSelector((state) => state.TeamConversation.teamConversation?.id);

    const [anchorEl, setAnchorEl] = useState<HTMLDivElement | null>();
    const open = Boolean(anchorEl);

    const handleUpdateStatus = useCallback(
        (convId: string | undefined, newStatus: 'active' | 'closed') => {
            if (status === newStatus) {
                return;
            }
            if (convId) {
                dispatch(updateStatusThunk({ id: convId, status: newStatus }));
            }
        },
        [dispatch, status],
    );

    const handleClose = () => {
        setAnchorEl(null);
    };

    const openInviteDialog = (teamConversationId: string, conversationId: string, teamId: string) => {
        setAnchorEl(null);
        openInviteUserModal({
            teamConversationId,
            conversationId,
            teamId,
        });
    };

    const joinedUser = useMemo(
        () =>
            teamConversation?.users?.filter((user) => {
                return !user?.is_bot;
            }) || [],
        [teamConversation?.users],
    );

    const conversationLink = (conversationId: string) => {
        let domain = 'imbrace.co';
        if (env.VITE_APP_ENV === 'prod') {
            domain = `app.${domain}`;
        } else {
            domain = `webapp.${envMapping[env.VITE_APP_ENV]}.${domain}`;
        }
        return `${domain}/chatroom?to_conv=${conversationId}`;
    };

    return (
        <div className={styles.messageListHeaderRoot}>
            {!isEmpty(teamConversation) ? (
                <Space size={10} style={{ width: '100%', flex: 1 }}>
                    <div className={styles.header}>
                        <div className={styles.channelIconContainer}>
                            {contact && (
                                <Avatar
                                    avatarUrl={contact.avatar_url}
                                    displayName={contact?.display_name}
                                    firstName={contact?.first_name}
                                    lastName={contact?.last_name}
                                    width={50}
                                    height={50}
                                    fontSize={20}
                                    isActive
                                />
                            )}
                        </div>
                        <div className={styles.titleContainer} style={{ maxWidth: viewMode ? '100%' : '' }}>
                            <Space
                                size={12}
                                justify="stretch"
                                style={{
                                    marginBottom:
                                        teamConversation?.channel_type === 'web' || teamConversation?.channel_type === 'email'
                                            ? '4px'
                                            : '0px',
                                }}
                            >
                                <Space size={8} justify="stretch" style={{ overflow: 'hidden' }}>
                                    <EllipsisText
                                        text={teamConversation?.name || ''}
                                        className={styles.conversationNameContainer}
                                        element={
                                            <Typography
                                                variant="Heading2"
                                                style={{
                                                    overflow: 'hidden',
                                                    textOverflow: 'ellipsis',
                                                    color: 'var(--color-light-7)',
                                                    display: 'block',
                                                }}
                                            />
                                        }
                                    />
                                    <Divider flexItem orientation="vertical" sx={{ borderColor: 'var(--color-light-5)' }} />
                                    <Space align="center" className={styles.conversationIdContainer}>
                                        <Typography
                                            variant="Heading2"
                                            style={{
                                                color: 'var(--color-light-5)',
                                                textOverflow: 'ellipsis',
                                                whiteSpace: 'nowrap',
                                                overflow: 'hidden',
                                            }}
                                        >
                                            {teamConversation.conversation_id}
                                        </Typography>
                                        <div className={styles.mask} />
                                        <Space size={12} className={styles.copyContainer} align="center" justify="center">
                                            <Tooltip title={t('copy_conversation_id')} placement="bottom" arrow>
                                                <div>
                                                    <CopyButton
                                                        copyValue={teamConversation.conversation_id}
                                                        iconOnly
                                                        buttonSx={{
                                                            maxWidth: '32px',
                                                            minWidth: 'auto',
                                                            '& svg': {
                                                                fontSize: 24,
                                                            },
                                                            padding: '0 4px',
                                                        }}
                                                    />
                                                </div>
                                            </Tooltip>
                                            <Tooltip title={t('share_conversation_link')} placement="bottom" arrow>
                                                <div>
                                                    <CopyButton
                                                        copyValue={conversationLink(teamConversation.conversation_id)}
                                                        iconOnly
                                                        copyIcon={<Icon name="linkSide" />}
                                                        buttonSx={{
                                                            maxWidth: '32px',
                                                            minWidth: 'auto',
                                                            '& svg': {
                                                                fontSize: 24,
                                                            },
                                                            padding: '0 4px',
                                                        }}
                                                    />
                                                </div>
                                            </Tooltip>
                                        </Space>
                                    </Space>
                                </Space>

                                {!viewMode && (
                                    <Tooltip title={t('messagelist-input-user')} placement="bottom" arrow>
                                        <IconButton
                                            size="s"
                                            sx={{ color: 'var(--color-light-4)' }}
                                            onClick={() => {
                                                setCurrentDrawer('contact');
                                            }}
                                            type="secondary"
                                            variant="text"
                                        >
                                            <Icon name="contactPage" style={{ fontSize: 24 }} />
                                        </IconButton>
                                    </Tooltip>
                                )}
                            </Space>
                            {teamConversation?.channel_type === 'email' && (
                                <Typography variant="Caption">{`<${teamConversation?.contact?.email}>`}</Typography>
                            )}
                        </div>
                    </div>

                    <div className={styles.extra}>
                        <div>
                            <Typography variant="Caption" style={{ color: 'var(--color-light-5)' }}>
                                {teamConversation?.contact?.time_zone}
                            </Typography>
                        </div>
                        <Divider
                            sx={{ height: 24, borderColor: '#e0e0e0', alignSelf: 'center' }}
                            orientation="vertical"
                            variant="middle"
                            flexItem
                        />
                        <div style={{ position: 'relative' }}>
                            <Tooltip title={t('conversation_agent_count')} placement="bottom" arrow>
                                <div
                                    className={styles.groups}
                                    onClick={(event) => {
                                        setAnchorEl(event.currentTarget);
                                    }}
                                >
                                    <GroupsIcon sx={{ height: '24px', width: '24px', color: 'var(--color-light-5)' }} />
                                    <Typography style={{ color: 'var(--color-light-5)', margin: '3px 0px 0px 5px' }}>
                                        {joinedUser.length | 0}
                                    </Typography>
                                </div>
                            </Tooltip>

                            <Popover
                                open={open}
                                anchorEl={anchorEl}
                                anchorOrigin={{
                                    vertical: 'bottom',
                                    horizontal: 'center',
                                }}
                                transformOrigin={{
                                    vertical: 'top',
                                    horizontal: 'center',
                                }}
                                slotProps={{
                                    paper: {
                                        sx: {
                                            width: 264,
                                            marginTop: '10px',
                                            padding: '8px 0',
                                            borderRadius: '4px',
                                            boxShadow: '0px 2px 24px 0px #E0E0E033, 0px 4px 8px 0px #BDBDBD14',
                                        },
                                    },
                                }}
                                onClose={handleClose}
                            >
                                <List sx={{ padding: 0 }}>
                                    {joinedUser.length === 0 && (
                                        <div style={{ padding: '10px 12px' }}>
                                            <Typography style={{ color: 'var(--color-light-5)' }}>{t('no_member_in_chatroom')}</Typography>
                                        </div>
                                    )}
                                    {joinedUser.map((user) => (
                                        <UserItem
                                            key={user.id}
                                            user={user}
                                            conversationId={teamConversation.conversation_id}
                                            teamConvId={props.teamConvId}
                                        />
                                    ))}
                                    <Divider flexItem />

                                    <ListItemButton
                                        onClick={() => {
                                            openInviteDialog(
                                                teamConversation.id,
                                                teamConversation.conversation_id,
                                                teamConversation.team_id,
                                            );
                                        }}
                                        sx={{
                                            color: 'var(--color-primary-1)',
                                            padding: '8px 12px',
                                        }}
                                    >
                                        <Space size={12}>
                                            <Icon name="add" style={{ fontSize: 24 }} />
                                            <Typography>{t('invite')}</Typography>
                                        </Space>
                                    </ListItemButton>
                                </List>
                            </Popover>
                        </div>

                        {/* Agent leave ChatRoom */}
                        {teamConversation?.is_joined && !viewMode && (
                            <>
                                <Divider
                                    sx={{ height: 24, borderColor: '#e0e0e0', alignSelf: 'center' }}
                                    orientation="vertical"
                                    variant="middle"
                                    flexItem
                                />

                                {
                                    // TODO: close ui
                                    /* <StyledSelect
                                    value={status}
                                    status={status}
                                    className={styles.conversationItemInfoSelect}
                                    sx={{
                                        fontSize: '0.875rem',
                                        width: 110,
                                        margin: 0,
                                        padding: '6px 7px 6px 11px',
                                    }}
                                    onClick={(event: MouseEvent<HTMLElement>) => event.stopPropagation()}
                                >
                                    <StyledMenuItem status={'active'} value={'active'} onClick={() => handleUpdateStatus(id, 'active')}>
                                        {t('conversation_room_active')}
                                    </StyledMenuItem>
                                    <StyledMenuItem status={'closed'} value={'closed'} onClick={() => handleUpdateStatus(id, 'closed')}>
                                        {t('conversation_room_closed')}
                                    </StyledMenuItem>
                                    <StyledMenuItem status={'spam'} value={'spam'} onClick={() => handleUpdateStatus(id, 'spam')}>
                                        {t('conversation_room_spam')}
                                    </StyledMenuItem>
                                </StyledSelect> */
                                }
                                {status !== 'closed' && (
                                    <MuiIconButton sx={{ padding: 0 }} disableRipple onClick={() => handleUpdateStatus(id, 'closed')}>
                                        <CheckCircleRoundedIcon sx={{ height: '21px', width: '21px' }} />
                                        <Typography style={{ marginLeft: '6px' }}>{t('conversation_close')}</Typography>
                                    </MuiIconButton>
                                )}

                                <div className={styles.contactDrawerTrigger}>
                                    <MuiIconButton
                                        sx={{ padding: 0 }}
                                        disableRipple
                                        onClick={() => {
                                            dispatch(
                                                leaveTeamConversationThunk({
                                                    teamConvId: teamConversation?.id,
                                                }),
                                            );
                                            dispatch(resetMessageTemplate());
                                        }}
                                        disabled={viewMode}
                                    >
                                        <MeetingRoomIcon sx={{ height: '21px', width: '21px', color: '#3399fc' }} />
                                        <Typography style={{ color: '#3399fc', marginLeft: '6px' }}>
                                            {t('conversation_room_leave')}
                                        </Typography>
                                    </MuiIconButton>
                                </div>
                            </>
                        )}
                    </div>
                </Space>
            ) : null}
        </div>
    );
};

export default MessageListHeader;
