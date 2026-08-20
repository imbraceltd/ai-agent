import { Icon } from '@imbrace/ui';
import { Button, CircularProgress, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import SimpleBar from 'simplebar-react';

import useChannels from '@/hooks/useChannels';
import { resetChannelFilter, selectAllChannel, updateChannelFilter } from '@/redux/slices/teamConversation';
import { useAppDispatch, useAppSelector } from '@/redux/store';

import ChannelButton from '../ChannelButton';
import ConversationList from '../ConversationList';
import ConversationSearchBar from '../ConversationSearchBar';
import styles from './index.module.scss';

export const ChannelInfo: Record<
    API.ChannelType,
    {
        size: 'small' | 'large' | 'medium';
    }
> = {
    web: {
        size: 'medium',
    },
    whatsapp: {
        size: 'small',
    },
    facebook: {
        size: 'small',
    },
    email: {
        size: 'small',
    },
    wechat: {
        size: 'small',
    },
    line: {
        size: 'small',
    },
    instagram: {
        size: 'small',
    },
};

function ConversationBar() {
    const { t } = useTranslation();
    const dispatch = useAppDispatch();
    const channelFilter = useAppSelector((state) => state.TeamConversation.channelFilter);
    const { channels, loading } = useChannels({ countConvs: true });

    return (
        <div className={styles.roomListRoot}>
            <ConversationSearchBar />
            <div className={styles.roomListChannelRoot}>
                <div className={styles.roomListChannelHeader}>
                    <Typography sx={{ fontWeight: 500, fontSize: '0.875rem' }} variant={'body1'}>
                        {t('conversation_channels_select')}
                    </Typography>

                    <div className={styles.roomListChannelHeaderButtons}>
                        <Button
                            size="small"
                            sx={{ fontSize: '0.875rem', color: '#3399fc', padding: 0, minWidth: 50 }}
                            onClick={() => dispatch(selectAllChannel())}
                        >
                            {t('conversation_channels_all')}
                        </Button>

                        <Button
                            size="small"
                            sx={{ fontSize: '0.875rem', color: '#3399fc', padding: 0, minWidth: 50 }}
                            onClick={() => dispatch(resetChannelFilter())}
                        >
                            {t('conversation_channels_reset')}
                        </Button>
                    </div>
                </div>
            </div>
            <SimpleBar autoHide className={styles.channelItems}>
                <div
                    className={`${styles.inner} ${loading ? styles.blur : ''}`}
                    style={{ width: (channels?.length ?? 0) * 40 + ((channels?.length ?? 1) - 1) * 10 + 26 }}
                >
                    {channels?.map((channel, index) => (
                        <ChannelButton
                            key={index}
                            icon={<Icon namespace="channel" name={channel} style={{ fontSize: 24 }} />}
                            size={ChannelInfo[channel]?.size}
                            isCheck={channelFilter.includes(channel)}
                            onClick={() => dispatch(updateChannelFilter(channel))}
                        />
                    ))}
                </div>

                {loading && (
                    <div className={styles.loadingContainer}>
                        <CircularProgress size={25} />
                    </div>
                )}
            </SimpleBar>

            <ConversationList />
        </div>
    );
}

export default ConversationBar;
