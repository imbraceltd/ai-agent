declare namespace FormManagement {
    interface FormField extends Omit<API.BoardField, '_id'> {
        title: string;
        required?: boolean;
        placeholder?: string;
    }
    type Form = {
        fields: FormField[];
        _id: string;
        data_board_id?: string;
        submit_button_text?: string;
        footer?: string;
        header?: string;
        sub_header?: string;
        banner_image?: string;
        description?: string;
        name: string;
        submitted_count: number;
        board_name: string;
        owner?: {
            user_id: string;
            user_name: string;
        };
        teams?: {
            team_id: string;
            team_name: string;
        }[];
        updated_at: string;
        is_active: boolean;
        logo?: string;
    };
}
