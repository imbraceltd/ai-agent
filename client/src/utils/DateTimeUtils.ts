import moment from 'moment';

const DDMMYYYY = 'DD/MM/YYYY';
const MMDDYYYY = 'MM/DD/YYYY';
const YYYYMMDD = 'YYYY-MM-DD';

const convertDateToDDMMYYYY = (date: string) => {
    return moment(date).format(DDMMYYYY);
};
const convertDateToYYYY_MM_DD = (date: string) => {
    return moment(date).format(YYYYMMDD);
};

const convertDateToYYYYMMDD = (date?: Date) => {
    return date ? moment(date).format(YYYYMMDD) : '';
};
const convertDateToMMDDYYYY = (date: string) => {
    return date ? moment(date).format(MMDDYYYY) : '';
};

const showDateText = (date: Date | undefined) => {
    return date ? new Date(date)?.toLocaleDateString('en-CA') : null;
};

export { convertDateToDDMMYYYY, convertDateToMMDDYYYY, convertDateToYYYY_MM_DD, convertDateToYYYYMMDD, showDateText };
