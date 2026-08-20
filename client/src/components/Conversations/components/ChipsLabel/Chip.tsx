import { Icon, IconButton, Typography } from '@imbrace/ui';
import type { FC } from 'react';

import clsx from '@/utils/clsx';

import styles from './index.module.scss';

interface ChipType {
    id: string;
    label: string;
    onDeleteLabel?: (key: string) => void;
    showDeleteChipIcon: boolean;
    selectMode?: boolean;
    onAddLabel?: (data: API.TeamConversationLabel) => void;
    backgroundColor: string;
    chipData: API.TeamConversationLabel;
    viewModalMode?: boolean;
    labelClick?: (clickLabel?: string) => void;
}
const Chip: FC<ChipType> = (props) => {
    const {
        id,
        label,
        onDeleteLabel,
        showDeleteChipIcon,
        selectMode = false,
        onAddLabel,
        backgroundColor,
        chipData,
        viewModalMode = false,
        labelClick,
    } = props;
    return (
        <div
            className={styles.chipsLabel}
            onClick={() => (selectMode ? onAddLabel && onAddLabel(chipData) : !viewModalMode && labelClick && labelClick())}
        >
            <Typography
                variant="Caption"
                className={clsx(styles.chip, styles.chipMargin)}
                style={{ backgroundColor: backgroundColor, cursor: viewModalMode ? 'default' : 'pointer' }}
            >
                {label}
                {showDeleteChipIcon && !selectMode && (
                    <IconButton className={styles.chipDelete} sx={{ padding: 0 }} onClick={() => onDeleteLabel && onDeleteLabel(id)}>
                        <Icon name="close" style={{ fontSize: '14px' }} />
                    </IconButton>
                )}
            </Typography>
        </div>
    );
};

export default Chip;
