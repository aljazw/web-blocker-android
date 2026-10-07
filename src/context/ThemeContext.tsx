import { darkTheme } from '../theme/dark';
import { lightTheme } from '../theme/light';
import { Theme } from '../theme/types';
import { AccentName, DEFAULT_ACCENT, isAccentName, withAccent } from '../theme/accents';
import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { getAccentPreference, getThemePreference, setAccentPreference, setThemePreference } from '../utils/storage';

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

    useEffect(() => {
        const loadThemePreferences = async () => {
            const saved = await getThemePreference();
            if (saved === null) {
                await setThemePreference(true);
            } else {
                setIsDarkMode(saved);
            }

            const savedAccent = await getAccentPreference().catch(() => null);
            if (isAccentName(savedAccent)) {
                setAccentState(savedAccent);
            }
        };
        loadThemePreferences();
    }, []);

    const toggleTheme = async () => {
        setIsDarkMode(prev => {
            const next = !prev;
            setThemePreference(next);
            return next;
        });
    };

    const setAccent = (next: AccentName) => {
        setAccentState(next);
        setAccentPreference(next);
    };

    const theme = useMemo(() => withAccent(isDarkMode ? darkTheme : lightTheme, accent), [isDarkMode, accent]);

    return (
        <ThemeContext.Provider value={{ theme, isDarkMode, toggleTheme, accent, setAccent }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used inside ThemeProvider');
    }
    return context;
};
