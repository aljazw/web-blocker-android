import { createContext, ReactNode, useContext, useState } from 'react';

type PassphraseContextType = {
    isEnabled: boolean;
    setEnabled: (value: boolean) => void;
};

const PassphraseContext = createContext<PassphraseContextType | undefined>(undefined);

export const PassphraseProvider = ({ children }: { children: ReactNode }) => {
    const [isEnabled, setIsEnabled] = useState(false);

    return (
        <PassphraseContext.Provider value={{ isEnabled, setEnabled: setIsEnabled }}>
            {children}
        </PassphraseContext.Provider>
    );
};

export const usePassphrase = () => {
    const context = useContext(PassphraseContext);
    if (!context) {
        throw new Error('usePassphrase must be used within a PassphraseProvider');
    }
    return context;
};
