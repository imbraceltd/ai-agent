import { EllipsisText, Icon, Space, Typography } from '@imbrace/ui';
import { Divider, ListItem, ListItemAvatar, ListItemButton, ListItemText, Popover } from '@mui/material';
import { useEffect, useState } from 'react';
import Scrollbars from 'react-custom-scrollbars';
import { Trans, useTranslation } from 'react-i18next';
import ArrowBackIosNewIcon from '@mui/icons-material/ArrowBackIosNew';
import { getCookie } from 'typescript-cookie';

import { CONVERSATION_MEMBER_ROLE, GENERAL_ACCOUNT, TEAM_ROLE, USER_ROLE } from '@/constants/account';
import Avatar from '@/components/Avatar';
import { dialog } from '@/components/Dialog';
import apiFetch from '@/services/axios/handler';
import { removeUserFromConversation } from '@/services/api/teamConversation';
import { useAppDispatch, useAppSelector } from '@/redux/store';
import { fetchTeamConversationByIdThunk } from '@/redux/slices/teamConversation';

import styles from './index.module.scss';

const UserItem = ({ user, conversationId, teamConvId }: { user: API.SimpleUser; conversationId?: string; teamConvId?: string }) => {
    const { t } = useTranslation();
    const [extraContainerWidth, setExtraContainerWidth] = useState(0);
    const [extraAnchorEl, setExtraAnchorEl] = useState<HTMLElement | null>(null);
    const [isSelected, setIsSelected] = useState(false);
    const account = useAppSelector((state) => state.Account);
    const [isAllowRemove, setIsAllowedRemove] = useState(false);
    const userId = getCookie('user_id') || '';

    useEffect(() => {
        const getIsAllowRemove = () => {
            if (user.id === userId) return false;
            const orgAdmins = [USER_ROLE.OWNER, USER_ROLE.ADMIN];
            const isUser = user.teams?.every((item) => item.team_user_role === TEAM_ROLE.USER) || false;
            if (orgAdmins.includes(account?.role || '')) {
                return isUser;
            } else {
                if (!isUser) return false;
                const teamAdminIds = account.team_roles?.filter((item) => item.role === TEAM_ROLE.ADMIN).map((item) => item.team_id);
                const team_user_id = user.teams?.find((item) => item.team_user_role === TEAM_ROLE.USER)?.team_id || '';
                const isUserBelongTeam = teamAdminIds.includes(team_user_id);
                return isUserBelongTeam;
            }
        };
        setIsAllowedRemove(getIsAllowRemove());
    }, [account, user]);

    const extraOpen = Boolean(extraAnchorEl);
    let isMultiRole = false;
    const dispatch = useAppDispatch();

    const onRemoveUser = async () => {
        try {
            await apiFetch(removeUserFromConversation.api(), removeUserFromConversation.method, {
                conversation_id: conversationId,
                team_id: user.teams?.find((item) => item.team_user_role === 'member')?.team_id || '',
                user_id: user.id,
            });

            await dispatch(fetchTeamConversationByIdThunk(teamConvId || '')).unwrap();
        } catch (error) {
            console.log('delete user error: ', error);
        }
    };

    const handleDeleteNotify = () => {
        dialog({
            title: t('conversation_remove_member_from_group_confirm'),
            content: <Trans i18nKey="conversation_remove_member_from_group_confirm_desc" t={t} />,
            confirmText: t('dialog_delete'),
            confirmButtonProps: {
                type: 'danger',
            },
            actionsAlign: 'flex-end',
            onConfirm: async () => {
                onRemoveUser();
            },
            onClose: () => {},
        });
    };

    const getConvMemberRole = () => {
        const userTeams = user.teams;
        const isExistedAdmin = userTeams?.some((item) => item.team_user_role === 'admin');
        const isOnlyAdmin = userTeams?.every((team) => team.team_user_role === 'admin');
        if (isExistedAdmin && !isOnlyAdmin) {
            isMultiRole = true;
        }
        return isExistedAdmin
            ? isOnlyAdmin
                ? CONVERSATION_MEMBER_ROLE.ADMIN
                : userTeams
                      ?.map((team) => {
                          return team.team_user_role === 'admin' ? CONVERSATION_MEMBER_ROLE.ADMIN : CONVERSATION_MEMBER_ROLE.USER;
                      })
                      .join(', ')
            : CONVERSATION_MEMBER_ROLE.USER;
    };

    return (
        <ListItem sx={{ padding: '6px 16px' }}>
            <ListItemAvatar sx={{ minWidth: 47 }}>
                <Avatar width="35px" height="35px" isActive={true} avatarUrl={user.avatar_url} displayName={user.display_name} />
            </ListItemAvatar>
            <ListItemText
                {...{
                    secondary: (
                        <Typography
                            variant="Caption"
                            style={{
                                color: 'var(--color-light-5)',
                                textOverflow: 'ellipsis',
                                overflow: 'hidden',
                                whiteSpace: 'nowrap',
                            }}
                            ref={(ref) => {
                                if (ref && extraContainerWidth !== ref.getBoundingClientRect().width) {
                                    setExtraContainerWidth(ref.getBoundingClientRect().width);
                                }
                            }}
                            onMouseEnter={(e) => {
                                setExtraAnchorEl(e.currentTarget);
                                setIsSelected(true);
                            }}
                        >
                            {getConvMemberRole()}
                        </Typography>
                    ),
                }}
            >
                <EllipsisText tooltipPlacement="top" element={<Typography />} text={user.display_name} />
                <ArrowBackIosNewIcon
                    sx={{
                        position: 'absolute',
                        right: '10px',
                        top: '22px',
                        height: '12px',
                        color: isSelected ? '#156DF2' : '#828282',
                        transform: 'rotate(180deg)',
                    }}
                />
            </ListItemText>
            <Popover
                open={extraOpen}
                anchorEl={extraAnchorEl}
                onClose={() => {
                    setExtraAnchorEl(null);
                    setIsSelected(false);
                }}
                anchorOrigin={{
                    vertical: 'center',
                    horizontal: 'left',
                }}
                transformOrigin={{
                    vertical: 12,
                    horizontal: 0,
                }}
                slotProps={{
                    paper: {
                        sx: {
                            width: extraContainerWidth + 30 || '220px',
                            overflow: 'hidden',
                            padding: '8px',
                            marginTop: '4px',
                            boxShadow: '0px 16px 24px 0px rgba(224, 224, 224, 0.20), 0px 0px 4px 0px rgba(224, 224, 224, 0.88)',
                        },
                        onMouseLeave: () => {
                            setExtraAnchorEl(null);
                            setIsSelected(false);
                        },
                    },
                }}
            >
                <Space direction="vertical" align="start" size={8}>
                    <Scrollbars autoHeight autoHide autoHeightMax={68}>
                        <Space
                            size={4}
                            wrap
                            align="start"
                            style={{
                                width: '100%',
                                overflow: 'hidden',
                            }}
                        >
                            {user.teams?.map((team) => (
                                <div key={team.team_id} className={styles.teamTag}>
                                    <EllipsisText
                                        element={<Typography variant="Caption" style={{ color: 'var(--color-light-5)' }} />}
                                        text={team.team_name}
                                    />{' '}
                                    {isMultiRole && (
                                        <EllipsisText
                                            element={<Typography variant="Caption" style={{ color: 'var(--color-light-5)' }} />}
                                            text={
                                                team.team_user_role === 'admin'
                                                    ? CONVERSATION_MEMBER_ROLE.ADMIN
                                                    : CONVERSATION_MEMBER_ROLE.USER
                                            }
                                        />
                                    )}
                                </div>
                            ))}
                        </Space>
                    </Scrollbars>
                    {user.assign_from_name && (
                        <Space direction="vertical" align="start" size={0}>
                            <Typography variant="Caption" style={{ color: 'var(--color-light-5)' }}>
                                {t('first_invited_by')}
                            </Typography>
                            <Typography variant="Caption">{user.assign_from_name}</Typography>
                        </Space>
                    )}
                    {isAllowRemove && (
                        <>
                            <Divider flexItem />
                            <ListItemButton
                                onClick={() => {
                                    setIsSelected(true);
                                    handleDeleteNotify();
                                }}
                                sx={{
                                    color: 'var(--color-primary-1)',
                                    padding: '1px 0',
                                    width: '100%',
                                }}
                            >
                                <Space>
                                    <Typography style={{ color: '#E53C3C', marginRight: '10px' }}>
                                        {t('conversation_remove_member_from_group')}
                                    </Typography>
                                    <Icon name="delete" style={{ fontSize: 24, color: '#E53C3C' }} />
                                </Space>
                            </ListItemButton>
                        </>
                    )}
                </Space>
            </Popover>
        </ListItem>
    );
};

export default UserItem;
