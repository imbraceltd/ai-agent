import { Avatar as MuiAvatar } from '@mui/material';
import { useEffect, useState } from 'react';

import { stringAvatarName, stringToColor } from '@/utils/AvatarHelper';

export interface AvatarProps {
    avatarUrl?: string;
    isActive?: boolean;
    backgroundColor?: string;
    displayName?: string;
    firstName?: string;
    lastName?: string;
    width?: number | string;
    height?: number | string;
    fontSize?: number | string;
    bgIcon?: JSX.Element;
}
const Avatar = (props: AvatarProps) => {
    const {
        bgIcon,
        avatarUrl,
        isActive,
        backgroundColor,
        displayName = '',
        firstName,
        lastName,
        width = 35,
        height = 35,
        fontSize = 14,
    } = props;
    const [actualDisplayName, setActualDisplayName] = useState<string>('');
    useEffect(() => {
        if ((!firstName && !lastName) || (firstName?.length === 0 && lastName?.length === 0)) {
            setActualDisplayName('');
            return;
        }
        setActualDisplayName(displayName);
    }, [displayName, firstName, lastName]);

    return (
        <MuiAvatar
            sx={{
                backgroundColor: backgroundColor || stringToColor(actualDisplayName || `${firstName}${lastName}`),
                opacity: isActive ? 1 : 0.2,
                width,
                height,
                fontSize,
                color: 'white',
                '& svg': {
                    color: 'white !important',
                },
            }}
            src={avatarUrl || ''}
            children={
                (!avatarUrl || avatarUrl?.trim().length === 0) && !firstName && !lastName && actualDisplayName === ''
                    ? bgIcon
                        ? bgIcon
                        : null
                    : stringAvatarName(actualDisplayName, firstName, lastName)
            }
        />
    );
};
export default Avatar;
