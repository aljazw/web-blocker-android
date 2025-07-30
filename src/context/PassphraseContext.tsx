import { createContext, ReactNode, useContext, useState } from 'react';

type PassphraseContextType = {
    isPassphraseEnabled: boolean;
    setPassphraseEnabled: (value: boolean) => void;
};

const PassphraseContext = createContext<PassphraseContextType | undefined>(undefined);

export const PassphraseProvider = ({ children }: { children: ReactNode }) => {
    const [isPassphraseEnabled, setPassphraseEnabled] = useState(false);

    return (
        <PassphraseContext.Provider
            value={{
                isPassphraseEnabled,
                setPassphraseEnabled,
            }}>
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
