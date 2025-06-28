export const normalizeUrl = (url: string): string => {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return `https://${url}`;
    }
    return url;
};

export const denormalizeUrl = (url: string): string => {
    return url.replace(/^(https?:\/\/)?(www\.)?/, '');
};
