import { fetchMethod } from '../axios/index';

export const postLoginEmail = {
    api: '/v1/backend/login/_signin_email_request',
    method: fetchMethod.POST,
};

export const postLoginOTP = {
    api: '/v1/backend/login/_signin_with_email',
    method: fetchMethod.POST,
};

export const postSignUpEmailPassword = {
    api: '/v1/backend/login/sign_up',
    method: fetchMethod.POST,
};

export const verificationCheck = {
    api: (email: string) => `/v1/backend/login/sign_up/verify/check?email=${email}`,
    method: fetchMethod.GET,
};

export const signIn = {
    api: '/v1/backend/login/sign_in',
    method: fetchMethod.POST,
};

export const resendVerificationEmail = {
    api: (email: string) => `/v1/backend/login/sign_up/verify/resend?email=${email}`,
    method: fetchMethod.GET,
};

export const forgotPassword = {
    api: (email: string) => `/v1/backend/login/forget?email=${email}`,
    method: fetchMethod.GET,
};

export const resetPassword = {
    api: '/v1/backend/login/forget/reset',
    method: fetchMethod.POST,
};

export const signUpPhotoUpload = {
    api: '/v1/backend/login/sign_in/file_up_load',
    method: fetchMethod.POST,
};

export const signInSSO = {
    api: '/v1/backend/sso/login-success',
    method: fetchMethod.POST,
};
