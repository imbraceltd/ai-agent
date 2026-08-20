import { fetchMethod } from '../axios/index';

export const getWhatsAppMessageLists = {
    api: (businessUnitId: string, skip = 0, limit = 10) =>
        `/v1/backend/whatsapp_templates?type=business_unit_id&q=${businessUnitId}&limit=${limit}&skip=${skip}`,
    method: fetchMethod.GET,
};

export const getWhatsAppMessageListsV2 = {
    api: (businessUnitId: string, channelId: string, skip = 0, limit = 10) =>
        `/v2/backend/whatsapp_templates?type=business_unit_id&q=${businessUnitId}&limit=${limit}&skip=${skip}&channel_id=${channelId}`,
    method: fetchMethod.GET,
};
