import CheckIcon from '@mui/icons-material/Check';
import type { SxProps } from '@mui/material';
import type { IconButtonProps } from '@mui/material/IconButton';
import IconButton from '@mui/material/IconButton';
import type { FC, ReactNode } from 'react';

import clsx from '@/utils/clsx';

import styles from './index.module.scss';

interface ChannelButtonProps extends IconButtonProps {
    icon: ReactNode;
    isCheck?: boolean;
    sx?: SxProps;
}

const ChannelButton: FC<ChannelButtonProps> = (props) => {
    const { icon, size, onClick, isCheck, sx } = props;

    return (
        <IconButton
            onClick={onClick}
            size={size}
            sx={{
                ...sx,
                boxSizing: 'border-box',
                width: '40px',
                height: '40px',
                border: '1px solid #f2f2f2',
                borderRadius: '50%',
                backgroundColor: '#fff',
                position: 'relative',
            }}
        >
            {icon}
            <div className={clsx(styles.channelButton, isCheck ? styles.selected : '')}>
                {isCheck && <CheckIcon color="inherit" fontSize="small" sx={{ width: '100%' }} />}
            </div>
        </IconButton>
    );
};

export default ChannelButton;
