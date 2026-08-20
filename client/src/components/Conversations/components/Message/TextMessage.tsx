import { Typography } from '@imbrace/ui';
import type { FC } from 'react';
import Linkify from 'react-linkify';

import styles from './index.module.scss';

interface TextMessageProps {
    content?: string;
    description?: string;
}

const TextMessage: FC<TextMessageProps> = (props) => {
    const { content, description } = props;

    return (
        <>
            <Typography className={styles.messageContentText}>
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
            {description && <Typography className={styles.messageContentText}>{description}</Typography>}
        </>
    );
};

export default TextMessage;
