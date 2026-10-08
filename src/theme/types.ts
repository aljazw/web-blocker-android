export type ThemeColors = {
    background: string;
    text: string;
    muted: string;
    primaryRed: string;
    primaryBlue: string;
    primaryGreen: string;
    warning: string;
    card: string;
    elevated: string;
    border: string;
    accent: string;
    accentSoft: string;
    onAccent: string;
    /** Translucent tints for status badges and icon tiles. */
    redSoft: string;
    greenSoft: string;
};

export type Theme = {
    mode: 'light' | 'dark';
    colors: ThemeColors;
};
