import { fetchMethod } from '../axios/index';

export const getDataAnalyticsBarChartList = {
    api: (type?: string, start_date?: string, end_date?: string, timeperiod?: string, channel?: string) =>
        `/api/analysis?type=${type}&start_date=${start_date}&end_date=${end_date}&timeperiod=${timeperiod}&channel=${channel}`,
    method: fetchMethod.GET,
};

export const getDataAnalyticsSummary = {
    api: (type?: string, start_date?: string, end_date?: string, channel?: string) =>
        `/api/analysis/summary?type=${type}&start_date=${start_date}&end_date=${end_date}&channel=${channel}`,
    method: fetchMethod.GET,
};

export const getDataAnalyticsTotalCount = {
    api: () => 'api/analysis/total',
    method: fetchMethod.GET,
};
