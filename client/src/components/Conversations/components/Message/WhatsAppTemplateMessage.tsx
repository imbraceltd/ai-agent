import Typography from '@mui/material/Typography';
import type { FC } from 'react';
import Linkify from 'react-linkify';

import styles from './index.module.scss';

interface WhatsAppTemplateMessageProps {
    content?: {
        text?: string;
        variables?: string[];
    };
}

const WhatsAppTemplateMessage: FC<WhatsAppTemplateMessageProps> = (props) => {
    const { content } = props;

    const renderMessage = () => {
        if (content) {
            const { text, variables } = content;

            let message = text || '';
            variables?.forEach((variable, index) => {
                message = message.replace(`{{${index + 1}}}`, variable);
            });
            return message;
        }
        return '';
    };

    return (
        <Typography variant="body1" className={styles.messageContentText}>
            <Linkify>{renderMessage()}</Linkify>
        </Typography>
    );
};

export default WhatsAppTemplateMessage;
