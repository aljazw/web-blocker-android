export type ThemeColors = {
    background: string;
    text: string;
    muted: string;
    primaryRed: string;
    primaryBlue: string;
    primaryGreen: string;
    card: string;
    elevated: string;
    border: string;
    accent: string;
    accentSoft: string;
    onAccent: string;
};

export type Theme = {
    mode: 'light' | 'dark';
    colors: ThemeColors;
};
