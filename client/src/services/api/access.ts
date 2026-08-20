import { fetchMethod } from '../axios';

export const postAccessSignInWithIdentity = {
    api: '/v1/backend/access/_signin_with_identity',
    method: fetchMethod.POST,
};

export const postAccessExchangeAccessToken = {
    api: '/v1/backend/access/_exchange_access_token',
    method: fetchMethod.POST,
};

export const postExchangeAccessTokenWithAccessToken = {
    api: '/v1/backend/access/_exchange_access_token_with_access_token',
    method: fetchMethod.POST,
};

export const postResolveCustomer = {
    api: '/v1/backend/aws_marketplace/resolve-customer',
    method: fetchMethod.POST,
};
