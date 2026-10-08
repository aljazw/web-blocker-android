import { Theme } from './types';

export type AccentName = 'indigo' | 'violet' | 'teal' | 'emerald' | 'amber' | 'rose';

/** Accent colors the user can pick in Settings. Keys are stored, so they never change. */
export const ACCENTS: Record<AccentName, { label: string; dark: string; light: string }> = {
    indigo: { label: 'Blue', dark: '#4C8DF6', light: '#2463EB' },
    violet: { label: 'Violet', dark: '#8E7CF0', light: '#6550CF' },
    teal: { label: 'Teal', dark: '#2AAE9F', light: '#0E7F73' },
    emerald: { label: 'Green', dark: '#3DA66E', light: '#1E8150' },
    amber: { label: 'Amber', dark: '#E2A336', light: '#AD6F0B' },
    rose: { label: 'Crimson', dark: '#E1607A', light: '#BE3455' },
};

export const DEFAULT_ACCENT: AccentName = 'indigo';

export const isAccentName = (value: unknown): value is AccentName => typeof value === 'string' && value in ACCENTS;

const hexToRgba = (hex: string, alpha: number) => {
    const [r, g, b] = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
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
            accentSoft: hexToRgba(color, base.mode === 'dark' ? 0.14 : 0.1),
        },
    };
};
