import VideocamOutlinedIcon from '@mui/icons-material/VideocamOutlined';
import Typography from '@mui/material/Typography';
import type { FC } from 'react';
import React from 'react';
import Linkify from 'react-linkify';

import styles from './index.module.scss';

interface VideoCallMessageProps {
    content?: string;
    url?: string;
}

const VideoCallMessage: FC<VideoCallMessageProps> = (props) => {
    const { content, url } = props;

    const openLink = () => {
        if (url) {
            window.open(url, '_blank');
        }
    };

    return (
        <React.Fragment>
            <Typography variant="body1" className={styles.messageContentText} sx={{ fontSize: '0.875rem' }}>
                <Linkify
                    componentDecorator={(decoratedHref, decoratedText, key) => (
                        <a target="blank" href={decoratedHref} key={key}>
                            {decoratedText.slice(0, decoratedHref.indexOf('?'))}
                        </a>
                    )}
                >
                    {content?.split('http').join('\nhttp')}
                </Linkify>
            </Typography>
            <div className={styles.messageContentVideoCallBanner} onClick={openLink}>
                <div className={styles.videoCallBannerIcon}>
                    <VideocamOutlinedIcon sx={{ fontSize: '2em', color: 'white' }} />
                </div>
                <div className={styles.videoCallBannerMessage}>
                    <Typography variant="caption" sx={{ color: 'white' }} fontWeight="bold">
                        Video Conference
                    </Typography>
                    <Typography variant="caption" sx={{ color: 'white' }} paragraph m={0}>
                        Come and join the video call
                    </Typography>
                </div>
            </div>
        </React.Fragment>
    );
};

export default VideoCallMessage;
