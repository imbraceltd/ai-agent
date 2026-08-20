import type { AxiosError, AxiosResponse } from 'axios';

export const responseInterceptor = (response: AxiosResponse) => {
    return Promise.resolve(response);
};

// const errorMessage = (message: string) => {
//     const newNotification = {
//         message,
//         messageType: 'noti_failed',
//         variant: 'error',
//     };
//     import('@/redux/store').then(({ store }) => {
//         import('@/redux/slices/notification').then(({ pushNotification }) => {
//             store.dispatch(pushNotification({ notification: newNotification }));
//         });
//     });
// };

// export const responseErrorInterceptor = (
//     error: AxiosError<{ code: number; message: string | { message: string } }, Record<string, unknown>>,
// ) => {
//     /**
//      * Sentry fingerprint
//      */
//     if (error.response && error.config.url && error.config.method) {
//         const apiUrl = error.config.url.slice(
//             0,
//             error.config.url.indexOf('?') !== -1 ? error.config?.url.indexOf('?') : error.config.url.length,
//         );
//         const errorRespContext = error.response.data;
//         const status = error.response.status;
//         const method = error.config.method;
//         const errorReqContext = error.config.data;
//         if (!env.VITE_UNABLE_SENTRY) {
//             Sentry.withScope((scope) => {
//                 Sentry.setTag('api', apiUrl);
//                 scope.setFingerprint([method, apiUrl, `${status}`]);
//                 scope.setContext('error request', errorReqContext || null);
//                 scope.setContext('error response', errorRespContext);
//                 Sentry.captureException(error);
//             });
//         }
//     }

//     if (error?.response?.data?.code === 99999) {
//         if (error.config.url?.indexOf('meilisearch') === -1) {
//             let message;
//             if (typeof error?.response?.data?.message === 'object') {
//                 message = error?.response?.data?.message.message;
//             } else {
//                 message = error?.response?.data?.message;
//             }

//             switch (message) {
//                 case 'Request failed with status code 401':
//                     errorMessage(i18n.t('error_response_bad_request'));
//                     break;
//                 case 'Internal Server Error':
//                     errorMessage(i18n.t('error_response_internal_server_error'));
//                     break;
//                 default:
//                     errorMessage(message);
//                     break;
//             }
//         }
//     }
//     if (error?.response?.data?.code === 40000) {
//         if (error.config.url?.indexOf('users/_bulk_invite') !== -1) {
//             return Promise.reject(error);
//         }
//         let message;
//         if (typeof error?.response?.data?.message === 'object') {
//             message = error?.response?.data?.message.message;
//         } else {
//             message = error?.response?.data?.message;
//         }
//         switch (message) {
//             case 'Invalid Client ID':
//                 errorMessage(i18n.t('error_response_invalid_client_id'));
//                 break;
//             case 'Duplicate key':
//                 // let component handle this error message
//                 break;
//             case 'Invalid channel':
//                 errorMessage(i18n.t('error_response_invalid_channel'));
//                 break;
//             default:
//                 errorMessage(message);
//                 break;
//         }
//     }
//     if (error?.response?.data?.code === 40001) {
//         if (error?.response?.data?.message === 'This account has been deactivated from this organization') {
//             errorMessage(i18n.t('error_response_account_deactivated'));
//             return Promise.reject(error);
//         }

//         window.localStorage.removeItem(IMBRACE_ACCESS_TOKEN);
//         window.localStorage.removeItem(IMBRACE_REFRESH_TOKEN);
//         import('@/redux/store').then(({ store }) => {
//             const state = store.getState();
//             if (state.Account.loadingStatus === 'FETCH_SUCCEEDED') {
//                 import('@/redux/slices/access').then(({ logoutThunk }) => {
//                     store.dispatch(logoutThunk());
//                 });
//             }
//         });
//     }
//     if (error?.response?.data?.code === 40003) {
//         errorMessage(i18n.t('error_response_insufficient_permission'));
//     }

//     return Promise.reject(error);
// };
