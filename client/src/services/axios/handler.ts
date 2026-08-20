import type { AxiosRequestConfig } from 'axios';

import { IMBRACE_ACCESS_TOKEN } from '../../constants/app';

import type { FetchMethod } from '.';
import { fetchMethod, ImbraceClient } from '.';

/**
 * @param {string} apiEndpoint api endpoint/route jasper
 * @param {string} apiMethod api request method
 * @param {object} apiParameters request body
 * @param {axios} [axiosInstance] optional - axiosInstance axios instance, most requests use the default one, but for uploading image, use ImbraceFileupload
 */

async function apiFetch<T>(
    apiEndpoint: string,
    apiMethod: keyof FetchMethod,
    apiParameters = {},
    axiosInstance = ImbraceClient,
    options: AxiosRequestConfig = {},
) {
    const accessToken = window.localStorage.getItem(IMBRACE_ACCESS_TOKEN) || '';
    const axiosHeader = { 'X-Access-Token': accessToken };

    switch (apiMethod) {
        case fetchMethod.GET: {
            const axiosResponse = await axiosInstance.get<T>(apiEndpoint, {
                ...options,
                headers: {
                    ...axiosHeader,
                    ...options.headers,
                },
                params: apiParameters,
            });
            return axiosResponse;
        }

        case fetchMethod.POST: {
            const axiosResponse = await axiosInstance.post<T>(apiEndpoint, apiParameters, {
                ...options,
                headers: {
                    ...axiosHeader,
                    ...options.headers,
                },
            });
            return axiosResponse;
        }

        case fetchMethod.DELETE: {
            const axiosResponse = await axiosInstance.delete<T>(apiEndpoint, {
                params: apiParameters,
                ...options,
                headers: {
                    ...axiosHeader,
                    ...options.headers,
                },
            });
            return axiosResponse;
        }

        case fetchMethod.PUT: {
            const axiosResponse = await axiosInstance.put<T>(apiEndpoint, apiParameters, {
                ...options,
                headers: {
                    ...axiosHeader,
                    ...options.headers,
                },
            });
            return axiosResponse;
        }

        case fetchMethod.PATCH: {
            const axiosResponse = await axiosInstance.patch<T>(apiEndpoint, apiParameters, {
                ...options,
                headers: {
                    ...axiosHeader,
                    ...options.headers,
                },
            });
            return axiosResponse;
        }

        case fetchMethod.HEAD: {
            const axiosResponse = await axiosInstance.head<T>(apiEndpoint, { headers: axiosHeader });
            return axiosResponse;
        }

        case fetchMethod.OPTIONS: {
            const axiosResponse = await axiosInstance.options<T>(apiEndpoint, { headers: axiosHeader });
            return axiosResponse;
        }

        default: {
            const axiosResponse = await axiosInstance.get<T>(apiEndpoint, {
                ...options,
                headers: {
                    ...axiosHeader,
                    ...options.headers,
                },
            });
            return axiosResponse;
        }
    }
}

export default apiFetch;
