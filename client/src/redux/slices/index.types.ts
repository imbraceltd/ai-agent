import type { RootState } from '../store';

type RejectValueDataType<Error = Record<string, unknown>> = Error & {
    message: string;
};

export interface AsyncThunkOptions<Error = Record<string, unknown>> {
    state: RootState;
    rejectValue: RejectValueDataType<Error>;
}

export interface PaginationParams {
    skip: number;
    limit: number;
    is_active?: boolean;
}
