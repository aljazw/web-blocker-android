import { NavigationProp, NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
    Home: undefined;
    Habits: undefined;
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
    emoji: string;
    /** Seven flags, Monday first: which weekdays the habit is due. */
    days: boolean[];
    /** Daily reminder time "HH:MM" on due days, or null for none. */
    reminder: string | null;
    /** Local date "YYYY-MM-DD" the habit was created; streaks never look further back. */
    createdAt: string;
    /** Local dates "YYYY-MM-DD" the habit was checked off. */
    completions: string[];
}

export type RootStackNavigation = NavigationProp<RootStackParamList>;
