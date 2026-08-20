export const getCurrentLanguage = (lang: string) => {
    switch (lang) {
        case 'zh':
            return '繁體中文';
        case 'cn':
            return '简体中文';
        case 'en':
            return 'English (US)';
        default:
            return 'English (US)';
    }
};
