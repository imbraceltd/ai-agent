import { fetchMethod } from '../axios/index';

export const getMessagesByRoomId = {
    api: '/v1/backend/messages?type=room_id&q={{room_id}}&limit={{limit}}&skip={{skip}}',
    method: fetchMethod.GET,
};

export const getMessagesByText = {
    api: '/v1/backend/messages/search?id={{room_id}}&q={{query}}&limit={{limit}}&skip={{skip}}',
    method: fetchMethod.GET,
};

export const postMessages = {
    api: '/v1/backend/messages',
    method: fetchMethod.POST,
};

export const postMessageFileUpload = {
    api: '/v1/backend/messages/_fileupload',
    method: fetchMethod.POST,
};

export const getMessageIndex = {
    api: (conversation_id: string, conversation_message_id: string) =>
        `/v1/backend/conversations/${conversation_id}/conversation_messages/${conversation_message_id}/_index`,
    method: fetchMethod.GET,
};
