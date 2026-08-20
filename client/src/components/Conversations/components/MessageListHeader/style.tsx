import { MenuItem, Select } from '@mui/material';
import styled from '@mui/material/styles/styled';

const StatusSelectStyle = {
    active: 'var(--color-primary-1)',
    closed: 'var(--color-light-5)',
    spam: 'var(--color-danger-5)',
    agent_needed: '',
    'soon to be': '',
    overdue: '',
    'rep needed': '',
    unassigned: '',
    pending: '',
    online: '',
};

interface StyledSelectProps {
    status?: API.StatusType;
}

export const StyledSelect = styled(Select, {
    shouldForwardProp: (prop) => prop !== 'status',
})<StyledSelectProps>(({ theme, status }) => ({
    border: 0,
    maxWidth: '180px',
    fontSize: 16,
    width: '180px',
    height: '36px',
    margin: '7px 2px 9px 15px',
    padding: '6px 10px 6px 14px',
    borderRadius: 0,
    '& .MuiSelect-select': {
        padding: '1px 22px 1px 9px',
        borderRadius: 0,
        borderLeftWidth: '5px',
        borderLeftStyle: 'solid',
        borderLeftColor: status ? StatusSelectStyle[status] : '',
        '&.MuiInputBase-input.MuiOutlinedInput-input': {
            paddingRight: '22px',
        },
        '&.MuiInputBase-input.MuiOutlinedInput-input:focus': {
            borderRadius: 0,
        },
    },
    '& .MuiSelect-icon': {
        right: 0,
        color: 'var(--color-light-5)',
        borderRadius: 0,
    },
}));
export const StyledMenuItem = styled(MenuItem, {
    shouldForwardProp: (prop) => prop !== 'status',
})<StyledSelectProps>(({ theme, status }) => ({
    margin: '8px 0px 8px 10px',
    borderLeftWidth: '5px',
    borderLeftStyle: 'solid',
    borderLeftColor: status ? StatusSelectStyle[status] : '',
}));
