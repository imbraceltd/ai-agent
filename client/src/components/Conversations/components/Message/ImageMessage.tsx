import { Icon, Space, Typography } from '@imbrace/ui';
import { Image } from 'antd';
import type { FC } from 'react';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import Linkify from 'react-linkify';
import { env } from '../../../../env';
import styles from './index.module.scss';
import PDFMessage from './pdfMessage';
import UnsupportedMessage from './UnsupportedMessage';

interface ImageMessageProps {
    imageSrc?: string;
    imageCaption?: string | null;
    createdAt: string;
    onLoad?: () => void;
}

const ImageMessage: FC<ImageMessageProps> = (props) => {
    const { imageSrc, createdAt, imageCaption, onLoad } = props;
    const [isImageError, setIsImageError] = useState(false);
    const { t } = useTranslation();

    useEffect(() => {
        onLoad?.();
    }, [onLoad]);
    const src = useMemo(() => {
        return imageSrc?.replace(env.VITE_APP_API_HOST, '/api');
    }, [imageSrc]);
    if (imageSrc?.includes('.pdf')) {
        return <PDFMessage url={imageSrc} createdAt={createdAt} />;
    }

    if (isImageError) {
        return <UnsupportedMessage />;
    }

    return (
        <>
            {src && (
                <Image
                    src={src}
                    onError={() => {
                        setIsImageError(true);
                    }}
                    rootClassName={'imagePreview'}
                    preview={{
                        mask: (
                            <Space align="center" size={4} justify="center">
                                <Icon name="visibility" />
                                <Typography>{t('preview')}</Typography>
                            </Space>
                        ),
                    }}
                />
            )}
            <Typography className={styles.messageContentText}>
                <Linkify
                    componentDecorator={(decoratedHref, decoratedText, key) => (
                        <a target="_blank" rel="noreferrer" href={decoratedHref} key={key}>
                            {decoratedText}
                        </a>
                    )}
                >
                    {imageCaption}
                </Linkify>
            </Typography>
        </>
    );
};

export default ImageMessage;
