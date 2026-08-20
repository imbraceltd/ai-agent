import { fetchMethod } from "../axios";


export const getGuardRailList = {
    api: '/v2/ai/guardrail/all',
    method: fetchMethod.GET,
};

export const createGuardRail = {
    api: '/v2/ai/guardrail/create',
    method: fetchMethod.POST,
};

export const updateGuardRail = {
    api: (id: string) => `/v2/ai/guardrail/update/${id}`,
    method: fetchMethod.PUT,
};

export const deleteGuardRail = {
    api: (id: string) => `/v2/ai/guardrail/delete/${id}`,
    method: fetchMethod.DELETE,
};

export const getGuardRailById = {
    api: (id: string) => `/v2/ai/guardrail/${id}`,
    method: fetchMethod.GET,
};




