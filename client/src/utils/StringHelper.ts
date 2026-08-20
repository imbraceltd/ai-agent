export function isNull(e?: string) {
    return e === null || e === undefined || typeof e === 'undefined';
}

export function isNullString(e?: string) {
    return e === null || e === undefined || typeof e === 'undefined' || e === '';
}

export function isNullArray(e?: unknown[]) {
    return e === null || e === undefined || typeof e === 'undefined' || e.length === 0;
}

export function isEmail(email: string) {
    return String(email)
        .toLowerCase()
        .match(
            /^(([^<>()[\]\\.,;:\s@"]+(\.[^<>()[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/,
        );
}

export const formatCredentialName = (name: string) => {
    const formattedName = name.replace(/([A-Z])/g, ' $1').replace(/^./, (str) => str.toUpperCase());
    return formattedName
        .replace(/Aws/, 'AWS')
        .replace(/O Auth/, 'OAuth')
        .replace(/We Chat/, 'WeChat')
        .replace(/Whats App/, 'WhatsApp')
        .replace(/One Drive/, 'OneDrive')
        .replace(/Openai/, 'Open AI')
        .replace(/Linked In/, 'LinkedIn');
};
