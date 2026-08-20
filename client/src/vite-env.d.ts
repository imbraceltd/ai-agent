/// <reference types="./vite-env-override.d.ts" />
/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

type BaseEnv = 'local' | 'dev' | 'staging' | 'demo' | 'prod';

const onPremise = process.env.VITE_APP_ON_PREMISE?.trim();
type ExtendedEnv = onPremise extends string ? BaseEnv | typeof onPremise : BaseEnv;

interface ImportMetaEnv {
    readonly VITE_APP_GOOGLE_APP_ID: string;
    readonly VITE_APP_WHATSAPP_APP_ID: string;
    readonly VITE_APP_WHATSAPP_CONFIG_ID: string;
    readonly VITE_APP_FACEBOOK_APP_ID: string;
    readonly VITE_APP_FACEBOOK_CONFIG_ID: string;
    readonly VITE_APP_INSTAGRAM_APP_ID: string;
    readonly VITE_APP_ENV: ExtendedEnv;
    readonly VITE_APP_API_HOST: string;
    readonly VITE_APP_API_CHAT_HOST: string;
    readonly VITE_APP_CHAT_HOST: string;
    readonly VITE_APP_WCS_HOST: string;
    readonly VITE_APP_AI_HOST: string;
    readonly VITE_APP_BUILD_VERSION?: string;
    readonly VITE_APP_GOOGLE_SCRIPT_URL: string;
    readonly VITE_APP_HOTJAR_ID: string;
    readonly VITE_APP_HOTJAR_SV: string;
    readonly VITE_IS_MULTI_TENANCY?: boolean;
    readonly VITE_APP_N8N_DOMAIN?: string;
    readonly VITE_APP_CAMPAIGN_DOMAIN: string;
    readonly VITE_APP_SENTRY_ENV: string;
    readonly VITE_APP_CLARITY_ID: string;
}

interface ImportMeta {
    readonly env: ImportMetaEnv;
}
