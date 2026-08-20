import axios from 'axios';

import { DATA_ANALYTICS_API, IMBRACE_API, IPS_API, APP_GATEWAY_API } from '../baseURL';
import { responseInterceptor } from './interceptor';

export const ImbraceClient = axios.create({
    baseURL: IMBRACE_API,
    // timeout: 30000,
});

export const AppGatewayClient = axios.create({
    baseURL: APP_GATEWAY_API,
    // timeout: 30000,
});

export const IpsClient = axios.create({
    baseURL: IPS_API,
    // timeout: 30000,
});

//DO NOT ADD Access-Control-Allow-Origin
export const ImbraceWorkflow = axios.create({
    baseURL: IMBRACE_API,
    timeout: 30000,
});

export const ImbraceDataAnalytics = axios.create({
    baseURL: DATA_ANALYTICS_API,
    timeout: 30000,
});

ImbraceClient.interceptors.response.use(responseInterceptor);

export const ImbraceFileUpload = axios.create({
    baseURL: IMBRACE_API,
    headers: {
        'Content-Type': 'multipart/form-data',
    },
});

export interface FetchMethod {
    GET: 'GET';
    POST: 'POST';
    DELETE: 'DELETE';
    PUT: 'PUT';
    PATCH: 'PATCH';
    HEAD: 'HEAD';
    OPTIONS: 'OPTIONS';
}

export const fetchMethod: FetchMethod = {
    GET: 'GET',
    POST: 'POST',
    DELETE: 'DELETE',
    PUT: 'PUT',
    PATCH: 'PATCH',
    HEAD: 'HEAD',
    OPTIONS: 'OPTIONS',
};
