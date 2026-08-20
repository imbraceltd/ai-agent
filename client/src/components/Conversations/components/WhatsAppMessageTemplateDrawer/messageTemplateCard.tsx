import { EllipsisText, Space, Tooltip, Typography } from '@imbrace/ui';
import { Badge, Card } from '@mui/material';
import type { FC } from 'react';
import React from 'react';
import { useTranslation } from 'react-i18next';

import MessageTemplatePreview from '@/pages/Templates/messageTemplatePreivew';

export interface MessageTemplateDataType {
    id: string;
    title: string;
    content: string;
    status?: 'APPROVED' | 'PENDING' | 'REJECTED';
    language?: string;
}

interface MessageTemplateCardProps extends MessageTemplateDataType {
    messageTemplateOnClick: (template: MessageTemplateDataType) => void;
}

export const statusMapping = {
    APPROVED: {
        color: 'var(--color-green-1)',
        text: 'approved',
    },
    PENDING: {
        color: 'var(--color-accent-yellow-3)',
        text: 'pending',
    },
    REJECTED: {
        color: 'var(--color-danger-1)',
        text: 'rejected',
    },
};

const MessageTemplateCard: FC<MessageTemplateCardProps> = (props) => {
    const { id, title, content, status, messageTemplateOnClick } = props;
    const { t } = useTranslation();

    const handleClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        if (status !== 'APPROVED') return;
        messageTemplateOnClick({ id, title, content, status });
    };

    return (
        <Card
            sx={{
                width: '100%',
                height: '80px',
                border: 0,
                padding: '8px 16px 8px 7px',
                margin: 0,
                boxShadow: 'none',
                display: 'flex',
                justifyContent: 'flex-start',
                cursor: status === 'APPROVED' ? 'pointer' : 'not-allowed',
                '&:hover': { backgroundColor: 'var(--color-secondary-2)' },
            }}
            onClick={handleClick}
        >
            <Space direction="vertical" align="start" justify="stretch" style={{ width: '100%', gap: '4px', textAlign: 'left' }}>
                <Space style={{ width: '100%' }}>
                    <Tooltip arrow title={status ? t(statusMapping[status]?.text) : ''} placement="top">
                        <Badge
                            variant="dot"
                            sx={{
                                width: '8px',
                                height: '8px',
                                borderRadius: '1px',
                                backgroundColor: status ? statusMapping[status]?.color : '',
                            }}
                        ></Badge>
                    </Tooltip>
                    <EllipsisText
                        text={title}
                        element={
                            <Typography
                                variant="SubHeading2"
                                style={{
                                    overflow: 'hidden',
                                    textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap',
                                    wordBreak: 'break-word',
                                    color: 'var(--color-light-7)',
                                }}
                            />
                        }
                    />
                </Space>
                <Typography
                    style={{
                        color: 'var(--color-light-5)',
                        width: '426px',
                        height: '40px',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                        display: 'block',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-word',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        lineHeight: '20px',
                        paddingLeft: '18px',
                    }}
                >
                    {content}
                </Typography>
            </Space>
            <Space justify="center" style={{ width: '32px' }}>
                <MessageTemplatePreview
                    messageTemplate={
                        {
                            id: id,
                            title: title,
                            text: content,
                        } as API.MessageTemplate
                    }
                />
            </Space>
        </Card>
    );
};

export default MessageTemplateCard;
