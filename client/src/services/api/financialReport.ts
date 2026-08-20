import { fetchMethod } from '../axios';

export const getListFinancialFileError = {
    api: (fileId: string) => `/v2/ai/financial_documents/errors-files/${fileId}?limit=-1`,
    method: fetchMethod.GET,
};

export const AiFinancialDocumentsSuggest = {
    api: () => `/v2/ai/financial_documents/suggest`,
    method: fetchMethod.POST,
};

export const AiFinancialDocumentsFix = {
    api: () => `/v2/ai/financial_documents/fix`,
    method: fetchMethod.POST,
};

export const getFinancialFileDetailsById = {
    api: (id: string, page: number, rowsPerPage: number) => `/v2/ai/financial_documents/${id}?page=${page}&limit=${rowsPerPage}`,
    method: fetchMethod.GET,
};

export const getFinancialReportDetailsById = {
    api: (id: string, page: number, rowsPerPage: number) => `/v2/ai/financial_documents/reports/${id}?page=${page}&limit=${rowsPerPage}`,
    method: fetchMethod.GET,
};

export const updateFinancialFile = {
    api: (id: string) => `/v2/ai/financial_documents/${id}`,
    method: fetchMethod.PUT,
};

export const updateFinancialReport = {
    api: (id: string) => `/v2/ai/financial_documents/reports/${id}`,
    method: fetchMethod.PUT,
};

export const deleteFinancialFile = {
    api: (id: string) => `/v2/ai/financial_documents/${id}`,
    method: fetchMethod.DELETE,
};

export const deleteFinancialReport = {
    api: (id: string) => `/v2/ai/financial_documents/reports/${id}`,
    method: fetchMethod.DELETE,
};

export const resetFinancialFile = {
    api: () => `/v2/ai/financial_documents/reset`,
    method: fetchMethod.POST,
};
