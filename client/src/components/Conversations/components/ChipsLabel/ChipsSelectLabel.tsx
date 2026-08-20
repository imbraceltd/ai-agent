import { Divider, Typography } from '@mui/material';
import type { FC } from 'react';
import { useTranslation } from 'react-i18next';

import clsx from '@/utils/clsx';

import Chip from './Chip';
import styles from './index.module.scss';

interface ChipsSelectLabelType {
    data?: API.TeamConversationLabel[];
    onAddLabel?: (data: API.TeamConversationLabel) => void;
}
const ChipsSelectLabel: FC<ChipsSelectLabelType> = (props) => {
    const { t } = useTranslation();
    const { data, onAddLabel } = props;
    return (
        <div className={styles.chipsSelectLabelContainer}>
            <Typography className={styles.selectLabelTitle}> {t('form_select_label')} </Typography>
            <Divider orientation="horizontal" variant="fullWidth" sx={{ width: '100%', margin: '10px 0' }} />
            <div className={clsx(styles.chipsSelectLabel, styles.noScrollbars)}>
                <div className={styles.chipsLabelContainer} style={{ padding: 0 }}>
                    <div className={styles.chipsLabels}>
                        {data &&
                            data.map((chip) => {
                                return (
                                    <Chip
                                        key={chip._id}
                                        id={chip._id}
                                        label={chip.name}
                                        showDeleteChipIcon={false}
                                        selectMode
                                        onAddLabel={onAddLabel}
                                        backgroundColor={chip.color}
                                        chipData={chip}
                                    />
                                );
                            })}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default ChipsSelectLabel;
