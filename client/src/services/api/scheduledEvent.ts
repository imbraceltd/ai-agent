import { fetchMethod } from '../axios';

export const getScheduledEvents = {
    api: () => '/v1/backend/schedulers',
    method: fetchMethod.GET,
};

export const deleteScheduledEvent = {
    api: (id: string) => `/v1/backend/schedulers/${id}`,
    method: fetchMethod.DELETE,
};

export const getScheduledEventFilterOptions = {
    api: (value: 'channel_source' | 'event_type' | 'sender') => `/v1/backend/schedulers/filter_options?filter=${value}`,
    method: fetchMethod.GET,
};
