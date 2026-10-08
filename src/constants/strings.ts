export const PASSPHRASE_PROTECTION = {
    title: 'Turn on passphrase protection?',
    text:
        'This will require you to type a long phrase every time you attempt to remove a blocked website.\n\n' +
        "It's designed to help you stay focused and stick to your goals.",
};

export const UNINSTALL_PREVENTION = {
    enable: {
        title: 'Turn on uninstall prevention?',
        text:
            'Granting this permission will make the app a Device Administrator.\n\n' +
            'Once enabled, you won’t be able to uninstall the app without first disabling this protection in settings.\n\n' +
            'This helps ensure you stay focused and committed to your goals.',
    },
    disable: {
        title: 'Turn off uninstall prevention?',
        text:
            'Disabling this permission will remove the app’s Device Administrator rights.\n\n' +
            'Once disabled, you will be able to uninstall the app without any restrictions.\n\n' +
            'Only disable this if you no longer need protection to stay focused on your goals.',
    },
};

export const ERRORS = {
    uninstallPrevention: {
        title: 'Couldn’t change uninstall prevention',
        text: 'Failed to change uninstall prevention settings. Please try again later.',
    },
    dataLoadError: {
        title: 'Couldn’t load your data',
        text: 'We couldn’t access your blocked websites. Please try again later.',
    },
    saveFailed: {
        title: 'Couldn’t save that change',
        text: 'Nothing was changed. Please try again.',
    },
    genericRetrieveError: {
        title: 'Something went wrong',
        text: 'We couldn’t retrieve your blocked websites. Please try again later.',
    },
    dnsBlocking: {
        title: 'Couldn’t start DNS blocking',
        text: 'We couldn’t start DNS blocking. Make sure no other VPN is active and try again.',
    },
};

/** Phrases typed to confirm a protected action; long enough that it can't be done on impulse. */
export const UNBLOCK_MESSAGES = [
    'I am choosing to remove this block deliberately and I accept that this decision may cost me focus I worked hard to build',
    'The urge I feel right now will pass within minutes and the goals I set for myself will still matter tomorrow morning',
    'Before removing this block I have paused and asked myself whether this change serves the person I am trying to become',
    'Distraction is easy to start and hard to stop so I will make this change only because I have a clear reason to do it',
    'I set this block when I was thinking clearly and I am overriding that decision now knowing exactly what I am doing',
];

export const ACCESSIBILITY_NOTIFICATION_TEXT = `SiteLock needs its Accessibility service to block sites and apps.

1. Tap to open Accessibility settings.
2. Open "Installed services" (or "Downloaded services").
3. Select SiteLock and switch it on.
4. Confirm the prompts.`;

export const ACCESSIBILITY_SETUP_STEPS = [
    'Open Accessibility settings (click below).',
    'Scroll to "Installed Services" (or "Downloaded Services").',
    'Find & tap "SiteLock".',
    'Toggle it ON.',
    'Confirm any prompts.',
];
