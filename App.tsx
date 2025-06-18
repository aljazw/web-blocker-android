/**
 * Sample React Native App
 * https://github.com/facebook/react-native
 *
 * @format
 */

import React, { useEffect } from 'react';

import Navigation from './src/navigation/Navigation';
import { ThemeProvider } from './src/theme';


function App(): React.JSX.Element {
  
  return (
    <ThemeProvider>
      <Navigation/>
    </ThemeProvider>
    
  );

}; 

export default App;
