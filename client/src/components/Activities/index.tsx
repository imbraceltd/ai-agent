import LoanTimeline from './Timeline';
import { getContactActivitiesByConversationId, getContactCommentById, getContactConversationsById } from '@/services/api/contact';
import apiFetch from '@/services/axios/handler';
import { FieldSelect, Illustration, Space, Spin, Typography } from '@imbrace/ui';
import { Box } from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import moment from 'moment';
import { useState } from 'react';
import styles from './index.module.scss';
import clsx from 'clsx';


const dateRangeOptions = [
    { text: 'Last 7 days', value: 'last_7_days' },
    { text: 'This month', value: 'this_month' },
    { text: 'Last month', value: 'last_month' },
    { text: 'All time', value: 'all_time' },
]

const fetchConversations = async ({ queryKey }: { queryKey: (string | undefined | { filterChannels: API.ChannelType[] })[] }) => {
    if (!queryKey[0]) {
        throw new Error('User Id is missing');
    }
    if ((queryKey[2] as { filterChannels: API.ChannelType[] }).filterChannels.length === 0) {
        throw new Error('channel is missing');
    }

    const channels_type = (queryKey[2] as { filterChannels: API.ChannelType[] }).filterChannels.join('&channel_types=');
    const api = getContactConversationsById.api(queryKey[0] as string, channels_type);
    const { data } = await apiFetch<{ data: API.ContactConversation[] }>(api, getContactCommentById.method);

    return data.data;
};

const fetchActivities = async ({ queryKey }: { queryKey: (string | undefined)[] }) => {
    const [conversationId, startDate, endDate] = queryKey;

    if (!conversationId) {
        throw new Error('Conversation Id is missing');
    }

    const api = getContactActivitiesByConversationId.api(conversationId, startDate as string, endDate as string);
    const { data } = await apiFetch<{ items: API.ConversationActivity[] }>(api, getContactActivitiesByConversationId.method);

    return data.items;
};

export default function Activities({ userId, frameLess = false, inModal = false }: { userId?: string, frameLess?: boolean, inModal?: boolean }) {
    const [selectedOption, setSelectedOption] = useState<string>('all_time');

    const getDateRange = () => {
        const now = moment();
        switch (selectedOption) {
            case 'last_7_days':
                return {
                    startDate: now.clone().subtract(7, 'days').format('YYYY-MM-DD'),
                    endDate: now.format('YYYY-MM-DD'),
                };
            case 'this_month':
                return {
                    startDate: now.clone().startOf('month').format('YYYY-MM-DD'),
                    endDate: now.format('YYYY-MM-DD'),
                };
            case 'last_month':
                return {
                    startDate: now.clone().subtract(1, 'month').startOf('month').format('YYYY-MM-DD'),
                    endDate: now.clone().subtract(1, 'month').endOf('month').format('YYYY-MM-DD'),
                };
            case 'all_time':
                return {
                    startDate: undefined,
                    endDate: undefined,
                };
            default:
                return {
                    startDate: undefined,
                    endDate: undefined,
                };
        }
    };

    const { startDate, endDate } = getDateRange();

    const { data: conversations = [], isFetching: isConversationFetching } = useQuery({
        queryKey: [userId, 'conversations', { filterChannels: ['whatsapp', 'web', 'instagram', 'facebook', 'line'] }],
        queryFn: fetchConversations,
        enabled: !!userId,
    });

    const conversationId = conversations[0]?._id;

    const { data: activities = [], isFetching: isActivitiesFetching } = useQuery({
        queryKey: [conversationId, startDate, endDate],
        queryFn: fetchActivities,
        enabled: !!conversationId,
    });

    const renderActivities = (activities: any[]) => {
        if (activities.length === 0) {
            return (
                <Illustration
                    size={8}
                    name="commentMissing"
                    style={{ width: '240px', height: '200px' }}
                    description={
                        <Box sx={{ width: '328px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
                            <Typography variant="SubHeading2">No activities found</Typography>
                            <Typography variant="Caption">No activities found for selected date range</Typography>
                        </Box>
                    }
                />
            );
        }
        const events = activities.map((activity) => ({
            date: moment(activity.created_at).format('DD/MM/YYYY'),
            content: activity.summary,
            status: activity.sentiment,
        }));
        return <LoanTimeline events={events} />;
    };

    const renderDate = () => {
        const option = dateRangeOptions.find((option) => option.value === selectedOption);
        return option?.text?.toLowerCase() || 'all time';
    };

    const render = () => {
        return (
            <Space direction="vertical" align="stretch" size={16}>
                <Space direction="horizontal" align="center" justify="between" size={16}>
                    <Space size={4} direction="horizontal" align="center">
                        <Typography variant="BodyBold">{activities.length} conversations</Typography>
                        <Typography variant="Body" style={{ color: 'var(--color-secondary-3)' }}>
                            in {renderDate()}
                        </Typography>
                    </Space>
                    <FieldSelect
                        queryKey={[selectedOption]}
                        value={selectedOption}
                        onChange={(selectedValue) => {
                            setSelectedOption(selectedValue as string);
                        }}
                        request={async () => {
                            return dateRangeOptions
                        }}
                        formControlSx={{
                            width: 200,
                        }}
                        fullWidth
                    />
                </Space>
                <Spin isSpinning={isActivitiesFetching}>{renderActivities(activities)}</Spin>
            </Space>
        );
    };

    return (
        <div className={styles.container} style={{ height: inModal ? '80%' : 'auto' }}>
            <Space size={16} direction="vertical" align="stretch" className={clsx(styles.inner, styles.frameLess)}>
                {render()}
            </Space>
        </div>
    );
}
