import { Box } from '@mui/material';
import { styled } from '@mui/material/styles';

interface ExpandProps {
    expand: boolean;
}
export const StyledExpandMore = styled(Box, { shouldForwardProp: (props) => props !== 'expand' })<ExpandProps>(({ theme, expand }) => ({
    display: 'flex',
    justifyContent: 'flex-end',
    alignItems: 'center',
    transform: !expand ? 'rotate(0deg)' : 'rotate(180deg)',
    marginLeft: 'auto',
    transition: theme.transitions.create('transform', {
        duration: theme.transitions.duration.shortest,
    }),
}));
