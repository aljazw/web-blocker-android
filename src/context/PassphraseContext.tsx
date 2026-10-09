import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { getPassphrasePreference, setPassphrasePreference } from '../storage';
import { logger } from '../utils/logger';

type PassphraseContextType = {
    isPassphraseEnabled: boolean;
    togglePassphrase: () => void;
};

const PassphraseContext = createContext<PassphraseContextType | undefined>(undefined);

export const PassphraseProvider = ({ children }: { children: ReactNode }) => {
    const [isPassphraseEnabled, setIsPassphraseEnabled] = useState(false);
    // Latest value for the toggle, so it never acts on a stale render.
    const current = useRef(isPassphraseEnabled);
    current.current = isPassphraseEnabled;

    useEffect(() => {
        getPassphrasePreference()
            .then(saved => {
                if (saved !== null) {
                    setIsPassphraseEnabled(saved);
                }
            })
            .catch(error => logger.warn('Could not load passphrase preference', error));
    }, []);

    const togglePassphrase = useCallback(() => {
        const next = !current.current;
        setIsPassphraseEnabled(next);
        setPassphrasePreference(next).catch(error => logger.warn('Could not save passphrase preference', error));
    }, []);

    const value = useMemo(() => ({ isPassphraseEnabled, togglePassphrase }), [isPassphraseEnabled, togglePassphrase]);

    return <PassphraseContext.Provider value={value}>{children}</PassphraseContext.Provider>;
};

export const usePassphrase = () => {
    const context = useContext(PassphraseContext);
    if (!context) {
        throw new Error('usePassphrase must be used within a PassphraseProvider');
    }
    return context;
};
