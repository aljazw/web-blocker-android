export const normalizeUrl = (url: string): string => {
    if (!url.startsWith('http://') && !url.startsWith('https://')) {
        return `https://${url}`;
    }
    return url;
};

export const denormalizeUrl = (url: string): string => {
    return url.replace(/^(https?:\/\/)?(www\.)?/, '');
};

/**
 * Validates a website entry locally — no network call, so it is instant and
 * works offline. We only check that the text LOOKS like a domain (optionally
 * with a path). We deliberately do NOT try to reach the site: many real sites
 * refuse background requests (403/405, auth walls, CORS), and a site being
 * temporarily down shouldn't stop you from blocking it.
 *
 * Accepts: facebook.com, sub.domain.co.uk, example.com/some/path
 * Rejects: empty, "hello world", "notadomain"
 */
export const isValidWebsiteInput = (value: string): boolean => {
    const v = denormalizeUrl(value.trim().toLowerCase());
    if (!v || /\s/.test(v)) {
        return false;
    }
    const domain = v.split('/')[0];
    // one or more labels (letters/digits/hyphens) followed by a 2+ letter TLD
    return /^([a-z0-9](?:[a-z0-9-]*[a-z0-9])?\.)+[a-z]{2,}$/.test(domain);
};
