import { EllipsisText, Tooltip, Typography } from '@imbrace/ui';
import { ArrowDropDown as ArrowDropDownIcon } from '@mui/icons-material';
import { Badge, Box, ButtonBase, Card, Chip, Collapse } from '@mui/material';
import type { FC } from 'react';
import React, { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';

import { langMapping } from '../WhatsAppMessageTemplateDrawer/languageHelper';
import styles from './index.module.scss';
import { StyledExpandMore } from './style';

const fontSize = 14;
const lineHeight = 1.5;
const contentRowHeight = fontSize * lineHeight;

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

const statusMapping = {
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
    const { id, title, content, status, language, messageTemplateOnClick } = props;
    const { t } = useTranslation();
    const [expanded, setExpanded] = useState(false);
    const [contentOffset, setContentOffset] = useState(0);
    const contentRef = useRef<HTMLDivElement>(null);

    const handleExpandClick = (e: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
        e.stopPropagation();
        setExpanded(!expanded);
    };

    const isContentOverflow = (rowHeight: number, offsetHeight: number) => {
        return Math.ceil(rowHeight) < offsetHeight;
    };

    const handleClick = (e: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
        e.stopPropagation();
        messageTemplateOnClick({ id, title, content, status });
    };

    useEffect(() => {
        setContentOffset(contentRef?.current?.offsetHeight || 0);
    }, [contentRef, contentRef?.current?.offsetHeight]);

    return (
        <ButtonBase onClick={handleClick} className={styles.msgTemplateDrawerCardRoot}>
            <Card
                className={styles.msgTemplateDrawerCardContainer}
                style={{
                    cursor: status ? (status === 'APPROVED' ? 'pointer' : 'not-allowed') : 'pointer',
                }}
            >
                <Box sx={{ width: '100%', display: 'flex', justifyContent: 'space-between' }}>
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
                    <Box
                        sx={{
                            height: '24px',
                            display: 'flex',
                            justifyContent: 'center',
                            alignItems: 'center',
                            gap: '6px',
                        }}
                    >
                        {language && (
                            <Chip
                                label={langMapping[language]}
                                sx={{
                                    height: '16px',
                                    '& .MuiChip-label': { fontSize: '10px', paddingLeft: '6px', paddingRight: '6px' },
                                }}
                            />
                        )}
                        <Tooltip arrow title={status ? t(statusMapping[status]?.text) : ''} placement="top">
                            <Badge
                                variant="dot"
                                sx={{
                                    width: '12px',
                                    height: '12px',
                                    borderRadius: '50%',
                                    backgroundColor: status ? statusMapping[status]?.color : '',
                                }}
                            ></Badge>
                        </Tooltip>
                    </Box>
                </Box>

                <Box className={styles.msgTemplateDrawerCardContent}>
                    <Collapse in={expanded} timeout="auto" collapsedSize={contentRowHeight * 2}>
                        <Box ref={contentRef} sx={{ display: 'flex', flexDirection: 'column', width: '100%' }}>
                            <div>
                                <Typography variant="Body" className={styles.msgTemplateDrawerCardContent}>
                                    {content}
                                </Typography>
                            </div>
                        </Box>
                    </Collapse>
                    <Box>
                        {isContentOverflow(contentRowHeight, contentOffset) && (
                            <Box className={styles.expandBtnContainer}>
                                <StyledExpandMore
                                    expand={expanded}
                                    onClick={handleExpandClick}
                                    aria-expanded={expanded}
                                    aria-label="show more"
                                >
                                    <ArrowDropDownIcon />
                                </StyledExpandMore>
                            </Box>
                        )}
                    </Box>
                </Box>
            </Card>
        </ButtonBase>
    );
};

export default MessageTemplateCard;
