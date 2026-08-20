import { Icon, IconButton, Space, Typography } from '@imbrace/ui';
import { Popover } from '@mui/material';
import { type FC, useState } from 'react';
import Scrollbars from 'react-custom-scrollbars';

import clsx from '@/utils/clsx';

import Chip from './Chip';
import ChipAdd from './ChipAdd';
import styles from './index.module.scss';

interface ChipsLabelType {
    data: API.TeamConversationLabel[];
    editCommentMode: boolean;
    onSave?: () => void;
    onDeleteLabel?: (key: string) => void;
    setIsShownAddLabel?: (shownAddLabel: boolean) => void;
    isShownAddLabel?: boolean;
    onDeleteComment?: () => void;
    isFromConversation?: boolean;
    onShowMessage?: () => void;
    showDeleteIcon?: boolean;
    viewModalMode?: boolean;
    msgId?: string;
}
const ChipsLabel: FC<ChipsLabelType> = (props) => {
    const {
        data,
        editCommentMode,
        onSave,
        onDeleteLabel,
        setIsShownAddLabel,
        isShownAddLabel,
        onDeleteComment,
        isFromConversation,
        onShowMessage,
        showDeleteIcon,
        viewModalMode = false,
    } = props;
    const [tagContainerWidth, setTagContainerWidth] = useState(0);
    const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);
    const open = Boolean(anchorEl);
    const hasMoreChip = data && data.length > 1;

    const handlePopoverOpen = (event: React.MouseEvent<HTMLElement>) => {
        if (hasMoreChip) {
            setAnchorEl(event.currentTarget);
        }
    };

    const handlePopoverClose = () => {
        setAnchorEl(null);
    };

    const addLabelClick = (clickLabel?: string) => {
        if (clickLabel && clickLabel === 'add') setIsShownAddLabel && setIsShownAddLabel(true);
    };

    const renderChipsLabels = () => {
        let showAddLabel = false;
        let showDeleteChipIcon = false;
        const notConversationButEditMode = !isFromConversation && editCommentMode;
        const isConversationButNoLabelDataOrSelectNotOpen = !viewModalMode && isFromConversation && (data.length === 0 || !isShownAddLabel);

        if (notConversationButEditMode || isConversationButNoLabelDataOrSelectNotOpen) {
            showAddLabel = true;
        }

        if ((!isFromConversation && editCommentMode) || (isFromConversation && !viewModalMode)) {
            showDeleteChipIcon = true;
        }

        return (
            <div className={clsx(styles.chipsLabels, editCommentMode ? styles.chipsEditLabels : '')}>
                <div className={clsx(editCommentMode ? styles.chipsLabelsView : styles.chipsLabelsShowMore, styles.noScrollbars)}>
                    {data &&
                        data.length > 0 &&
                        data.map((chip, chipIndex) => {
                            return (
                                <Chip
                                    key={chipIndex}
                                    showDeleteChipIcon={showDeleteChipIcon || (!!isFromConversation && !viewModalMode)}
                                    onDeleteLabel={onDeleteLabel}
                                    id={chip._id}
                                    label={chip.name}
                                    backgroundColor={chip.color}
                                    chipData={chip}
                                    viewModalMode={viewModalMode}
                                    labelClick={addLabelClick}
                                />
                            );
                        })}
                    {showAddLabel && <ChipAdd addLabelClick={addLabelClick} />}
                </div>
                {editCommentMode && (
                    <>
                        {!isFromConversation && (
                            <IconButton
                                variant="text"
                                type="secondary"
                                size="xs"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onSave?.();
                                }}
                            >
                                <Icon name="save" />
                            </IconButton>
                        )}
                        {isFromConversation && showDeleteIcon && !viewModalMode && (
                            <IconButton
                                variant="text"
                                type="secondary"
                                size="xs"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    onDeleteComment?.();
                                }}
                            >
                                <Icon name="delete" />
                            </IconButton>
                        )}
                    </>
                )}
            </div>
        );
    };

    return (
        <div className={styles.chipsContainer}>
            {editCommentMode || isFromConversation ? (
                <div className={styles.chipsLabelContainer}> {renderChipsLabels()} </div>
            ) : (
                <Space
                    justify="between"
                    style={{ width: '100%' }}
                    containerRef={(ref) => {
                        if (ref) {
                            setTagContainerWidth(ref.getBoundingClientRect().width);
                        }
                    }}
                >
                    <div className={styles.chipsLabels} onMouseEnter={handlePopoverOpen}>
                        <div className={styles.chipsLabelsRelative}>
                            <div className={styles.chipIndex}>
                                <Typography variant="Caption" className={styles.chip} style={{ backgroundColor: data?.[0]?.color }}>
                                    {data?.[0]?.name}
                                </Typography>
                            </div>
                            <Popover
                                open={open}
                                anchorEl={anchorEl}
                                onClose={handlePopoverClose}
                                anchorOrigin={{
                                    vertical: 'center',
                                    horizontal: 'left',
                                }}
                                transformOrigin={{
                                    vertical: 'center',
                                    horizontal: 8,
                                }}
                                slotProps={{
                                    paper: {
                                        sx: {
                                            width: tagContainerWidth + 16 || '220px',
                                            overflow: 'hidden',
                                            padding: '8px',
                                            marginTop: '4px',
                                            boxShadow:
                                                '0px 16px 24px 0px rgba(224, 224, 224, 0.20), 0px 0px 4px 0px rgba(224, 224, 224, 0.88)',
                                        },
                                        onMouseLeave: () => {
                                            setAnchorEl(null);
                                        },
                                    },
                                }}
                            >
                                <Scrollbars autoHeight autoHide autoHeightMax={80}>
                                    <Space size={4} wrap align="start">
                                        {renderChipsLabels()}
                                    </Space>
                                </Scrollbars>
                            </Popover>
                            {hasMoreChip && (
                                <div className={styles.chipsLabelMore}>
                                    <Typography variant="Caption" className={styles.chipsLabelMoreText}>
                                        +{data?.length - 1}
                                    </Typography>
                                </div>
                            )}
                        </div>
                    </div>

                    <div onClick={onShowMessage}>
                        <IconButton type="secondary" variant="text" size="xs" sx={{ padding: 0 }} onClick={onShowMessage}>
                            <Icon name="chevronRight" style={{ fontSize: 18 }} />
                        </IconButton>
                    </div>
                </Space>
            )}
        </div>
    );
};

export default ChipsLabel;
