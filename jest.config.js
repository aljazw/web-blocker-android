module.exports = {
    preset: 'react-native',
    setupFiles: ['./jest.setup.js'],
    transform: {
        '^.+\\.(js|mjs|ts|tsx)$': 'babel-jest',
    },
    transformIgnorePatterns: [
        'node_modules/(?!(@?react-native[^/]*|@react-navigation|lucide-react-native|@notifee)/)',
    ],
};
