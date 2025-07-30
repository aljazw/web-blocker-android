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
};
