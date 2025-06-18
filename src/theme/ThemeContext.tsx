import { darkTheme } from "./dark";
import { lightTheme } from "./light";
import { Theme } from "./types";
import { createContext, ReactNode, useContext, useState } from "react";

type ThemeContextType = {
    theme: Theme;
    isDarkMode: boolean;
    toggleTheme: () => void;
};

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export const ThemeProvider = ({ children }: {children: ReactNode }) => {
    const [isDarkMode, setIsDarkMode] = useState(true);
    
    const toggleTheme = () => setIsDarkMode(prev => !prev);

    const theme = isDarkMode ? darkTheme : lightTheme;

    return (
        <ThemeContext.Provider value={{ theme, isDarkMode, toggleTheme }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => {
    const context = useContext(ThemeContext);
    if (!context) throw new Error('useTheme must be used inside ThemeProvider');
    return context;
};