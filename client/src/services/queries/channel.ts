import { createQueryKeys } from '@lukemorales/query-key-factory';
import { useQuery } from '@tanstack/react-query';

import { getChannelList } from '../api/channel';
import apiFetch from '../axios/handler';

const channels = createQueryKeys('channels', {
    list: (channelType: API.ChannelType) => ({
        queryKey: [channelType],
        queryFn: async ({ signal }) => {
            const { data } = await apiFetch<API.PaginatedResponse<API.Channel[]>>(getChannelList.api(channelType), getChannelList.method);
            return data.data;
        },
    }),
});

export const useChannels = (channelType: API.ChannelType) => {
    return useQuery({
        ...channels.list(channelType),
    });
};

export const channelsQueryKey = (channelType: API.ChannelType) => channels.list(channelType).queryKey;

export const channelsQueryFn = (channelType: API.ChannelType) => channels.list(channelType).queryFn;
