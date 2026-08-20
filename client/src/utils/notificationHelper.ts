import type { OptionsObject } from 'notistack';

const toastTopRight: OptionsObject['anchorOrigin'] = {
    horizontal: 'right',
    vertical: 'top',
};

const waringTopRight = {
    messageType: 'noti_warning',
    variant: 'warning',
    anchorOrigin: toastTopRight,
};

export { waringTopRight };
