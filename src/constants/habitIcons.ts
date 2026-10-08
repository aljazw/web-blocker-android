import type { IconName } from '../components/Icon';

/** Icons a habit can use, in picker order. */
export const HABIT_ICONS: IconName[] = [
    'Dumbbell',
    'Footprints',
    'Book',
    'Brain',
    'Waves',
    'Droplet',
    'Apple',
    'Pen',
    'Code',
    'Music',
    'Bed',
    'PhoneOff',
    'Sun',
    'Leaf',
    'Coffee',
    'Target',
];

export const DEFAULT_HABIT_ICON: IconName = 'Target';

/** Habits saved before icons replaced emoji keep a matching icon. */
const LEGACY_EMOJI: Record<string, IconName> = {
    '💪': 'Dumbbell',
    '📚': 'Book',
    '🧘': 'Brain',
    '💧': 'Droplet',
    '✍️': 'Pen',
    '🚶': 'Footprints',
    '🏃': 'Footprints',
    '📵': 'PhoneOff',
    '🛏️': 'Bed',
    '🥗': 'Apple',
    '🎯': 'Target',
    '🎸': 'Music',
    '💻': 'Code',
    '🌱': 'Leaf',
    '☀️': 'Sun',
};

export const habitIconFrom = (icon: unknown, legacyEmoji: unknown): IconName => {
    if (typeof icon === 'string' && (HABIT_ICONS as string[]).includes(icon)) {
        return icon as IconName;
    }
    if (typeof legacyEmoji === 'string' && LEGACY_EMOJI[legacyEmoji]) {
        return LEGACY_EMOJI[legacyEmoji];
    }
    return DEFAULT_HABIT_ICON;
};
