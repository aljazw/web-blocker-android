/** Shown once before the first training session, and from Apnea settings. */
export const APNEA_SAFETY = {
    title: 'Train safely',
    rules: [
        'Only train on dry land, sitting or lying down. Never in or near water, a bath, or while driving.',
        'Never hyperventilate before a hold. Breathe slowly and relaxed.',
        'Stop at once if you feel dizzy, tingling or unwell. Blackout can happen without warning.',
        'Pool or open-water breath-holding requires a trained buddy watching you, every time.',
        'If you have heart, lung or blood-pressure conditions, or are pregnant, ask a doctor first.',
    ],
};

export const TABLE_INFO = {
    co2: {
        title: 'CO₂ table',
        summary:
            'The hold stays the same while the breathe time between holds gets shorter. Builds tolerance to the urge to breathe caused by rising carbon dioxide.',
    },
    o2: {
        title: 'O₂ table',
        summary:
            'The breathe time stays the same while the hold grows each round. Trains your body to work with less oxygen. Keep the last hold well below your maximum.',
    },
    custom: {
        title: 'Custom table',
        summary: 'Your own rest and hold times. Changes are saved for next time.',
    },
} as const;
