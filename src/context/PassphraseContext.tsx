import { createContext, ReactNode, useContext, useEffect, useState } from 'react';
import { getPassphrasePreference, setPassphrasePreference } from '../utils/storage';

type PassphraseContextType = {
    isPassphraseEnabled: boolean;
    togglePassphrase: () => void;
};

const PassphraseContext = createContext<PassphraseContextType | undefined>(undefined);

export const PassphraseProvider = ({ children }: { children: ReactNode }) => {
    const [isPassphraseEnabled, setIsPassphraseEnabled] = useState(false);

    useEffect(() => {
        const loadPassphrasePreference = async () => {
            const saved = await getPassphrasePreference();
            if (saved === null) {
                await setPassphrasePreference(false);
            } else {
                setIsPassphraseEnabled(saved);
            }
        };
        loadPassphrasePreference();
    }, []);

    const togglePassphrase = async () => {
        setIsPassphraseEnabled(prev => {
            const next = !prev;
            setPassphrasePreference(next);
            return next;
        });
    };

    return (
        <PassphraseContext.Provider
            value={{
                isPassphraseEnabled,
                togglePassphrase,
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
