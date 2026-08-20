import { isNullString } from './StringHelper';

export function stringToColor(string: string) {
    if (isNullString(string)) return '#ccc';

    let hash = 0;
    let i;

    /* eslint-disable no-bitwise */
    for (i = 0; i < string.length; i += 1) {
        hash = string.charCodeAt(i) + ((hash << 5) - hash);
    }

    let color = '#';

    for (i = 0; i < 3; i += 1) {
        const value = (hash >> (i * 8)) & 0xff;
        color += `00${value.toString(16)}`.substr(-2);
    }
    /* eslint-enable no-bitwise */

    return color;
}

export function stringAvatarName(displayName: string, firstName?: string, lastName?: string) {
    const firstNameInitial = !isNullString(firstName) && typeof firstName === 'string' ? firstName.toUpperCase()[0] : '';
    const lastNameInitial = !isNullString(lastName) && typeof lastName === 'string' ? lastName.toUpperCase()[0] : '';

    if (displayName?.toLowerCase().startsWith('guest')) {
        return 'GU';
    }

    if (isNullString(firstName) && isNullString(lastName)) {
        const splitedDisplayName = displayName?.toUpperCase().split(' ');
        if (splitedDisplayName?.length > 1) {
            return splitedDisplayName?.map((string, i) => (i < 2 ? string[0] : ''));
        }
        return displayName
            ?.toUpperCase()
            .split('')
            .map((string, i) => (i < 2 ? string[0] : ''));
    }

    return firstNameInitial + lastNameInitial;
}
