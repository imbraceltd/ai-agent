import type { FC } from 'react';
import React, { useState } from 'react';
import { useTranslation } from 'react-i18next';
import ReactPlayer from 'react-player';

import UnsupportedMessage from './UnsupportedMessage';

interface VideoMessageProps {
    url?: string;
}

const VideoMessage: FC<VideoMessageProps> = (props) => {
    // test file: https://download.samplelib.com/mp4/sample-5s.mp4
    // const url = 'https://download.samplelib.com/mp4/sample-5s.mp4';

    const { url } = props;
    const { t } = useTranslation();
    const [isReactPlayerError, setIsReactPlayerError] = useState(false);

    if (url) {
        return (
            <ReactPlayer
                url={url}
                width={'100%'}
                height={'200px'}
                controls={true}
                onError={(error, data) => {
                    console.log(error, data);
                    setIsReactPlayerError(true);
                }}
            />
        );
    }

    if (isReactPlayerError) {
        return <UnsupportedMessage text={t('unsupported_video')} />;
    }

    return <UnsupportedMessage text={t('unsupported_video')} />;
};

export default VideoMessage;
