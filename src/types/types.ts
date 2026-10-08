import { NavigationProp, NavigatorScreenParams } from '@react-navigation/native';
import type { IconName } from '../components/Icon';

export type TabParamList = {
    Home: undefined;
    Habits: undefined;
    Breathe: undefined;
    Block: undefined;
    Settings: undefined;
};

export type RootStackParamList = {
    BottomTabs: NavigatorScreenParams<TabParamList> | undefined;
    AddSite: undefined;
    /** Pass websiteUrl for a site, or app for an app. */
    Schedule: { websiteUrl?: string; app?: { packageName: string; appName: string } };
    /** No habitId = create a new habit. */
    HabitEditor: { habitId?: string } | undefined;
    /** A generated CO2/O2 table, or a custom one (no tableId = create). */
    ApneaTable: { kind: 'co2' | 'o2' } | { kind: 'custom'; tableId?: string };
    /** The live (or just finished) training session. */
    ApneaSession: undefined;
    ApneaHistory: undefined;
    ApneaSettings: undefined;
};

export interface BlockedWebsitesData {
    days: string;
    time: string;
    websiteUrl: string;
    visible: boolean;
}

export interface BlockedAppData {
    days: string;
    time: string;
    packageName: string;
    appName: string;
    visible: boolean;
}

/** A website or app on the block list, in one shape for the UI. */
export interface BlockEntry {
    kind: 'site' | 'app';
    /** websiteUrl for sites, packageName for apps. */
    key: string;
    label: string;
    days: string;
    time: string;
    visible: boolean;
}

/** A recurring task the user checks off, e.g. "Workout 10 min". */
export interface Habit {
    id: string;
    title: string;
    icon: IconName;
    /** Seven flags, Monday first: which weekdays the habit is due. */
    days: boolean[];
    /** Daily reminder time "HH:MM" on due days, or null for none. */
    reminder: string | null;
    /** Local date "YYYY-MM-DD" the habit was created; streaks never look further back. */
    createdAt: string;
    /** Local dates "YYYY-MM-DD" the habit was checked off. */
    completions: string[];
    /** Checked off automatically when a session of this kind is finished. */
    link?: 'apnea';
}

// ---- Apnea training ---------------------------------------------------------

export type ApneaKind = 'co2' | 'o2' | 'custom' | 'pb' | 'breathing';
export type Difficulty = 'easy' | 'normal' | 'hard';

/** One row of a breath-hold table, in seconds: rest (breathe) first, then hold. */
export interface TableRound {
    breathe: number;
    hold: number;
}

export interface CustomTable {
    id: string;
    name: string;
    rounds: TableRound[];
}

export interface ApneaSettings {
    sound: boolean;
    vibration: boolean;
    /** Soft pulse every 30 s during an open-ended max hold. */
    holdPulse: boolean;
    /** Relaxed breathing before a max-hold test, in seconds (0 = none). */
    breatheUp: number;
    difficulty: Difficulty;
    rounds: number;
    safetyAccepted: boolean;
}

/** A finished training session (or a manually entered personal best). */
export interface ApneaRecord {
    id: string;
    kind: ApneaKind;
    title: string;
    /** Epoch ms. */
    startedAt: number;
    endedAt: number;
    /** All rounds done (false = ended early). */
    completed: boolean;
    /** Actual hold lengths in ms, in order. */
    holds: number[];
    /** Planned hold lengths in ms; -1 = open-ended (max hold). */
    targets: number[];
    /** Per hold: contraction times, ms into the hold. */
    contractions: number[][];
    /** Number of holds the session planned. */
    planned: number;
    manual?: boolean;
}

export type RootStackNavigation = NavigationProp<RootStackParamList>;
