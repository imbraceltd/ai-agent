import { fetchMethod } from '../axios/index';

export const whatsappOutbound = {
    api: () => '/v1/backend/outbounds/whatsapp',
    method: fetchMethod.POST,
};

export const emailOutbound = {
    api: () => '/v1/backend/outbounds/email',
    method: fetchMethod.POST,
};
