import { Theme } from './types';

/** Neutral graphite: low-contrast surfaces, one accent, muted status colors. */
export const darkTheme: Theme = {
    mode: 'dark',
    colors: {
        background: '#0B0C0E',
        text: '#ECEDEF',
        muted: '#8B9099',
        primaryRed: '#E5484D',
        primaryBlue: '#4C8DF6',
        primaryGreen: '#3DA66E',
        warning: '#E2A336',
        card: '#141518',
        elevated: '#1C1E22',
        border: '#272A30',
        accent: '#4C8DF6',
        accentSoft: 'rgba(76, 141, 246, 0.14)',
        onAccent: '#FFFFFF',
        redSoft: 'rgba(229, 72, 77, 0.14)',
        greenSoft: 'rgba(61, 166, 110, 0.14)',
    },
};
