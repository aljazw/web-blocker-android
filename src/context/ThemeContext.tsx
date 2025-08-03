import { darkTheme } from '../theme/dark';
import { lightTheme } from '../theme/light';
import { Theme } from '../theme/types';
import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { getThemePreference, setThemePreference } from '../utils/storage';

type ThemeContextType = {
    theme: Theme;
    isDarkMode: boolean;
    toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: { children: ReactNode }) => {
    const [isDarkMode, setIsDarkMode] = useState(true);

    useEffect(() => {
        const loadThemePreferences = async () => {
            const saved = await getThemePreference();
            if (saved === null) {
                await setThemePreference(true);
            } else {
                setIsDarkMode(saved);
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

    const theme = isDarkMode ? darkTheme : lightTheme;

    return <ThemeContext.Provider value={{ theme, isDarkMode, toggleTheme }}>{children}</ThemeContext.Provider>;
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) {
        throw new Error('useTheme must be used inside ThemeProvider');
    }
    return context;
};
