import { Icon } from '@imbrace/ui';
import moment from 'moment';
import { useEffect, useState } from 'react';

import styles from './index.module.scss';

const PDFMessage = ({ url, createdAt, caption }: { url: string; createdAt: string; caption?: string }) => {
    const [fileSize, setFileSize] = useState<number>();

    useEffect(() => {
        const checkSize = async () => {
            try {
                if (url) {
                    const resp = await fetch(url, {
                        method: 'HEAD',
                    });
                    const contentLength = resp.headers.get('Content-Length');
                    if (contentLength) {
                        setFileSize(parseInt(contentLength, 10) / 1024 / 1024);
                    }
                }
            } catch (error) {
                console.log(error);
            }
        };
        checkSize();
    }, [url]);

    return (
        <div className={styles.pdfMessage}>
            <a href={url} target="_blank" rel="noreferrer" download>
                <Icon namespace="file" name="pdf" />
                <div>
                    <span>
                        <strong>{`${caption ? `${caption}.pdf` : moment(createdAt).format('dddd ll')}`}</strong>
                    </span>
                    {typeof fileSize !== 'undefined' && <span>{`${fileSize?.toFixed(1)}MB`}</span>}
                </div>
            </a>
        </div>
    );
};

export default PDFMessage;
