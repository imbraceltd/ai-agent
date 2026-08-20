import { fetchMethod } from '../axios/index';

export const getChannelList = {
    api: (channelType: string) => `/v1/backend/channels?type=${channelType}`,
    method: fetchMethod.GET,
};

export const getChannelById = {
    api: (channelId: string) => `/v1/backend/channels/${channelId}`,
    method: fetchMethod.GET,
};

export const postChannelByBuId = {
    api: '/v1/backend/channels',
    method: fetchMethod.POST,
};

export const putChannelByBuId = {
    api: (channelId: string) => `/v1/backend/channels/${channelId}`,
    method: fetchMethod.PUT,
};

export const deleteChannelById = {
    api: (channelId: string) => `/v1/backend/channels/${channelId}`,
    method: fetchMethod.DELETE,
};

export const postChannelFile = {
    api: '/v1/backend/channels/_fileupload',
    method: fetchMethod.POST,
};

export const getChannelCount = {
    api: () => '/v1/backend/channels/_count',
    method: fetchMethod.GET,
};

export const getConversationCount = {
    api: () => '/v1/backend/channels/_conv_count',
    method: fetchMethod.GET,
};

export const getFacebookChannelByUserId = {
    api: (userID: string) => `/v1/backend/facebooks?fbUserId=${userID}`,
    method: fetchMethod.GET,
};

export const createFacebookChannel = {
    api: '/v1/backend/facebook/_auth_pages',
    method: fetchMethod.POST,
};

export const deleteFacebookChannels = {
    api: '/v1/backend/facebook/_cancel_pages',
    method: fetchMethod.POST,
};

export const postMailChannelByBuId = {
    api: '/v1/backend/mail_channels',
    method: fetchMethod.POST,
};

export const putMailChannelByBuId = {
    api: (channelId: string) => `/v1/backend/mail_channels/${channelId}`,
    method: fetchMethod.PUT,
};

export const initializeNewChannel = {
    api: '/v1/backend/init_channel',
    method: fetchMethod.POST,
};

export const updateChannelById = {
    api: (channelId: string) => `/v1/backend/channels/${channelId}`,
    method: fetchMethod.PUT,
};

export const channelCount = {
    api: () => '/v1/backend/channels/_count',
    method: fetchMethod.GET,
};

export const createWebWidget = {
    api: () => '/v1/backend/channels/_web',
    method: fetchMethod.POST,
};

export const fetchFBPagesWithCredId = {
    api: (credentialId: string) => `/v1/backend/channels/_facebook/credential/${credentialId}`,
    method: fetchMethod.GET,
};

export const createFacebook = {
    api: () => '/v1/backend/channels/_facebook',
    method: fetchMethod.POST,
};

export const updateFacebook = {
    api: () => '/v2/backend/channels/_facebook',
    method: fetchMethod.PUT,
};

export const createInstagram = {
    api: () => '/v1/backend/channels/_instagram',
    method: fetchMethod.POST,
};

export const createInstagramDirectV2 = {
    api: () => '/v1/backend/channels/_instagramV2',
    method: fetchMethod.POST,
};

export const updateInstagram = {
    api: () => '/v1/backend/channels/_instagram',
    method: fetchMethod.PUT,
};

export const createEmail = {
    api: () => '/v1/backend/channels/_email',
    method: fetchMethod.POST,
};

export const createWechat = {
    api: () => '/v1/backend/channels/_wechat',
    method: fetchMethod.POST,
};

export const createLine = {
    api: () => '/v1/backend/channels/_line',
    method: fetchMethod.POST,
};

export const createWhatsapp = {
    api: () => '/v1/backend/channels/_whatsapp',
    method: fetchMethod.POST,
};

export const createWhatsappV2 = {
    api: () => '/v2/backend/channels/_whatsapp',
    method: fetchMethod.POST,
};

export const updateWhatsApp = {
    api: () => '/v2/backend/channels/_whatsapp',
    method: fetchMethod.PUT,
};

export const replaceChannel = {
    api: () => '/v1/backend/channels/_replace',
    method: fetchMethod.POST,
};
