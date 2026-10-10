import { NavigationProp, NavigatorScreenParams } from '@react-navigation/native';
import type { IconName } from '../components/Icon';

export type TabParamList = {
    Home: undefined;
    /** Opens on the day plan or the habit list. */
    Habits: { view?: RoutineView } | undefined;
    Workout: undefined;
    Breathe: undefined;
    Block: undefined;
};

export type RootStackParamList = {
    BottomTabs: NavigatorScreenParams<TabParamList> | undefined;
    AddSite: undefined;
    /** Pass websiteUrl for a site, or app for an app. */
    Schedule: { websiteUrl?: string; app?: { packageName: string; appName: string } };
    /** No habitId = create a new habit. */
    HabitEditor: { habitId?: string } | undefined;
    /** A generated CO2/O2 table, or a custom one (no tableId = create, optionally prefilled). */
    ApneaTable: { kind: 'co2' | 'o2' } | { kind: 'custom'; tableId?: string; name?: string; rounds?: TableRound[] };
    /** The live (or just finished) training session. */
    ApneaSession: undefined;
    ApneaHistory: undefined;
    ApneaSettings: undefined;
    Sleep: undefined;
    Vacation: undefined;
    Settings: undefined;
    /** No workoutId = create a new workout. */
    WorkoutEditor: { workoutId?: string } | undefined;
    /** The live (or just finished) workout. */
    WorkoutSession: undefined;
    /** No blockId = add a block, optionally prefilled (times in minutes after midnight). */
    PlanBlockEditor: { date: string; blockId?: string; start?: number; end?: number; habitId?: string };
};

export type RoutineView = 'plan' | 'habits';

// ---- Day plan ---------------------------------------------------------------

/** One time window of the day plan, e.g. "Lunch 12:30–13:15". */
export interface PlanBlock {
    id: string;
    title: string;
    icon: IconName;
    /** Minutes after midnight; start < end <= 1440. */
    start: number;
    end: number;
    /** Linked habit: checking the block checks off the habit (and the other way round). */
    habitId?: string;
    /** Only for this day; left out when the next day's plan is copied from this one. */
    once?: boolean;
    /** Checked off. Linked blocks follow their habit instead. */
    done?: boolean;
    /** Minutes this block was pushed back today ("running late"); the next day's copy undoes it. */
    shift?: number;
}

export interface DayPlan {
    /** Local date "YYYY-MM-DD". */
    date: string;
    blocks: PlanBlock[];
}

export interface PlanPrefs {
    /** A notification when each block starts, plus an evening "plan tomorrow" reminder. */
    reminders: boolean;
    /** Occasional in-app pop-ups about the current block. */
    nudges: boolean;
}

/** Nightly sleep time; times are "HH:mm". Mirrors SleepSchedule.kt. */
export interface SleepSchedule {
    enabled: boolean;
    bedtime: string;
    wake: string;
}

/** Vacation mode: no blocks apply from start to end, both "YYYY-MM-DD" and included. Mirrors Vacation.kt. */
export interface Vacation {
    start: string;
    end: string;
}

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
    link?: HabitLink;
}

export type HabitLink = 'apnea' | 'workout';

// ---- Workouts ---------------------------------------------------------------

/** Counted in reps (tap when a set is done) or timed (a countdown, e.g. a plank). */
export type ExerciseMode = 'reps' | 'time';

export interface Exercise {
    id: string;
    name: string;
    mode: ExerciseMode;
    sets: number;
    /** Target reps per set; used when mode is "reps". */
    reps: number;
    /** Seconds per set; used when mode is "time". */
    seconds: number;
    /** Rest after each set, in seconds (0 = none). */
    rest: number;
}

export interface Workout {
    id: string;
    name: string;
    exercises: Exercise[];
}

/**
 * ready: waiting for the user (tap "Done" for reps, "Start" for a timed set).
 * work:  a timed set is counting down; phaseStartedAt may lie in the future (get-ready lead-in).
 * rest:  resting after a set.
 * done:  finished or ended early.
 */
export type WorkoutPhase = 'ready' | 'work' | 'rest' | 'done';

/** The workout in progress. Wall-clock millis, so it survives the app closing. */
export interface WorkoutSession {
    id: string;
    workoutId: string;
    title: string;
    /** Snapshot taken at the start, so editing the workout can't break a running session. */
    exercises: Exercise[];
    exercise: number;
    set: number;
    phase: WorkoutPhase;
    phaseStartedAt: number;
    startedAt: number;
    endedAt: number;
    setsDone: number;
    /** Ended with "End workout" before the last set. */
    endedEarly: boolean;
}

export interface WorkoutRecord {
    id: string;
    workoutId: string;
    title: string;
    startedAt: number;
    endedAt: number;
    setsDone: number;
    setsTotal: number;
    /** Reached the end (skipped sets allowed) rather than ended early; this checks off linked habits. */
    completed: boolean;
}

export interface WorkoutCues {
    sound: boolean;
    vibration: boolean;
}

// ---- Apnea training ---------------------------------------------------------

export type ApneaKind = 'co2' | 'o2' | 'custom' | 'pb' | 'breathing';

/** One row of a breath-hold table, in seconds: rest (breathe) first, then hold. */
export interface TableRound {
    breathe: number;
    hold: number;
}

/** Inputs of a generated table, in seconds. */
export interface TableParams {
    hold: number;
    breathe: number;
    /** Change per round: less breathe time (CO₂) or more hold (O₂). */
    step: number;
    rounds: number;
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
    /** Parameters of the generated CO₂ and O₂ tables (see utils/apnea TableParams). */
    co2: TableParams;
    o2: TableParams;
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
