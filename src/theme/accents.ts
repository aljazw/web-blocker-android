import { Theme } from './types';

export type AccentName = 'indigo' | 'violet' | 'teal' | 'emerald' | 'amber' | 'rose';

/** Accent colors the user can pick in Settings: [dark mode, light mode]. */
export const ACCENTS: Record<AccentName, { label: string; dark: string; light: string }> = {
    indigo: { label: 'Indigo', dark: '#7C8CFF', light: '#4F5BD5' },
    violet: { label: 'Violet', dark: '#B18CFF', light: '#7C4DDB' },
    teal: { label: 'Teal', dark: '#2DD4CF', light: '#0E9490' },
    emerald: { label: 'Emerald', dark: '#3DDC97', light: '#12A26B' },
    amber: { label: 'Amber', dark: '#FFB547', light: '#C77700' },
    rose: { label: 'Rose', dark: '#FF7A9C', light: '#D6336C' },
};

export const DEFAULT_ACCENT: AccentName = 'indigo';

export const isAccentName = (value: unknown): value is AccentName => typeof value === 'string' && value in ACCENTS;

const hexToRgba = (hex: string, alpha: number) => {
    const n = parseInt(hex.slice(1), 16);
    return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

/** Returns the base theme recolored with the chosen accent. */
export const withAccent = (base: Theme, accent: AccentName): Theme => {
    const color = base.mode === 'dark' ? ACCENTS[accent].dark : ACCENTS[accent].light;
    return {
        ...base,
        colors: {
            ...base.colors,
            accent: color,
            primaryBlue: color,
            accentSoft: hexToRgba(color, base.mode === 'dark' ? 0.16 : 0.12),
        },
    };
};
