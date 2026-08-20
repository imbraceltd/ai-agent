import { Button, Space, Typography } from '@imbrace/ui';
import type { FC } from 'react';
import Linkify from 'react-linkify';

import styles from './index.module.scss';

interface MultipleChoiceMessageProps {
    content?: string;
    quickReplies?: API.QuickReplyElement[];
}

const MultipleChoiceMessage: FC<MultipleChoiceMessageProps> = (props) => {
    const { content, quickReplies } = props;

    return (
        <Space size={4} align="start" direction="vertical">
            <Typography>
                <Linkify
                    componentDecorator={(decoratedHref, decoratedText, key) => (
                        <Typography className={styles.link}>
                            <a target="_blank" rel="noreferrer" href={decoratedHref} key={key}>
                                {decoratedText}
                            </a>
                        </Typography>
                    )}
                >
                    {content}
                </Linkify>
            </Typography>
            {quickReplies?.map((reply) => {
                return (
                    <Button
                        variant="outlined"
                        type="secondary"
                        size="l"
                        key={reply.id}
                        disabled
                        sx={{
                            textTransform: 'initial',
                            color: 'var(--color-primary-9) !important',
                            borderColor: 'var(--color-primary-9) !important',
                        }}
                        text={
                            <Space direction="vertical" size={0}>
                                <Typography>{reply.title}</Typography>
                                <Typography>{reply.description}</Typography>
                            </Space>
                        }
                    />
                );
            })}
        </Space>
    );
};

export default MultipleChoiceMessage;
