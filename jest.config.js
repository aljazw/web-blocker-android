module.exports = {
    preset: 'react-native',
    setupFiles: ['./node_modules/react-native-gesture-handler/jestSetup.js', './jest.setup.js'],
    transform: {
        '^.+\\.(js|mjs|ts|tsx)$': 'babel-jest',
    },
    transformIgnorePatterns: [
        'node_modules/(?!(@?react-native[^/]*|@react-navigation|lucide-react-native|@notifee)/)',
    ],
};
