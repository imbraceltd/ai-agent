import Mail from '@mui/icons-material/Mail';

const MailIcon = ({ iconWidth }: { iconWidth?: number }) => (
    <div
        style={{
            background: '#ee8d17',
            borderRadius: '50%',
            display: 'flex',
            alignContent: 'center',
            justifyContent: 'center',
            width: '100%',
            height: '100%',
        }}
    >
        <Mail sx={{ width: iconWidth ?? 16, height: '100%', fill: 'white' }} />
    </div>
);

export default MailIcon;
