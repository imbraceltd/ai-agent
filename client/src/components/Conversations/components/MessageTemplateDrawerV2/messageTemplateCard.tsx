import { EllipsisText, Space, Typography } from '@imbrace/ui';
import { ButtonBase, Card } from '@mui/material';

import MessageTemplatePreview from '@/pages/Templates/messageTemplatePreivew';

export interface MessageTemplateDataType {
    id: string;
    title: string;
    content: string;
    status?: 'APPROVED' | 'PENDING' | 'REJECTED';
    language?: string;
}

interface MessageTemplateCardProps {
    item: API.MessageTemplate;
    messageTemplateOnClick: (template: MessageTemplateDataType) => void;
}

const MessageTemplateCard = (props: MessageTemplateCardProps) => {
    const { messageTemplateOnClick } = props;
    const { id, title, text } = props.item;

    const handleClick = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e.stopPropagation();
        messageTemplateOnClick({ id, title, content: text });
    };

    return (
        <ButtonBase onClick={handleClick} sx={{ width: '100%' }}>
            <Card
                sx={{
                    width: '100%',
                    height: '80px',
                    border: 0,
                    padding: '8px 16px',
                    margin: 0,
                    boxShadow: 'none',
                    display: 'flex',
                    justifyContent: 'flex-start',
                    '&:hover': { backgroundColor: 'var(--color-secondary-2)' },
                }}
            >
                <Space direction="vertical" align="start" justify="stretch" style={{ width: '100%', gap: '4px', textAlign: 'left' }}>
                    <EllipsisText
                        element={<Typography variant="SubHeading2" style={{ width: '426px', color: 'var(--color-light-7)' }} />}
                        text={title}
                    />
                    <EllipsisText
                        element={
                            <Typography
                                style={{
                                    color: 'var(--color-light-5)',
                                    width: '426px',
                                    height: '40px',
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    WebkitLineClamp: 2,
                                    display: '-webkit-box',
                                    WebkitBoxOrient: 'vertical',
                                    lineHeight: '20px',
                                }}
                            />
                        }
                        whiteSpace="pre-wrap"
                        text={text}
                    />
                </Space>
                <Space justify="center" style={{ width: '32px' }}>
                    <MessageTemplatePreview messageTemplate={props.item} />
                </Space>
            </Card>
        </ButtonBase>
    );
};

export default MessageTemplateCard;
