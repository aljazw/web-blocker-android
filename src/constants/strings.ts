export const PASSPHRASE_PROTECTION = {
    title: 'Are you sure you want to enable passphrase protection?\n\n',
    text:
        'This will require you to type a long phrase every time you attempt to remove a blocked website.\n\n' +
        "It's designed to help you stay focused and stick to your goals.",
};

export const UNINSTALL_PREVENTION = {
    enable: {
        title: 'Are you sure you want to enable uninstall prevention?\n\n',
        text:
            'Granting this permission will make the app a Device Administrator.\n\n' +
            'Once enabled, you won’t be able to uninstall the app without first disabling this protection in settings.\n\n' +
            'This helps ensure you stay focused and committed to your goals.',
    },
    disable: {
        title: 'Are you sure you want to disable uninstall prevention?\n\n',
        text:
            'Disabling this permission will remove the app’s Device Administrator rights.\n\n' +
            'Once disabled, you will be able to uninstall the app without any restrictions.\n\n' +
            'Only disable this if you no longer need protection to stay focused on your goals.',
    },
};

export const ERRORS = {
    uninstallPrevention: {
        title: 'Uninstall Prevention Error',
        text: 'Failed to change uninstall prevention settings. Please try again later.',
    },
    dataLoadError: {
        title: 'Data Load Error',
        text: 'We couldn’t access your blocked websites. Please try again later.',
    },
    invalidUrl: {
        title: 'Invalid URL',
        text: 'The subdirectory does not exist.',
    },
    genericRetrieveError: {
        title: 'Oops! Something went wrong',
        text: 'We couldn’t retrieve your blocked websites. Please try again later.',
    },
};

export const UNBLOCK_MESSAGES = [
    'I told myself I should stop procrastinating but then I thought why put off until tomorrow what you can do the day after tomorrow',
    "Congrats! You are about to unblock a site. Just don't let it turn into a quick break that lasts all day. Stay strong, champion of focus!",
    'Removing a block means saying yes to your goals. Keep your focus sharp and your distractions away.',
    'Unlocked! Now resist the urge to turn that quick peek into a deep dive. Your future self will thank you for staying focused today.',
    'Freedom tastes sweet, but so does crushing your goals. Unblock wisely and keep slaying that productivity game.',
];

export const SAMPLE_TEXTS = ['Hello world', 'React Native is cool', 'Keep coding!', 'This is a sample text'];

export const ACCESSIBILITY_NOTIFICATION_TEXT = `🔧 Please enable Accessibility Service for SiteLock:

1️⃣ Open Accessibility settings (click here).
2️⃣ Scroll to 'Installed Services' (or 'Downloaded Services').
3️⃣ Find & tap 'SiteLock'.
4️⃣ Toggle it ON 
5️⃣ Confirm any prompts.

This lets the app block distracting sites and keep you focused! 🔒`;

export const ACCESSIBILITY_SETUP_STEPS = [
    'Open Accessibility settings (click below).',
    'Scroll to "Installed Services" (or "Downloaded Services").',
    'Find & tap "SiteLock".',
    'Toggle it ON.',
    'Confirm any prompts.',
];
