import type { CountryCode } from 'libphonenumber-js';
import { isPossiblePhoneNumber, isValidNumber, parsePhoneNumber } from 'libphonenumber-js';
import { memo } from 'react';

export const csvToJSON = (csv: string) => {
    const lines = csv.split(/\r\n/);

    const result = [];

    const headers = lines[0].split(',');

    for (let i = 1; i < lines.length; i += 1) {
        const obj: {
            [key: string]: string;
        } = {};
        const currentline = lines[i].split(',');

        for (let j = 0; j < headers.length; j += 1) {
            obj[headers[j]] = currentline[j];
        }

        result.push(obj);
    }

    return result;
};

export function isRef(obj: unknown) {
    return obj !== null && typeof obj === 'object' && obj.hasOwnProperty('current');
}

export const validateDate = (date?: Date | null) => {
    if (date instanceof Date && !isNaN(date.getTime())) {
        return date;
    }
    return null;
};

export const typedMemo: <T>(c: T) => T = memo;

export const ColorMapping = {
    primary: {
        backgroundColor: 'var(--color-primary-1)',
        hoverBackgroundColor: 'var(--color-primary-4)',
        textHoverBackgroundColor: 'var(--color-primary-2)',
        disabledColor: 'var(--color-primary-5)',
        textHoverColor: 'var(--color-primary-1)',
    },
    secondary: {
        backgroundColor: 'var(--color-secondary-1)',
        hoverBackgroundColor: 'var(--color-secondary-3)',
        textHoverBackgroundColor: 'var(--color-secondary-2)',
        disabledColor: 'var(--color-secondary-4)',
        textHoverColor: 'var(--color-secondary-1)',
    },
    danger: {
        backgroundColor: 'var(--color-danger-1)',
        hoverBackgroundColor: 'var(--color-danger-2)',
        textHoverBackgroundColor: 'var(--color-danger-3)',
        disabledColor: 'var(--color-danger-3)',
        textHoverColor: 'var(--color-danger-1)',
    },
    success: {
        backgroundColor: 'var(--color-green-1)',
        hoverBackgroundColor: 'var(--color-green-5)',
        textHoverBackgroundColor: 'var(--color-green-4)',
        disabledColor: 'var(--color-green-3)',
        textHoverColor: 'var(--color-green-1)',
    },
    warning: {
        backgroundColor: 'var(--color-accent-yellow-2)',
        hoverBackgroundColor: 'var(--color-accent-yellow-1)',
        textHoverBackgroundColor: 'var(--color-accent-yellow-5)',
        disabledColor: 'var(--color-accent-yellow-5)',
        textHoverColor: 'var(--color-accent-yellow-2)',
    },
};

const isValidPhoneNumberForCountry = (phoneNumberString: string, country: CountryCode) => {
    const phoneNumber = parsePhoneNumber(phoneNumberString, {
        defaultCountry: country,
        extract: false,
    });
    const { countryCallingCode } = phoneNumber;
    if (phoneNumberString.startsWith(countryCallingCode) || phoneNumberString.startsWith(`+${countryCallingCode}`)) {
        return false;
    }
    if (!phoneNumber) {
        return false;
    }
    if (phoneNumber.country !== country) {
        return false;
    }
    return phoneNumber.isValid();
};

export const urlRegex = /^https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b(?:[-a-zA-Z0-9()@:%_+.~#?&//=]*)?$/;

export const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i;

export const validatePhoneNumber = (data: { phoneNumber?: string; defaultCountryCode?: CountryCode }) => {
    const { phoneNumber = '', defaultCountryCode } = data;

    if (!phoneNumber) {
        throw Error('invalid phone number');
    }

    if (defaultCountryCode && phoneNumber && !isValidPhoneNumberForCountry(phoneNumber, defaultCountryCode)) {
        throw Error('invalid phone number');
    }

    const phone = phoneNumber.replaceAll(' ', '');

    if (isValidNumber(phone, defaultCountryCode) && isPossiblePhoneNumber(phone, defaultCountryCode)) {
        try {
            const { nationalNumber, countryCallingCode, country, number } = parsePhoneNumber(phone, defaultCountryCode);

            return {
                nationalNumber,
                countryCallingCode,
                country,
                number,
            };
        } catch (error) {
            throw Error('parsing phone number error');
        }
    }
    throw Error('invalid phone number');
};

export const getBase64FromFile = async (file: File) => {
    return new Promise<string | ArrayBuffer | null>((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onloadend = () => {
            const base64data = reader.result;
            resolve(base64data);
        };
        reader.onerror = (error) => {
            reject(error);
        };
    });
};

export const prettySize = (bytes?: number, separator = ' ', postFix = '') => {
    if (bytes) {
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.min(parseInt(`${Math.floor(Math.log(bytes) / Math.log(1024))}`, 10), sizes.length - 1);
        return `${(bytes / 1000 ** i).toFixed(i ? 1 : 0)}${separator}${sizes[i]}${postFix}`;
    }
    return 'n/a';
};

export const supportedImageFileExtensions = ['jpg', 'png', 'svg', 'jpeg'];
export const supportedImageFileMIME = ['image/png', 'image/jpeg', 'image/svg+xml'];
