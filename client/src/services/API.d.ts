declare namespace API {
    interface PaginatedResponse<D, N = Record<string, unknown>> {
        data: D;
        has_more: boolean;
        nested: N;
        object_name?: 'list';
        total: number;
        count: number;
        unread_count: number;
    }
    interface PaginatedMetaResponse<D> {
        data: D;

        meta: {
            total: number;
            count: number;
            has_more: boolean;
        };
    }

    interface MeilisearchResponse<D> {
        message: {
            estimatedTotalHits: number;
            hits: D;
            limit: number;
            offset: number;
            query: string;
            processingTimeMs: number;
        };
        success: boolean;
    }
    interface MeilisearchItem {
        board_id: string;
        business_unit_id: string;
        conversation_ids: any[];
        created_at: string;
        created_type: string;
        doc_name: string;
        fields: any;
        fields_timestamp: any;
        organization_id: string;
        public_id: string;
        _id: string;
        contact_name?: string;
    }

    interface BusinessContactCollectorPayload {
        name: string;
        position: string;
        company: string;
        phone: string;
        email: string;
        country: string;
        tags: string[] | undefined;
        remarks: string;
    }
    interface ErrorResponse {
        code: number;
        message: string;
        key: Record<string, number>;
        validate: string;
        field?: string;
    }

    interface ListQueryParams {
        limit?: number;
        skip?: number;
        sort?: string;
        filters?: string;
    }

    type Language = 'en' | 'zh_tw' | 'zh_cn';

    type ChannelType = 'web' | 'facebook' | 'whatsapp' | 'instagram' | 'email' | 'wechat' | 'line';

    type StatusType = 'active' | 'spam' | 'closed' | 'soon to be' | 'overdue' | 'rep needed' | 'unassigned' | 'pending';

    type Role = 'user' | 'admin' | 'owner' | 'member' | 'bot' | 'technician';

    type TeamRoleType = 'member' | 'admin';

    type TeamMode = 'public' | 'grab';

    type RolesCount = Record<Exclude<Role, 'member' | 'bot'>, API.number>;

    type ChannelsCount = Record<ChannelType | 'store' | 'all', API.number>;

    interface VerifyOTP {
        object_name: 'login_access';
        id: string;
        token: string;
        email: string;
        expired_at: string;
    }

    interface VerifySocialSignIn {
        [key: string]: any;
        data: {
            created_at: string;
            doc_name: string;
            email: string;
            expired_at: string;
            token: string;
            updated_at: string;
            _id: string;
        };
    }

    interface Access {
        object_name: string;
        id: string;
        token: string;
        refresh_token: string;
        user_id: string;
        expired_at: string;
        created_at: string;
        updated_at: string;
        creator: User;
    }

    interface Modules {
        conversation: boolean;
        internal_ai_chat: boolean;
        databoards: boolean;
        campaign: boolean;
        workflows: boolean;
        workflows_v2: boolean;
        channels: boolean;
        credentials: boolean;
        analytics: boolean;
        knowledge_hub: boolean;
        ai_agent: boolean;
        knowledge_base: boolean;
        teams: boolean;
        member: boolean;
        templates: boolean;
        events: boolean;
        marketplace: boolean;
        ideas: boolean;
        crm: boolean;
    }

    interface Account {
        object_name: string;
        id: string;
        organization_id: string;
        organization_name: string;
        display_name: string;
        avatar_url: string;
        gender: string;
        first_name: string;
        last_name: string;
        address_line1: string;
        address_line2: string;
        area_code: string;
        phone_number: string;
        email: string;
        language: string;
        role: Role;
        status: string;
        is_active: boolean;
        is_archived: boolean;
        created_at: string;
        updated_at: string;
        team_roles: TeamRole[];
        organization_modules: Modules;
        organization_lock_features?: LockFeatures;
        support: {
            customer?: {
                channel?: API.Channel;
                touchpoint?: API.Touchpoint;
            };
            app?: {
                channel?: API.Channel;
                touchpoint?: API.Touchpoint;
            };
        };
        on_boarded: boolean;
        is_paid: boolean;
        partition: number;
    }

    interface Organization {
        object_name: 'organization';
        id: string;
        name: string;
        created_at: string;
        updated_at: string;
    }

    interface BusinessUnit {
        object_name: 'business_unit';
        id: string;
        organization_id: string;
        name: string;
        created_at: string;
        updated_at: string;
    }

    interface TeamRole {
        object_name: 'team_user';
        id: string;
        organization_id: string;
        business_unit_id: string;
        team_id: string;
        user_id: string;
        role: TeamRoleType;
        state: 'join' | 'invite' | 'request';
        team: Team;
        created_at: string;
    }

    interface TeamConversationLabel {
        _id: string;
        business_unit_id: string;
        organization_id: string;
        public_id: string;
        doc_name: string;
        color: string;
        name: string;
        team_id: string;
    }

    interface TeamConversationLabelList {
        items: TeamConversationLabel[];
        count: number;
        total: number;
        has_more: boolean;
    }

    interface TeamConversationCommentList {
        items: ConversationMessageContactComments[];
        count: number;
        total: number;
        has_more: boolean;
    }

    interface TeamRoleWithUser extends TeamRole {
        user: User;
    }

    interface Team {
        object_name: 'team';
        _id: string;
        id: string;
        organization_id: string;
        business_unit_id: string;
        name: string;
        mode: TeamMode;
        icon_url: string;
        description: string;
        is_default: boolean;
        created_at: string;
        updated_at: string;
        user_state: 'join' | 'invite' | 'request';
        members_count: number;
        admin_count: number;
        team_user_ids: string[];
        team_users: TeamRole[];
        role?: string;
    }

    interface TeamListItem extends Team {
        is_joined: boolean;
        is_disabled: boolean;
        members_count: number;
    }

    interface TeamConversationViewCount {
        all: number;
        yours: number;
        closed: number;
        spam: number;
        online: number;
        overdue: number;
        pending: number;
        rep_needed: number;
        soon_to_be: number;

        [key: string]: number;
    }

    type LatestMessage = ConversationMessage<
        {
            is_bot: boolean;
        } & BaseConversationMessage
    >;

    interface TeamConversationListItem {
        object_name: 'team_conversation';
        id: string;
        _id: string;
        organization_id: string;
        business_unit_id: string;
        conversation_id: string;
        team_id: string;
        channel_id: string;
        channel_type: ChannelType;
        contact_id: string;
        status: StatusType;
        name: string;
        timestamp: string;
        is_joined: boolean;
        mode?: string;
        is_agent_joined: boolean;
        is_presence: boolean;
        contacts_latest_message?: LatestMessage;
        latest_message: LatestMessage;
        contact: Contact;
        conversation?: Conversation;
        channel: {
            active: boolean;
            is_deleted: boolean;
            name: string;
            _id: string;
        };
    }

    interface TeamConversation extends TeamConversationListItem {
        users: SimpleUser[];
    }
    interface ContactConversation extends TeamConversationListItem {
        teams: Team[];
        available_team_conversations?: { _id: string; user_id: string }[];
    }

    interface Notification {
        object_name: 'team_own_conversation';
        id: string;
        team_id: string;
        conversation_id: string;
        conversation: Conversation;
    }

    interface Conversation {
        object_name: 'conversation';
        id: string;
        organization_id: string;
        business_unit_id: string;
        channel_id: string;
        channel_type: ChannelType;
        contact_id: string;
        status: API.StatusType;
        name: string;
        timestamp: string;
        is_agent_joined: boolean;
        is_joined: boolean;
    }

    interface BaseContact {
        avatar_url: string;
        first_name: string;
        last_name: string;
        gender: string;
        phone_number: string;
        email: string | null;
        time_zone: string;
        company_name: string;
        location: string;
        title: string;
        birthday: string | null;
        whatsapp_id: string;
        facebook_id: string;
        wechat_id: string;
        messenger_id: string;
        line_id: string;
        instagram_id: string;
    }

    interface BaseContact {
        avatar_url: string;
        first_name: string;
        last_name: string;
        gender: string;
        phone_number: string;
        email: string | null;
        time_zone: string;
        company_name: string;
        location: string;
        title: string;
        birthday: string | null;
        whatsapp_id: string;
        facebook_id: string;
        wechat_id: string;
        messenger_id: string;
        line_id: string;
        instagram_id: string;
    }

    interface Contact extends BaseContact {
        object_name: 'contact';
        id: string;
        _id: string;
        organization_id: string;
        business_unit_id: string;
        channel_id: string;
        channel_type: ChannelType;
        display_name: string;
        last_seen: string;
        area_code: string;
        language: Language;
        remark: string;
        created_at: string;
        updated_at: string;
        is_presence?: boolean;
    }

    interface ContactFile {
        _id: string;
        content: {
            caption: string;
            url: string;
            extension: string;
        };
        created_at: string;
        from: string;
        type: string;
        updated_at: string;
    }

    interface SimpleUser {
        object_name: 'simple_user';
        id: string;
        display_name: string;
        avatar_url: string;
        first_name: string;
        last_name: string;
        is_bot: boolean;
        assign_from_name?: string;
        assign_from?: string;
        teams?: { team_id: string; team_name: string; team_user_role?: string }[];
    }

    interface QuickReply {
        title: string;
        text: string;
        description?: string;
        quick_replies: QuickReplyElement[];
    }

    interface QuickReplyElement {
        id: string;
        content_type: string;
        title: string;
        description: string;
        payload: string;
    }

    interface TextContent {
        text: string;
        is_mail: boolean;
    }

    interface MediaContent {
        caption?: string;
        url: string;
    }

    interface VideoContent {
        text: string;
        url: string;
    }

    interface WhatsAppTemplateContent {
        text: string;
        variables: string[];
    }

    type MessageType =
        | 'text'
        | 'quick_reply'
        | 'image'
        | 'jaas.conference'
        | 'audio'
        | 'response'
        | 'whatsapp.template'
        | 'whatsapp.sticker'
        | 'pdf'
        | 'video'
        | 'message_template';

    interface BaseConversationMessage {
        object_name: 'message';
        id: string;
        organization_id: string;
        business_unit_id: string;
        conversation_id: string;
        from: string;
        created_at: string;
        updated_at: string;
        comments?: ConversationMessageComments[];
    }

    type TextMessage<T> = T & {
        type: 'text' | 'jaas.conference' | 'message_template';
        content: TextContent;
    };
    type QuickReplyMessage<T> = T & {
        type: 'quick_reply' | 'response';
        content: QuickReply;
    };
    type VideoMessage<T> = T & {
        type: 'video';
        content: VideoContent;
    };
    type MediaMessage<T> = T & {
        type: 'image' | 'audio' | 'pdf' | 'whatsapp.sticker';
        content: MediaContent;
    };
    type WhatsAppTemplateMessage<T> = T & {
        type: 'whatsapp.template';
        content: WhatsAppTemplateContent;
    };

    type ConversationMessage<T = BaseConversationMessage> =
        | TextMessage<T>
        | QuickReplyMessage<T>
        | VideoMessage<T>
        | MediaMessage<T>
        | WhatsAppTemplateMessage<T>;

    type ConversationMessageComments = {
        _id: string;
        content: string;
        channel_type: string;
        labels: API.TeamConversationLabel[];
        from: {
            _id: string;
            display_name: string;
        };
        created_at: string;
        updated_at: string;
    };
    type ConversationMessageContactComments = {
        _id: string;
        content: string;
        organization_id: string;
        business_unit_id: string;
        conversation_id: string;
        channel_type: string;
        comments: API.ConversationMessageComments[];
        created_at: string;
        updated_at: string;
        team_conversation_users_id: string;
        team_id: string;
        team_conversation: TeamConversation;
    };

    interface WhatsAppMessageTemplate {
        business_unit_id: string;
        created_at: string;
        id: string;
        language: string;
        object_name: 'whatsapp_template';
        organization_id: string;
        template_name: string;
        text: string;
        updated_at: string;
        status: 'APPROVED' | 'PENDING' | 'REJECTED';
    }

    interface MessageTemplate {
        object_name: 'message_template';
        id: string;
        _id?: string;
        organization_id: string;
        business_unit_id: string;
        title: string;
        text: string;
        template_language: string;
        category: {
            id: string;
            name: string;
        };
        categories: string[];
        created_at: string;
        updated_at: string;
    }

    interface ChannelWebWidget {
        active: boolean;
        _id: string;
        doc_name: string;
        name: string;
        is_disabled: boolean;
        bot_id: string;
        business_unit_id: string;
        organization_id: string;
        config: {
            type: string;
            // step1
            window_name: string;
            window_logo: string;
            chatbot_name: string;
            welcome_message: string;
            chatbot_avatar: string;
            primary_color: string;
            header_color?: string;
            background_color?: string;
            font_size?: string;
            secondary_color: string;
            // step2
            email_config: {
                action_button_text: string;
                button_url: string;
                email: string;
                subject_title: string;
                profile_name: string;
                e_signature_logo: string;
                e_signature_name: string;
                e_signature_information: string;
                show_powered_by: boolean;
                legal_disclaimer: string;
            };
        };
        public_id: string;
        created_at: string;
        credential_id: number;
        updated_at: string;
        workflow_id: number;
        is_init: boolean;
        id: string;
    }

    interface ChannelMail {
        bot_id: string;
        business_unit_id: string;
        created_at: string;
        description: string;
        fallback_url: string;
        icon_url: string;
        id: string;
        is_disabled: boolean;
        name: string;
        object_name: 'channel';
        organization_id: string;
        profile_display_name: string;
        type: string;
        updated_at: string;
        email_subject: string;
        display_cta_button: boolean;
        cta_button_action: string;
        cta_button_color: string;
        cta_button_text: string;
        cta_button_url: string;
        display_powered_by: boolean;
        esignature_contact_info: string;
        esignature_team_name: string;
        legal_disclaimer: string;
    }

    interface FileUpload {
        url: string;
    }

    interface User {
        object_name: 'user';
        _id: string;
        id: string;
        display_name: string;
        avatar_url: string;
        first_name: string;
        last_name: string;
        gender: string;
        area_code: string;
        phone_number: string;
        language: Language;
        status: string;
        is_bot: boolean;
        is_active: boolean;
        is_archived: boolean;
        is_deleted: boolean;
        created_at: string;
        updated_at: string;
        organization_id: string;
        email: string;
        role: Role;
        team_ids: string[];
        time_zone: string;
        last_seen: string;
        company_name: string;
        location: string;
        title: string;
        birthday: string;
        whatsapp_id?: string;
        facebook_id?: string;
        wechat_id?: string;
        messenger_id?: string;
        line_id?: string;
        instagram_id?: string;
    }

    interface pagination {
        page: number;
        rowsPerPage: number;
        total: number;
        count: number;
    }

    // interface Channel {
    //     phone?: string;
    //     object_name: 'channel';
    //     id: string;
    //     organization_id: string;
    //     business_unit_id: string;
    //     bot_id: string;
    //     type: string;
    //     name: string;
    //     icon_url: string;
    //     primary_color: string;
    //     secondary_color: string;
    //     description: string;
    //     welcome_message: string;
    //     is_disabled: boolean;
    //     created_at: string;
    //     updated_at: string;
    //     floor_plans?: FloorPlan[];
    //     is_init: boolean;
    //     workflow_id: string;
    // }

    interface Scanners {
        object_name: string;
        id: string;
        organization_id: string;
        business_unit_id: string;
        store_id: string;
        floor_plan_id: string;
        name: string;
        type: string;
        position_x: number;
        position_y: number;
        description: string;
        token: string;
        qr_code_url: string;
        service_uuid: string;
        tag_ids: string[];
        tags: string[];
        created_at: string;
        updated_at: string;
    }

    interface FloorPlan {
        object_name: string;
        id: string;
        organization_id: string;
        business_unit_id: string;
        store_id: string;
        name: string;
        description: string;
        image_url: string;
        image_width: number;
        image_height: number;
        dimension_width: number;
        dimension_height: number;
        dimension_unit: string;
        scale_x: number;
        scale_y: number;
        is_master: boolean;
        is_linked_zone: boolean;
        created_at: string;
        updated_at: string;
        scanner_ids: string[];
        scanners: Scanners[];
        zone_ids: string[];
        zones: string[];
    }

    interface PropertyType {
        default: string;
        description: string;
        displayName?: string;
        displayname?: string;
        displayOptions?: Record<string, Record<string, string[]>>;

        placeholder?: string;
        name: string;
        type: string;
        typeOptions?: Record<string, unknown>;
        options?: Record<string, string>[];
        required?: boolean;
    }

    interface NodeAccessType {
        nodeType: string;
        date: string;
    }

    interface CredentialType {
        name: string;
        displayName: string;
        documentationUrl: string;
        extends: string[];
        properties: PropertyType[];
        icon: string;
        totalExtends?: string[];
    }

    interface Credential {
        id: string;
        name: string;
        nodesAccess: NodeAccessType[];
        type: string;
        data: Record<string, string>;
        createdAt?: string;
        updatedAt?: string;
        touchpoints: SimpleTouchpoint[];
        workflows: SimpleWorkflows[] | null;
        channel?: {
            id: string;
            is_init: BooleanSupportOption;
            name: string;
            type: ChannelType;
        };
    }

    interface CredentialData extends Credential {
        channelId: string;
    }

    interface ChannelCredential extends CredentialData {
        data: {
            window_name: string;
            window_logo: string;
            chatbot_name: string;
            chatbot_avatar: string;
            welcome_message: string;
            primary_color: string;
            header_color?: string;
            secondary_color: string;
            background_color?: string;
            font_size?: string;
            access_key: string;
            msisdn: string;
            phone_number: string;
            phone_number_id: string;
            business_account_id: string;
            mb_channel_id: string;
            namespace: string;
            signing_key: string;
            _id: string;
            type: string;
            line_basic_id: string;
        };
    }

    interface ChannelCredentialData {
        window_name: string;
        window_logo: string;
        chatbot_name: string;
        chatbot_avatar: string;
        welcome_message: string;
        primary_color: string;
        header_color?: string;
        background_color?: string;
        font_size?: string;
        secondary_color: string;
        access_key: string;
        msisdn: string;
        phone_number: string;
        phone_number_id: string;
        business_account_id: string;
        mb_channel_id: string;
        namespace: string;
        signing_key: string;
        _id: string;
        type: string;
        line_basic_id: string;
    }

    interface DataAnalyticsBarChart {
        date: string;
        value: number;
    }

    interface ChannelInfo {
        facebook: number;
        instagram: number;
        line: number;
        mail: number;
        store: number;
        web_widget: number;
        wechat: number;
        whatsapp: number;
    }

    interface DataAnalyticsSummary {
        active_customers: number;
        new_customers: number;
        received_messages: number;
        message_per_customer: number;
        response_time: string;
        channel_info: ChannelInfo;
    }

    interface DataAnalyticsTotalCount {
        total_customers: number;
        total_messages: number;
        total_channels: number;
    }

    interface Facebook {
        object_name: 'Facebook';
        id: string;
        organization_id: string;
        business_unit_id: string;
        channel_id: string;
        page_id: string;
        page_name: string;
        fb_user_id: string;
        created_at: string;
        updated_at: string;
        channel: Channel;
    }

    interface FBCategory {
        id: string;
        name: string;
    }

    interface FacebookPage {
        access_token?: string;
        category?: string;
        category_list?: FBCategory[];
        id: string;
        name: string;
        picture?: Picture;
        tasks?: string[];
        exist?: boolean;
        willDelete?: boolean;
    }

    interface ChannelToggle {
        active: boolean;
    }

    interface Channel {
        _id: string;
        doc_name: string;
        name: string;
        active: boolean;
        bot_id: string;
        business_unit_id: string;
        organization_id: string;
        is_deleted: boolean;
        is_replace?: boolean;
        config: {
            email_config?: {
                email: string;
                subject_title: string;
                profile_name: string;
                action_button_text: string;
                button_url: string;
                e_signature_name: string;
                e_signature_information: string;
                show_powered_by: string;
                legal_disclaimer: string;
                e_signature_logo: string;
            };
            window_name: string;
            window_logo: string;
            chatbot_name: string;
            chatbot_avatar: string;
            welcome_message: string;
            primary_color: string;
            header_color?: string;
            background_color?: string;
            font_size?: string;
            secondary_color: string;
            access_key: string;
            msisdn: string;
            phone_number: string;
            phone_number_id: string;
            business_account_id: string;
            mb_channel_id: string;
            namespace: string;
            signing_key: string;
            _id: string;
            type: string;
            line_basic_id: string;
            user_name: string;
            use_facebook_login?: boolean;
        };
        error?: 'NOT_APPLICABLE';
        errorCode?: number;
        errorMessage?: string;
        is_disabled: boolean;
        public_id: string;
        created_at: string;
        credential_id: string;
        workflow_id: string;
        updated_at: string;
        is_init: boolean;
        id: string;
        floor_plans?: FloorPlan[]; // TO DO: to be removed
        touchpoints: SimpleTouchpoint[];
    }

    interface ChannelCount {
        all: number;
        store: number;
        web: number;
        facebook: number;
        whatsapp: number;
        instagram: number;
        wechat: number;
        line: number;
        mail: number;
        null: number;
    }

    interface GeneralChannel {
        active: boolean;
        bot_id: string;
        business_unit_id: string;
        created_at: string;
        credential_id: string;
        doc_name: string;
        id: string;
        is_init: boolean;
        name: string;
        organization_id: string;
        public_id: string;
        updated_at: string;
        workflow_id: string;
        _id: string;
        is_deleted: boolean;
    }

    interface InstagramChannel extends GeneralChannel {
        config: {
            page_id: string;
            igsid: string;
            page_token: string;
            type: string;
            _id: string;
            fb_user_id: string;
            ig_profile_picture_url: string;
        };
    }

    interface FacebookChannel extends GeneralChannel {
        config: {
            fb_user_id: string;
            page_id: string;
            page_name: string;
            page_token: string;
            type: string;
            _id: string;
        };
    }

    interface WhatsAppChannel extends GeneralChannel {
        config: {
            access_key: string;
            phone_number_id: string;
            business_account_id: string;
        };
    }

    interface Touchpoint {
        doc_name: 'campaigns';
        organization_id: string;
        business_unit_id: string;
        public_id: string;
        name: string;
        description: string;
        paid_keywords: string[];
        source: string;
        utm_tracking: boolean;
        url: string;
        destination_url: string;
        initial_phrase?: string;
        logo: string;
        channel_id: string;
        id: string;
        _id: string;
        channel: API.Channel;
        start_datetime: Date;
        end_datetime: Date | null;
        media_name?: string;
        execute_workflow_id: string;
        execute_workflow_name: string;
        default_channel_workflow_id: string;
        default_channel_workflow_name: string;
        campaign_id?: string;
        campaign_name?: string;
        from_url_count: number;
        scan_qrcode_count: number;
        status: 'inactive' | 'active' | 'archived' | 'update_needed';
        is_paused: boolean;
        is_archived: boolean;
        deleted_at?: string;
        created_at: string;
        campaign?: CampaignBase;
        is_outside_range: boolean;
        wechat_config?: {
            wechat_url_with_initiation_phase: string;
            wechat_url_without_initiation_phase: string;
        };
    }

    interface SimpleTouchpoint {
        id: string;
        name: string;
        logo: string;
        initial_phrase?: string;
    }

    interface TouchpointPostType {
        name: string;
        description?: string;
        paid_keywords?: string[];
        source?: string;
        utm_tracking?: boolean;
        initial_phrase?: string;
        logo?: string;
        channel_id?: string | null;
        url?: string | null;
        destination_url?: string | null;
        start_datetime: Date | null;
        end_datetime: Date | null;
        media_name?: string;
        execute_workflow_id?: string | null;
        campaign_id?: string | null;
        is_paused: boolean;
        is_archived: boolean;
    }

    interface SimpleWorkflows {
        id: string;
        active: boolean;
        name: string;
        credential_id: number;
    }

    interface AIFunctionParameters {
        type: 'object';
        properties: {
            [key: string]: {
                type: 'string' | 'number' | 'boolean' | 'array' | 'object';
                description: string;
                items?: {
                    type: 'string' | 'number' | 'boolean';
                    description: string;
                };
            };
        };
        required: string[];
    }

    interface AIFunction {
        name: string;
        description: string;
        parameters: AIFunctionParameters;
    }

    interface AISettings {
        type: 'function';
        function: AIFunction;
    }

    interface WorkflowSettings {
        ai: AISettings;
    }

    interface WorkflowListItem {
        active: boolean;
        createdAt?: string;
        id: string;
        name: string;
        tags: { id: string; name: string }[];
        channel?: {
            id: string;
            is_init: boolean;
            type: ChannelType;
            name: string;
        };
        updatedAt?: string;
        touchpoints?: SimpleTouchpoint[];
        board?: AutomationWorkflow[];
        settings?: WorkflowSettings;
    }

    interface CampaignBase {
        business_unit_id: string;
        created_at: string;
        doc_name: string;
        id: string;
        name: string;
        organization_id: string;
        public_id: string;
        _id: string;
    }

    interface Campaign extends CampaignBase {
        touchpoints: Touchpoint[];
    }

    interface AssignableTeam {
        _id: string;
        doc_name: string;
        public_id: string;
        organization_id: string;
        business_unit_id: string;
        icon_url: string;
        name: string;
        mode: string;
        description: string;
        is_default: boolean;
        created_at: string;
        updated_at: string;
        isAssign: boolean;
    }

    interface InvitableUser {
        _id: string;
        role: TeamRole;
        user: User;
    }

    interface UserSignUpForm {
        email: string;
        password: string;
        firstName: string;
        lastName: string;
        file: string;
        country: string;
        language: string;
        companyName: string;
        companySize: string;
        organizationName: string;
    }

    interface UserSignUpFormData {
        code: number;
        field: string;
        message: string;
    }

    interface UserSignIn {
        email: string;
        expired_at: string;
        id: string;
        object_name: string;
        token: string;
        customerId?: string;
    }

    type BoardType = 'Contacts' | 'Companies' | 'Opportunities' | 'Tasks' | 'Products' | 'General' | 'OptOut' | 'System' | 'KnowledgeHub';

    interface BoardField {
        contact_field?: string;
        data?: Record<string, string>[];
        default_field_name?: string;
        hidden?: boolean;
        hidden_on_record?: boolean;
        is_default: boolean;
        is_identifier?: boolean;
        name: string;
        description?: string;
        type: FieldType;
        _id: string;
        date?: any[];
        is_unique_identifier?: boolean;
        settings?: {
            default_country_code?: string;
            time_zone?: string;
            enable_timezone?: boolean;
            default_currency_code?: string;
        };
        is_dummy?: boolean;
    }

    interface Board {
        business_unit_id: string;
        created_at: string;
        updated_at: string;
        doc_name: string;
        fields: BoardField[];
        id: string;
        name: string;
        description: string;
        organization_id: string;
        public_id: string;
        type: BoardType;
        _id: string;
        hidden: boolean;
        order: number;
        team_ids?: string[];
        journey?: {
            id: string;
            name: string;
            type: ProductType;
            extra?: {
                form_id: string;
                form_name: string;
            };
        };
    }

    interface AgentItem {
        assistant_id: string;
        name: string;
        instructions: string;
    }

    type FieldType =
        | 'ShortText'
        | 'LongText'
        | 'SingleSelection'
        | 'MultipleSelection'
        | 'Number'
        | 'Date'
        | 'Time'
        | 'Email'
        | 'Phone'
        | 'Link'
        | 'Priority'
        | 'Assignee'
        | 'MultipleAssignee'
        | 'RichText'
        | 'Country'
        | 'Datetime'
        | 'Origin'
        | 'Attachment'
        | 'Notes'
        | 'Currency'
        | 'Checkbox';

    interface ContactBoardField {
        board_field_id: string;
        contact_field: string;
        field: BoardField;
        type: FieldType;
        value: string | number | Array<string>;
        _id: string;
    }

    interface BoardRecord {
        id: string;
        board_item_id: string;
        created_type?: 'system' | 'manual';

        [key: string]: string | number | (string | number)[] | null;
    }

    interface AssigneeValue {
        _id: string;
        display_name: string;
    }
    interface CountryValue {
        country_code: CountryCode;
        country_name: string;
    }
    interface PhoneValue {
        calling_code_with_number?: string;
        country_calling_code?: string;
        country_code?: CountryCode;
        national_number?: string;
        phone?: string;
    }

    interface OriginValue {
        type: 'customized' | 'channel' | 'journey';
        data: {
            id?: string;
            type?: string;
            name: string;
        };
    }
    interface AttachmentValue {
        type: 'file' | 'url';
        data: {
            url: string;
            name: string;
            key: string;
            extension?: string;
        };
    }
    interface NotesValue {
        _id: string;
        message: string;
        created_at: Date;
        updated_at: Date;
        author_id: string;
        author_name: string;
        author_avatar?: string;
    }

    interface CurrencyValue {
        amounts?: number;
        currency_code?: string;
    }

    type RecordValue =
        | null
        | string
        | number
        | Date
        | (string | number | null | undefined | Date)[]
        | Record<string, string>
        | AssigneeValue
        | AssigneeValue[]
        | PhoneValue
        | CountryValue
        | OriginValue
        | undefined
        | AttachmentValue[];
    type BoardRecordField = Record<string, RecordValue>;

    interface BoardItem {
        board: Board;
        board_id: string;
        business_unit_id: string;
        contacts?: Contact;
        contact_id?: string;
        created_at: string;
        created_by?: string;
        created_type: 'system' | 'manual';
        doc_name: string;
        fields: BoardRecordField;
        id: string;
        organization_id: string;
        public_id: string;
        updated_at: string;
        _id: string;
        logo_url?: string;
        conversation_ids?: string[];
        board_item_id?: string;
    }

    interface ConversationWithTeams extends Conversation {
        teams: { id: string; name: string }[];
    }

    export interface TeamConversationUserItem {
        object_name: string;
        organization_id: string;
        business_unit_id: string;
        conversation_id: string;
        team_id: string;
        channel_id: string;
        channel_type: string;
        status: string;
        name: string;
        is_joined: boolean;
        contacts_latest_message: ContactsLatestMessage;
        assign_from: string;
        users: any[];
        is_presence: boolean;
    }

    export interface ContactsLatestMessage {
        _id: string;
        type: string;
        content: Content;
        created_at: string;
    }

    export interface Content {
        text: string;
        is_mail: boolean;
        parent_url: string;
    }

    interface NotificationItem {
        object_name: string;
        id: string;
        // conversation name | record name
        title: string;
        // last message | record name
        content: string;
        // team name | user name
        from: string;
        // type of notifications type enum
        type: NotificationsTypeEnum;
        // ActionToTCU(type: 201, 203, 204, 202[admin]) | ActionToTOC(type: 202) | ActionToCRM(type: 101) | ActionToTeamRequest(type: 301 | 302 | 304)
        action_to: ActionToCRM | ActionToTCU | ActionToTOC | ActionToTeamRequest;
        // user id
        recipient: string;
        is_read: boolean;
        created_at: string;
        // whether the action button(CTA) can be used (currently only type 202 will be true)
        action_disable: boolean;
        channel_type?: API.ChannelType;
        grab_type?: GrabTypeEnum;
        grab_at?: string;
        approved_at?: string;
        approver?: string;
    }

    enum GrabTypeEnum {
        OWN = 0,
        INVITE = 1,
        ASSIGN = 2,
    }

    enum NotificationsTypeEnum {
        CRM_ASSIGN = 101,
        NEW_CONVERSATION_PUBLIC = 201,
        NEW_CONVERSATION_GRAB = 202,
        CONVERSATION_INVITE = 203,
        CONVERSATION_ASSIGN = 204,
        TEAM_INVITE = 301,
        TEAM_JOIN_REQUEST = 302,
        TEAM_INVITE_APPROVED = 303,
        TEAM_JOIN_REQUEST_APPROVED = 304,
        TEAM_ADMIN_CAN_LEAVE = 305,
    }

    interface ActionToCRM {
        board_id: string;
        board_item_id: string;
    }

    interface ActionToTCU {
        team_conversation_user_id: string;
    }

    interface ActionToTOC {
        team_own_conversation_id: string;
    }

    interface ActionToTeamRequest {
        team_id: string;
        team_user_id: string;
    }
    interface ActionToLeaveTeam {
        team_id: string;
        team_user_id: string;
    }

    interface AutomationWorkflow {
        board_id: string;
        description: string;
        is_paused: boolean;
        name: string;
        type: 'create' | 'update' | 'delete' | 'scheduled';
        trigger_frequency_value: number;
        trigger_frequency_unit: string;
        trigger_day_of_week: 'sunday' | 'monday' | 'tuesday' | 'wednesday' | 'thursday' | 'friday' | 'saturday';
        start_datetime: string;
        trigger_month_and_day: string;
        trigger_time: string;
        workflow_id: string;
        field_id?: string;
        _id: string;
        updateNeeded: boolean;
    }

    interface LockFeatures {
        teams?: {
            assign_mode?: TeamMode[];
            total?: number;
        };
        analytics?: {
            widget?: {
                operation?: ('create' | 'update' | 'delete')[];
            };
        };
        channels?: {
            each_channel_count?: number;
        };
        credentials?: {
            each_channel_count?: number;
        };
        workflows?: {
            channel_workflow?: {
                count?: number;
            };
            connector_groups?: string[];
            connectors?: Record<string, { count?: number }>;
            automation_workflow?: {
                operation?: ('create' | 'update' | 'delete' | 'active')[];
            };
            data_boards_automation?: {
                operation?: ('create' | 'update' | 'delete' | 'active')[];
            };
        };
    }
    type Operator =
        | 'is'
        | 'is_not'
        | 'contains'
        | 'not_contains'
        | 'is_empty'
        | 'is_not_empty'
        | 'is_smaller_than'
        | 'is_before'
        | 'is_smaller_or_equal_to'
        | 'is_before_and_on'
        | 'is_larger_than'
        | 'is_after'
        | 'is_larger_or_equal_to'
        | 'is_after_and_on'
        | 'is_between'
        | 'is_checked'
        | 'is_not_checked';
    interface Filters {
        field_id?: string;
        operator?: Operator;
        value?: string | (string | number | Date | null)[];
        condition?: 'and' | 'or';
    }
    interface Segmentation {
        _id: string;
        id: string;
        board_id: string;
        doc_name: 'segmentations';
        user_id: string;
        name: string;
        description?: string;
        filters: Filters[];
    }

    interface InteractionROUTE {
        type: 'ROUTE';
        data: {
            url: string;
            type?: string;
        };
    }
    interface InteractionMODAL {
        type: 'MODAL';
        data: {
            type: string;
            url: string | string[];
            [key: string]: string;
        };
    }
    interface InteractionIFRAME {
        type: 'IFRAME';
        data: {
            type?: string;
            url: string;
        };
    }
    type AppInteraction = InteractionROUTE | InteractionMODAL | InteractionIFRAME;
    interface NormalAppMenuItem {
        text: string;
        index: string;
        textColor?: string;
        options?: Record<string, string>;
    }
    interface DividerAppItem {
        type: 'divider';
    }
    type AppMenuItem = NormalAppMenuItem | DividerAppItem;

    type ProductType =
        | 'email_campaign'
        | 'email_outbound'
        | 'facebook_social_media_management'
        | 'ai-assistant_management'
        | 'whatsapp_outbound'
        | 'facebook_leads_management'
        | 'business_contact_collector'
        | 'form_management'
        | 'document_ocr'
        | 'financial_management'
        | 'nvidia_fraud_detection';
    interface Journey {
        _id: string;
        doc_name: string;
        icon: Icon;
        title: string;
        description: string;
        url: string;
        organization_id: string;
        business_unit_id: string;
        version: string;
        workflow_id: string;
        product_id?: string;
        app_type: 'customization' | 'marketplace';
        categories: string[];
        channels_or_platforms: string[];
        public_id: string;
        created_at: string;
        is_active: boolean;
        is_deleted: boolean;
        error?: string;
        channel?: {
            id: string;
            name?: string;
            channel_type?: ChannelType;
        };
        user_progress?: {
            steps: number;
            finished?: boolean;
        };
        options: {
            interaction?: AppInteraction;
            menu?: AppMenuItem[];
        };
        data_board?: Record<
            string,
            {
                board_name: string;
            }
        >;
        product_code: ProductType;
    }

    interface Icon {
        namespace: string;
        name: string;
    }

    interface JourneyLibrary {
        _id: string;
        doc_name: string;
        title: string;
        organization_id: string;
        app_id: string;
        business_unit_id: string;
        version: string;
        description: string;
        is_deleted: boolean;
        is_public: boolean;
        template: Template;
        banner_image: string;
        categories: string[];
        channels_or_platforms: string[];
        public_id: string;
        created_at: string;
        why_use: string;
        brief: string;
        related_products: MarketPlace[];
        max_instances: number;
        installed_app_ids: string[];
        product_code: ProductType;
    }

    interface Template {
        inherit_info: InheritInfo;
        workflow_template: WorkflowTemplate;
        board_templates: any[];
        url: string;
    }

    interface InheritInfo {
        title: string;
        description: string;
        icon: Icon;
        url: string;
        app_type: string;
        version: string;
        organization_id: string;
        categories: any[];
        channels_or_platforms: any[];
    }

    export interface Icon {
        namespace: string;
        name: string;
    }

    export interface WorkflowTemplate {
        id: string;
        name: string;
        active: boolean;
        nodes: Node[];
        tags: Tag[];
    }

    export interface Node {
        name: string;
        type: string;
        typeVersion: number;
        disabled?: boolean;
        parameters: Parameters;
        position: number[];
        webhookId?: string;
    }

    export interface Parameters {
        icsTitle: string;
        path?: string;
        authentication?: string;
        httpMethod?: string;
        responseMode?: string;
        responseCode?: number;
    }

    export interface Tag {
        id: string;
        name: string;
        createdAt: string;
        updatedAt: string;
    }

    interface EmailSender {
        doc_name: string;
        title: string;
        description: string;
        email: string;
        organization_id: string;
        _id: string;
        public_id: string;
        created_at: string;
        user_id: string;
        __v: number;
    }

    interface EmailTemplate {
        _id: string;
        doc_name: string;
        name: string;
        subject: string;
        body: string;
        status: string;
        category: {
            id: string;
            name: string;
            category_id?: string;
        } | null;
        board_id?: string;
        board_name?: string;
        unsubscribe_link?: string;
        unsubscribe_text?: string;
        organization_id: string;
        links: string[];
        attachments: {
            name: string;
            file_id: string;
            url: string;
        }[];
        public_id: string;
        created_at: string;
    }

    interface EmailTemplateCategory {
        _id: string;
        doc_name: string;
        name: string;
        apply_to: string;
        app_id: null;
        organization_id: string;
        public_id: string;
        created_at: string;
        description: string;
    }

    interface TemplateCategory {
        apply_to: string[];
        created_at: string;
        description: string;
        doc_name: string;
        id: string;
        is_default: boolean;
        name: string;
        organization_id: string;
        public_id: string;
        _id: string;
    }

    export interface MarketPlaceFileResp {
        message: string;
        data: MarketPlaceFile;
    }

    export interface MarketPlaceFile {
        doc_name: string;
        name: string;
        organization_id: string;
        short_path: string;
        is_public: boolean;
        size: number;
        file_type: string;
        file_extension: string;
        file_path: string;
        file_url: string;
        TTL: number;
        will_delete_at: null;
        deleted: boolean;
        _id: string;
        createdAt: string;
        updatedAt: string;
        public_id: string;
        created_at: string;
        __v: number;
        id: string;
    }
    interface OpenAIAssistant {
        id: string;
        object: string;
        name: string;
        channel: ChannelType;
        created_at: number;
        description: string | null;
        model: string;
        instructions: string;
        tools: { type: string }[];
        file_ids: string[];
        metadata: Record<string, any>;
        mode: 'standard' | 'advanced';
    }

    interface Resource {
        id: string;
        title: string;
        path: string;
        sections?: Resource[];
        urls: Urls;
        body?: string;
    }

    interface Urls {
        app: string;
    }

    interface Idea {
        _id: string;
        doc_name: string;
        title: string;
        support_free_plan: boolean;
        root_workflow_id: string;
        organization_id: string;
        use_cases: any[];
        price: number;
        template: Template;
        why_use: string;
        brief: string;
        categories: string[];
        channels_or_platforms: string[];
        updated_at: string;
        public_id: string;
        created_at: string;
        related_products: API.Idea[];
        description: string;
        workflow_id?: string;
    }

    interface Template {
        credentials_template?: Record<string, string[]>;
        board_templates: any[];
    }

    interface KnowledgeBaseItem {
        id: string;
        name: string;
        owner: string;
        fileType: string;
        url: string;
        created_at: string;
        updated_at: string;
    }

    interface KnowledgeBaseFile {
        id: string;
        name: string;
        creator: string; // owner
        type: string; // fileType
        url: string;
        created_at: string;
        updated_at: string;

        doc_name: string;
        is_delete: boolean;
        _id: string;
        public_id: string;
    }
    type EventType = 'board_automation' | 'whatsapp_outbound' | 'telegram_outbound' | 'email_outbound' | 'email_campaign';
    interface ScheduledEvent {
        id: string;
        _id: string;
        type: 'recurring' | 'non-recurring';
        name: string;
        event_type: EventType;
        description: string;
        organization_id: string;
        trigger_frequency_unit: 'minutes' | 'hours' | 'days' | 'weeks' | 'months' | 'years';
        trigger_frequency_value: number;
        trigger_time: string;
        start_date: string;
        start_time: string;
        start_datetime: string;
        is_paused: boolean;
        is_finished: boolean;
        channel_source: '' | 'web' | 'line' | 'whatsapp' | 'facebook' | 'instagram';
        created_at: string;
        updated_at: string;
        job: {
            data: {
                board_id?: string;
                id?: string;
                appId?: string;
                apply_to?: string;
                channel?: Channel;
                subject?: string;
                content?: {
                    content: string;
                    files: { id: string; name: string; url: string }[];
                };
                message?: string;
                sender?: {
                    email: string;
                    id: string;
                    name: string;
                };
                outboundType?: string;
                customerPhoneNumber?: string;
                files?: {
                    id: string;
                    isValid: boolean;
                    name: string;
                    status: string;
                }[];
            };
            files?: {
                file_extension: string;
                file_id: string;
                file_path: string;
                file_type: string;
                file_url: string;
                is_public: boolean;
                name: string;
                organization_id: string;
                short_path: string;
                size: number;
            }[];
            topic: string;
            type: string;
            workflow_id: string;
        };
    }
    interface DataImportError {
        row: number;
        error: string;
        data: Record<string, string>;
    }

    interface DataImportSuccess {
        row: number;
        mappedFields: Record<string, string>[];
    }

    interface ImportFileResponse {
        results: {
            total: number;
            successful: number;
            failed: number;
            skipped: number;
            details: {
                errors: DataImportError[];
                skipped: number;
                success: DataImportSuccess[];
                total: number;
            };
        };
    }

    interface ConversationActivity {
        _id: string;
        doc_name: string;
        public_id: string;
        conversation_id: string;
        organization_id: string;
        user: string;
        summary: string;
        sentiment: string;
        importance: string;
        created_at: string;
        updated_at: string;
    }
}
