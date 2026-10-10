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

/**
 * Typed to start vacation mode. Deliberately long: pausing every block for days
 * should take a minute of honest typing, not a reflex.
 */
export const VACATION_MESSAGES = [
    'I am pausing all of my blocks because I am really going on a break and not because an urge is talking. When this vacation ends I will come back to the habits and the focus I built, and I will not stretch these days into weeks.',
    'These blocks exist because the person I want to become asked for them. I am setting them aside only for a real rest, I have chosen the exact days, and I promise myself that I will not use this time as an excuse to quit for good.',
    'A vacation is meant to give me rest and new energy, not to undo months of work in a few careless days. I will enjoy this time without guilt, I will keep my phone in its place, and I will be glad when the blocks return.',
    'Before I turn off every block I have stopped and checked my reason. This is a planned break with a clear first and last day, it is not a moment of weakness, and when it is over I will welcome my limits back without a fight.',
];

export const ACCESSIBILITY_NOTIFICATION_TEXT = `Gaman needs its Accessibility service to block sites and apps.

1. Tap to open Accessibility settings.
2. Open "Installed services" (or "Downloaded services").
3. Select Gaman and switch it on.
4. Confirm the prompts.`;

export const ACCESSIBILITY_SETUP_STEPS = [
    'Open Accessibility settings (click below).',
    'Scroll to "Installed Services" (or "Downloaded Services").',
    'Find & tap "Gaman".',
    'Toggle it ON.',
    'Confirm any prompts.',
];
