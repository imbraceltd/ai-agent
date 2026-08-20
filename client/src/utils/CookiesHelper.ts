import { getCookie } from 'typescript-cookie';

import { USER_ROLE } from '@/constants/account';

const orgRoleHighLevels = [USER_ROLE.OWNER, USER_ROLE.TECHNICIAN, USER_ROLE.ADMIN];

const getIsAllowModify = () => {
    const userRoleCookie = getCookie('user_role') || '';
    return orgRoleHighLevels.includes(userRoleCookie);
};
export { getIsAllowModify };
