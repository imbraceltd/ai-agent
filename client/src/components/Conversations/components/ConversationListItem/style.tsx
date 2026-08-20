import { ListItemAvatar } from '@mui/material';
import styled from '@mui/material/styles/styled';

export const StyledListItemAvatar = styled(ListItemAvatar)(() => ({
    boxSizing: 'border-box',
    minWidth: '40px',
    height: '40px',
    width: '40px',
    border: '1px solid #f2f2f2',
    borderRadius: '50%',
    padding: '6px',
    backgroundColor: '#fff',
    display: 'flex',
    flexShrink: 0,
}));
