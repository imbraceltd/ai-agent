import { Icon, IconButton, Typography } from '@imbrace/ui';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';

import styles from './index.module.scss';

interface ChipAddType {
    isShownAddLabel?: boolean;
    addLabelClick?: (clickLabel?: string) => void;
}
const ChipAdd: FC<ChipAddType> = (props) => {
    const { t } = useTranslation();
    const { addLabelClick } = props;

    return (
        <IconButton
            variant="text"
            type="secondary"
            sx={{ padding: '0', textTransform: 'capitalize' }}
            onClick={() => addLabelClick && addLabelClick('add')}
            className={`${styles.chipsLabelAdd} ${styles.chip}`}
        >
            <Icon name="add" className={styles.addIcon} style={{ fontSize: '12px', marginRight: '6px' }} />
            <Typography variant="Caption">{t('form_add_label')}</Typography>
        </IconButton>
    );
};

export default ChipAdd;
