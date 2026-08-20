import ErrorIcon from '@mui/icons-material/Error';
import { Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

import clsx from '@/utils/clsx';

import styles from './index.module.scss';

const UnsupportedMessage = ({ text }: { text?: string }) => {
    const { t } = useTranslation();
    return (
        <Typography className={clsx(styles.messageContentText, styles.error)} variant="caption">
            <ErrorIcon /> {text || t('unsupported_message')}
        </Typography>
    );
};

export default UnsupportedMessage;
