import { fetchMethod } from '../axios/index';

export const getRooms = {
    api: '/v1/backend/rooms?type=business_unit_id&status={{status}}&skip={{skip}}&q={{business_unit_id}}&limit={{limit}}&channel_types={{channel_types}}',
    method: fetchMethod.GET,
};

export const getRoomById = {
    api: '/v1/backend/rooms/{{room_id}}',
    method: fetchMethod.GET,
};

export const putRoomById = {
    api: 'v1/backend/rooms/{{room_id}}',
    method: fetchMethod.PUT,
};

export const postRoomStatus = {
    api: '/v1/backend/rooms/_status',
    method: fetchMethod.POST,
};

export const postJoinRoom = {
    api: '/v1/backend/rooms/_join',
    method: fetchMethod.POST,
};

export const getRoomStatusCount = {
    api: '/v1/backend/rooms/_status_count?type=business_unit_id&q={{business_unit_id}}',
    method: fetchMethod.GET,
};

export const getSearchRoomList = {
    api: '/v1/backend/rooms/_search?business_unit_id={{business_unit_id}}&type=text&q={{text}}&limit={{limit}}&skip={{skip}}',
    method: fetchMethod.GET,
};
