import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { darkTheme } from '../theme/dark';
import { lightTheme } from '../theme/light';
import { Theme } from '../theme/types';
import { AccentName, DEFAULT_ACCENT, isAccentName, withAccent } from '../theme/accents';
import { getAccentPreference, getThemePreference, setAccentPreference, setThemePreference } from '../storage';
import { logger } from '../utils/logger';

type ThemeContextType = {
    theme: Theme;
    isDarkMode: boolean;
    toggleTheme: () => void;
    accent: AccentName;
    setAccent: (accent: AccentName) => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
    const [isDarkMode, setIsDarkMode] = useState(true);
    const [accent, setAccentState] = useState<AccentName>(DEFAULT_ACCENT);
    const darkRef = useRef(isDarkMode);
    darkRef.current = isDarkMode;

    useEffect(() => {
        Promise.all([getThemePreference(), getAccentPreference()])
            .then(([savedDark, savedAccent]) => {
                if (savedDark !== null) {
                    setIsDarkMode(savedDark);
                }
                if (isAccentName(savedAccent)) {
                    setAccentState(savedAccent);
                }
            })
            .catch(error => logger.warn('Could not load theme preferences', error));
    }, []);

    const toggleTheme = useCallback(() => {
        const next = !darkRef.current;
        setIsDarkMode(next);
        setThemePreference(next).catch(error => logger.warn('Could not save theme', error));
    }, []);

    const setAccent = useCallback((next: AccentName) => {
        setAccentState(next);
        setAccentPreference(next).catch(error => logger.warn('Could not save accent', error));
    }, []);

    const value = useMemo(() => {
        const theme = withAccent(isDarkMode ? darkTheme : lightTheme, accent);
        return { theme, isDarkMode, toggleTheme, accent, setAccent };
    }, [isDarkMode, accent, toggleTheme, setAccent]);

    return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used inside ThemeProvider');
    }
    return context;
};
