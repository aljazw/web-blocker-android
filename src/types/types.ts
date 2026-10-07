import { NavigationProp, NavigatorScreenParams } from '@react-navigation/native';

export type TabParamList = {
    Home: undefined;
    Block: undefined;
    Settings: undefined;
};

export type RootStackParamList = {
    BottomTabs: NavigatorScreenParams<TabParamList> | undefined;
    AddSite: undefined;
    Schedule: { websiteUrl: string };
};

export interface BlockedWebsitesData {
    days: string;
    time: string;
    websiteUrl: string;
    visible: boolean;
}

export type RootStackNavigation = NavigationProp<RootStackParamList>;
