import { NavigationProp } from "@react-navigation/native";

export interface Website {
    url: string;
    favicon: string;
}

export type RootStackParamList = {
    BottomTabs: undefined; 
    AddSite: undefined;
    Schedule: { website: Website };
};

export interface BlockedWebsitesData{
    days: string;
    time: string;
    website:Website;
    visible: boolean;
};

export type RootStackNavigation = NavigationProp<RootStackParamList>;