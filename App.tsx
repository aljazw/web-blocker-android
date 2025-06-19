/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React from 'react';

import Navigation from './src/navigation/Navigation';
import { ThemeProvider } from './src/theme';
import { PassphraseProvider } from './src/context/PassphraseContext';


function App(): React.JSX.Element {
  
    return (
        <ThemeProvider>
            <PassphraseProvider>
                <Navigation/>
            </PassphraseProvider>
        </ThemeProvider>
    );
}; 

export default App;
