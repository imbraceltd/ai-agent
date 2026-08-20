import { fetchMethod } from '../axios/index';

export const postIdentityGoogleSignup = {
    api: '/v1/backend/identity/_signup_google',
    method: fetchMethod.POST,
};

export const postIdentityGoogleSignin = {
    api: '/v1/backend/identity_access/_signin_google',
    method: fetchMethod.POST,
};

export const postIdentityEmailSignUp = {
    api: '/v1/backend/identity/_signup_email',
    method: fetchMethod.POST,
};

export const postIdentityEmailSignIn = {
    api: '/v1/backend/identity_access/_signin_email',
    method: fetchMethod.POST,
};
