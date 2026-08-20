import { fetchMethod } from '../axios';

export const getCampaigns = {
    api: () => '/v1/backend/campaign',
    method: fetchMethod.GET,
};
export const postCampaign = {
    api: () => '/v1/backend/campaign',
    method: fetchMethod.POST,
};
export const deleteCampaign = {
    api: (campaignId: string) => `/v1/backend/campaign/${campaignId}`,
    method: fetchMethod.DELETE,
};

export const getCampaignById = {
    api: (campaignId: string) => `/v1/backend/campaign/${campaignId}`,
    method: fetchMethod.GET,
};

export const getTouchpointList = {
    api: ({ campaignId, is_archived }: { campaignId?: string; is_archived?: boolean }) => {
        const params = new URLSearchParams();
        if (campaignId) {
            params.append('campaign_id', campaignId);
        }
        if (is_archived) {
            params.append('is_archived', is_archived.toString());
        }
        params.append('sort', '-created_at');
        return `/v1/backend/touchpoint?${params}`;
    },
    method: fetchMethod.GET,
};
export const getTouchpointById = {
    api: (touchpointId: string) => `/v1/backend/touchpoint/${touchpointId}`,
    method: fetchMethod.GET,
};

export const putTouchpointById = {
    api: (contactId: string) => `/v1/backend/touchpoint/${contactId}`,
    method: fetchMethod.PUT,
};
export const postTouchpoint = {
    api: () => '/v1/backend/touchpoint',
    method: fetchMethod.POST,
};
export const deleteTouchpointById = {
    api: (touchpointId: string) => `/v1/backend/touchpoint/${touchpointId}`,
    method: fetchMethod.DELETE,
};

export const postValidateTouchpointInitial = {
    api: () => '/v1/backend/touchpoint/_validate',
    method: fetchMethod.POST,
};
