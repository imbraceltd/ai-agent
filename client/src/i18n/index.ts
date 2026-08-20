import i18next from 'i18next';
import detector from 'i18next-browser-languagedetector';
import Backend from 'i18next-http-backend';
import { initReactI18next } from 'react-i18next';

type SupportedLangs = {
    [key: string]: string;
};

const fallbackLng = ['en'];
export const supportedLangs: SupportedLangs = { en: 'English (US)', zh: '繁體中文', cn: '简体中文' };

const mapping = {
    local: 'dev',
    dev: 'dev',
    staging: 'stg',
    demo: 'demo',
    prod: 'prod',
    poc: 'dev',
};

const i18nConfig = {
    lng: 'en',
    fallbackLng,
    debug: false,
    returnEmptyString: false,
    interpolation: {
        escapeValue: false,
    },
};


i18next
    .use(Backend)
    .use(detector)
    .use(initReactI18next)
    .init({
        ...i18nConfig,
        backend: {
            loadPath: `https://imbrace-data.s3.ap-east-1.amazonaws.com/languages/${mapping['dev'] ?? 'dev'
                }/{{lng}}.json`,
        },
    });

export default i18next;
