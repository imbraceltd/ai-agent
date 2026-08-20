import { fetchMethod } from '../axios/index';

export const getNotifications = {
    api: '/v1/backend/notifications',
    method: fetchMethod.GET,
};

export const readNotification = {
    api: '/v1/backend/notifications/read',
    method: fetchMethod.PUT,
};

export const dismissNotification = {
    api: '/v1/backend/notifications/dismiss',
    method: fetchMethod.DELETE,
};

export const dismissAllNotifications = {
    api: '/v1/backend/notifications/dismiss/all',
    method: fetchMethod.DELETE,
};
