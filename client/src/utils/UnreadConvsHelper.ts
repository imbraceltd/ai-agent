import uniq from 'lodash/uniq';
import uniqBy from 'lodash/uniqBy';

import type { ReduxTeamConversations } from '@/redux/slices/teamConversation.types';

type ImbraceUnreadTeamConversations = string[];
type ImbraceTeamConversations = { conversation_id: string; timestamp: string }[];

const UNREAD_TEAM_CONVS_KEY = 'imbrace-unreadTeamConversations';
const TEAM_CONVS_KEY = 'imbrace-teamConversations';
export const getUnreadConvs: () => string | null = () => localStorage.getItem(UNREAD_TEAM_CONVS_KEY);

export const setUnreadConvs = (unreadTeamConvs: ImbraceUnreadTeamConversations) => {
    localStorage.setItem(UNREAD_TEAM_CONVS_KEY, JSON.stringify(unreadTeamConvs));
};

export const getTeamConvs: () => string | null = () => localStorage.getItem(TEAM_CONVS_KEY);
export const setTeamConvs = (teamConversations: API.TeamConversationListItem[]) => {
    let savedConversations: ImbraceTeamConversations = getTeamConvs() ? JSON.parse(getTeamConvs() as string) : [];
    savedConversations = uniqBy([...teamConversations, ...savedConversations], (el) => el.conversation_id).map((conversation) => ({
        conversation_id: conversation.conversation_id,
        timestamp: conversation.timestamp,
    }));
    localStorage.setItem(TEAM_CONVS_KEY, JSON.stringify(savedConversations));
};

export const updateTeamConvs = (teamConversationId: string, timestamp: string) => {
    if (teamConversationId && timestamp) {
        const savedConversations: ImbraceTeamConversations = getTeamConvs() ? JSON.parse(getTeamConvs() as string) : [];
        const conversationIndex = savedConversations.findIndex((conversation) => conversation.conversation_id === teamConversationId);
        if (conversationIndex !== -1) {
            savedConversations[conversationIndex] = { ...savedConversations[conversationIndex], timestamp };
            localStorage.setItem(TEAM_CONVS_KEY, JSON.stringify(savedConversations));
        }
    }
};

export const compareConversations = (teamConversations: ReduxTeamConversations[]) => {
    let savedConversations: ImbraceTeamConversations = getTeamConvs() ? JSON.parse(getTeamConvs() as string) : [];
    let savedUnreadTeamConversations: ImbraceUnreadTeamConversations = getUnreadConvs() ? JSON.parse(getUnreadConvs() as string) : [];
    for (let i = 0; i < teamConversations.length; i += 1) {
        const { conversation_id, timestamp } = teamConversations[i];
        const conversationIndex = savedConversations.findIndex((conversation) => conversation.conversation_id === conversation_id);
        if (conversationIndex !== -1) {
            if (new Date(timestamp) > new Date(savedConversations[conversationIndex].timestamp)) {
                savedUnreadTeamConversations = uniq([conversation_id, ...savedUnreadTeamConversations]);
            }
            savedConversations[conversationIndex] = { ...savedConversations[conversationIndex], timestamp };
        } else {
            savedConversations = [{ conversation_id, timestamp }, ...savedConversations];
            savedUnreadTeamConversations = uniq([conversation_id, ...savedUnreadTeamConversations]);
        }
    }
    localStorage.setItem(TEAM_CONVS_KEY, JSON.stringify(savedConversations));
    localStorage.setItem(UNREAD_TEAM_CONVS_KEY, JSON.stringify(savedUnreadTeamConversations));
    return savedUnreadTeamConversations;
};
