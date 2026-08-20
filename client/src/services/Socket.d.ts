declare namespace ImbraceSocket {
    type MessageCreated = API.ConversationMessage & {
        conversation_status: API.StatusType;
        channel_type: API.ChannelType;
        is_presence: boolean;
        from_contact?: API.User;
        is_bot: boolean;
        contact: API.Contact;
    };

    interface ConversationCreated extends API.TeamConversationListItem {
        team: API.Team;
    }

    interface Conversation {
        object_name: 'conversation';
        id: string;
        organization_id: string;
        business_unit_id: string;
        channel_id: string;
        channel_type: API.ChannelType;
        contact_id: string;
        status: API.StatusType;
        name: string;
        timestamp: string;
        is_presence: boolean;
    }

    interface AgentNeeded {
        team_id: string;
        id: string;
        conversation: Conversation;
    }

    interface StatusUpdated {
        id: string;
        previous_status: string;
        conversation: Conversation;
    }

    interface Joined {
        id: string;
        team_id: string;
        user: API.SimpleUser;
    }

    interface Left extends Joined {
        is_agent_joined: boolean;
        is_joined: boolean;
    }

    interface NameUpdated {
        conversation: Conversation;
        id: string;
    }
    interface ContactStatus {
        contact_id: string;
        conversation_id: string;
        organization_id: string;
        team_conversation_id: string;
        timestamp: string;
    }

    interface ContactUpdated extends API.Contact {
        channel: API.Channel;
        action: 'bu.contact_updated';
    }

    interface TeamUpdate extends Omit<API.TeamListItem, 'members_count'> {
        team_user_ids: string[];
        team_users: Omit<API.TeamRole, 'team'>;
    }

    interface TeamJoined {
        action: 'team.joined';
        team_id: string;
        user_id: string;
    }

    interface TeamUserRoleUpdated {
        action: 'team_user.role.update';
        business_unit_id: string;
        id: string;
        object_name: 'team_user';
        organization_id: string;
        role: API.TeamRoleType;
        state: 'join' | 'invite' | 'request';
        team: API.Team;
        team_id: string;
        user: API.User;
        user_id: string;
    }

    interface ConversationInvited {
        action: 'conversation.invited';
        assign_from: string;
        assign_from_name: string;
        conversation_id: string;
        id: string;
        team_id: string;
        team_name: string;
        user: API.SimpleUser;
    }
}
