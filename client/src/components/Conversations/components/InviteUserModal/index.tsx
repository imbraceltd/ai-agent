import type { Option } from '@imbrace/ui';
import { Button, FieldSelect, Icon, IconButton, Space, Typography } from '@imbrace/ui';
import MuiDialog from '@mui/material/Dialog';
import type { QueryKey } from '@tanstack/react-query';
import { QueryClientProvider } from '@tanstack/react-query';
import type { OptionsObject } from 'notistack';
import type { CSSProperties } from 'react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { createRoot } from 'react-dom/client';
import { useTranslation } from 'react-i18next';

import { queryClient } from '@/App';
import Avatar from '@/components/Avatar';
import { DialogActions, DialogContent } from '@/components/Dialog';
import { pushNotification } from '@/redux/slices/notification';
import store from '@/redux/store';
import { assignTeamAndUser, getTeamConversationsAssignableTeam, getTeamInvitableUser } from '@/services/api/teamConversation';
import apiFetch from '@/services/axios/handler';

interface Props {
    open: boolean;
    onClose: () => void;
    teamConversationId: string;
    conversationId: string;
    teamId: string;
}

const Dialog = (props: Props) => {
    const { t } = useTranslation();
    const [loading, setLoading] = useState<boolean>(false);
    const [users, setUsers] = useState<API.InvitableUser[]>([]);
    const [teams, setTeams] = useState<API.AssignableTeam[]>([]);
    const [step, setSteps] = useState(0);
    const [selected, setSelected] = useState({
        by: '',
        team_id: '',
        user_id: '',
    });

    const firstOptions = [
        {
            text: t('conversation_invite_assign_to_team'),
            description: t('conversation_invite_assign_to_team_desc'),
            value: 'team',
        },
        {
            text: t('conversation_invite_assign_to_member'),
            description: t('conversation_invite_assign_to_member_desc'),
            value: 'user',
        },
    ] as Option[];

    const { onClose, teamConversationId, conversationId, ...restProps } = props;

    const isValid = useMemo(() => {
        if (selected.by === 'team' && selected.team_id) {
            return true;
        }
        if (selected.by === 'user' && selected.team_id && selected.user_id) {
            return true;
        }
        return false;
    }, [selected]);

    const fetchTeams = useCallback(async () => {
        try {
            const { data } = await apiFetch<API.AssignableTeam[]>(
                getTeamConversationsAssignableTeam.api(),
                getTeamConversationsAssignableTeam.method,
                {
                    conversation_id: conversationId,
                },
            );
            setTeams(data);
        } catch (error) {
            console.log(error);
            setTeams([]);
        }
    }, [conversationId]);

    const fetchUsers = useCallback(async () => {
        if (selected.team_id) {
            try {
                const { data } = await apiFetch<API.InvitableUser[]>(
                    getTeamInvitableUser.api(selected.team_id),
                    getTeamInvitableUser.method,
                    {
                        conversation_id: conversationId,
                    },
                );
                setUsers(data);
            } catch (error) {
                console.log(error);
                setUsers([]);
            }
        }
    }, [conversationId, selected.team_id]);

    useEffect(() => {
        fetchUsers();
    }, [fetchUsers]);

    useEffect(() => {
        fetchTeams();
    }, [fetchTeams]);

    const submit = async () => {
        try {
            await apiFetch(assignTeamAndUser.api(), assignTeamAndUser.method, {
                team_user_id: selected.user_id,
                team_id: selected.team_id,
                conversation_id: conversationId,
            });

            let message = t('conversation_invite_team_success', { team: teams.filter((team) => team._id === selected.team_id)?.[0]?.name });
            if (selected.user_id) {
                message = t('conversation_invite_user_success', {
                    user: users.filter((user) => user._id === selected.user_id)?.[0]?.user?.display_name,
                });
            }
            const newNotification: {
                message: string;
                anchorOrigin?: OptionsObject['anchorOrigin'];
                options?: { onClose?: OptionsObject['onClose'] };
                messageType: string;
                dismissed?: boolean;
                roomName?: string;
                roomId?: string;
                roomChannelType?: API.ChannelType;
                timestamp?: string;
                teamId?: string;
                variant?: string;
                joinable?: boolean;
                style?: CSSProperties;
            } = {
                message,
                messageType: 'noti_success',
                variant: 'success',
                anchorOrigin: {
                    horizontal: 'right',
                    vertical: 'top',
                },
            };
            store.dispatch(pushNotification({ notification: newNotification }));
        } catch (error) {
            let message = t('conversation_invite_team_failed', { team: teams.filter((team) => team._id === selected.team_id)?.[0]?.name });
            if (selected.user_id) {
                message = t('conversation_invite_user_failed', {
                    user: users.filter((user) => user._id === selected.user_id)?.[0]?.user?.display_name,
                });
            }
            const newNotification: {
                message: string;
                anchorOrigin?: OptionsObject['anchorOrigin'];
                options?: { onClose?: OptionsObject['onClose'] };
                messageType: string;
                dismissed?: boolean;
                roomName?: string;
                roomId?: string;
                roomChannelType?: API.ChannelType;
                timestamp?: string;
                teamId?: string;
                variant?: string;
                joinable?: boolean;
                style?: CSSProperties;
            } = {
                message,
                messageType: 'noti_failed',
                variant: 'error',
            };
            store.dispatch(pushNotification({ notification: newNotification }));
            console.log(error);
            throw error;
        }
    };

    const onClick = async () => {
        try {
            setLoading(true);
            await submit();
            setLoading(false);
            onClose();
        } catch (error) {
            setLoading(false);
            onClose();
        }
    };

    const renderContent = () => {
        let selectProps: {
            queryKey: QueryKey;
            name: 'team_id' | 'by' | 'user_id';
            label: string;
            request: () => Promise<Option[]>;
            onChange: (value?: string) => void;
            value?: string;
            closeOnSelect?: boolean;
            onReset?: () => void;
            onClose?: () => void;
        } = {
            queryKey: ['by', { firstOptions }],
            name: 'by',
            label: t('conversation_invite_by_label'),
            request: async () => firstOptions,
            onChange: (event) => {},
        };
        if (step === 0) {
            selectProps = {
                queryKey: ['by', { firstOptions }],
                name: 'by',
                label: t('conversation_invite_by_label'),
                request: async () => firstOptions,
                onChange: (value) => {
                    if (value) {
                        setSteps(1);
                        setSelected((prev) => ({
                            ...prev,
                            by: `${value}`,
                        }));
                    }
                },
                closeOnSelect: false,
            };
        }
        if (step === 1) {
            selectProps = {
                queryKey: ['team_id', { teams }],
                name: 'team_id',
                label: t('conversation_invite_team_label'),
                request: async () => [
                    ...(teams.length === 0
                        ? [
                              {
                                  text: t('conversation_invite_team_empty'),
                                  value: 'empty',
                                  disabled: true,
                              },
                          ]
                        : []),
                    ...teams.map((team) => ({
                        text:
                            selected.by === 'team' ? (
                                team.name
                            ) : (
                                <Space justify="between" style={{ width: '100%' }}>
                                    <Typography>{team.name}</Typography>
                                    <Icon name="chevronRight" style={{ fontSize: 24, color: 'var(--color-light-4)' }} />
                                </Space>
                            ),
                        value: team._id,
                        icon: <Icon name="allTeams" style={{ fontSize: 20, color: 'var(--color-light-5)' }} />,
                    })),
                ],
                onChange: (value) => {
                    setSelected((prev) => ({
                        ...prev,
                        team_id: `${value}`,
                        user_id: '',
                    }));
                    if (selected.by === 'user') {
                        setSteps(2);
                    }
                },
                value: selected.team_id,
                closeOnSelect: selected.by === 'team',
                onReset: () => {
                    setSteps(0);
                    setSelected({
                        by: '',
                        team_id: '',
                        user_id: '',
                    });
                },
                onClose: () => {
                    if (!selected.team_id) {
                        setSteps(0);
                    }
                },
            };
        }
        if (step === 2) {
            selectProps = {
                queryKey: ['user_id', { users }],
                name: 'user_id',
                label: t('conversation_invite_user_label'),
                request: async () => [
                    ...(users.length === 0
                        ? [
                              {
                                  text: t('conversation_invite_member_empty'),
                                  value: 'empty',
                                  disabled: true,
                              },
                          ]
                        : []),
                    ...users.map((user) => ({
                        text: user.user.display_name,
                        description: t(`team_role_${user.role}`),
                        custom: () => {
                            return (
                                <Space size={12}>
                                    {user.user.avatar_url ? (
                                        <Avatar
                                            width="24px"
                                            height="24px"
                                            isActive={true}
                                            avatarUrl={user.user.avatar_url}
                                            displayName={user.user.display_name}
                                        />
                                    ) : (
                                        <Icon
                                            name="accountCircle"
                                            style={{
                                                fontSize: 24,
                                                color: 'var(--color-light-5)',
                                            }}
                                        />
                                    )}
                                    <Typography
                                        style={{
                                            color: 'var(--color-light-7)',
                                        }}
                                    >
                                        {user.user.display_name}
                                    </Typography>
                                </Space>
                            );
                        },
                        value: user._id,
                        icon: user.user.avatar_url ? (
                            <Avatar
                                width="24px"
                                height="24px"
                                isActive={true}
                                avatarUrl={user.user.avatar_url}
                                displayName={user.user.display_name}
                            />
                        ) : (
                            <Icon
                                name="accountCircle"
                                style={{
                                    fontSize: 24,
                                    color: 'var(--color-light-5)',
                                }}
                            />
                        ),
                    })),
                ],
                onChange: (value) => {
                    setSelected((prev) => ({
                        ...prev,
                        user_id: `${value}`,
                    }));
                },
                onReset: () => {
                    setSteps(0);
                    setSelected({
                        by: '',
                        team_id: '',
                        user_id: '',
                    });
                },
                onClose: () => {
                    if (!selected.user_id) {
                        setSteps(0);
                    }
                },
                value: selected.user_id,
                closeOnSelect: true,
            };
        }

        return (
            <>
                <Space align="start" justify="between" style={{ marginBottom: '16px', padding: '32px 32px 0 32px' }}>
                    <div>
                        <Typography variant="Heading2">{t('conversation_invite_title')}</Typography>
                    </div>

                    <IconButton
                        size="s"
                        variant="text"
                        type="secondary"
                        sx={{
                            margin: '-2px 0',
                        }}
                        onClick={() => onClose()}
                    >
                        <Icon name="close" style={{ fontSize: 20 }} />
                    </IconButton>
                </Space>
                <DialogContent>
                    <FieldSelect fullWidth placeholder={t('click_to_select')} {...selectProps} />

                    <DialogActions align="flex-start" sx={{ marginTop: '32px' }}>
                        <Button loading={loading} onClick={onClick} disabled={!isValid} text={t('invite')} />
                    </DialogActions>
                </DialogContent>
            </>
        );
    };

    return (
        <MuiDialog
            PaperProps={{
                sx: {
                    width: 500,
                    justifyContent: 'center',
                },
            }}
            onClose={() => {
                onClose();
            }}
            {...restProps}
        >
            {renderContent()}
        </MuiDialog>
    );
};

const DialogHOC = ({
    teamConversationId,
    conversationId,
    teamId,
}: {
    teamConversationId: string;
    conversationId: string;
    teamId: string;
}) => {
    const [open, setOpen] = useState(true);
    return (
        <QueryClientProvider client={queryClient}>
            <Dialog
                open={open}
                onClose={() => {
                    setOpen(false);
                }}
                teamConversationId={teamConversationId}
                conversationId={conversationId}
                teamId={teamId}
            />
        </QueryClientProvider>
    );
};

export const openInviteUserModal = (props: { teamConversationId: string; conversationId: string; teamId: string }) => {
    const fragment = document.createDocumentFragment();
    const root = createRoot(fragment);
    return root.render(createPortal(<DialogHOC {...props} />, document.body));
};
