import { NavigationProp } from "@react-navigation/native";



export type RootStackParamList = {
    BottomTabs: undefined; 
    AddSite: undefined;
    Schedule: { websiteUrl: string } ;
};

export interface BlockedWebsitesData{
    days: string;
    time: string;
    websiteUrl: string;
    visible: boolean;
};

export type RootStackNavigation = NavigationProp<RootStackParamList>;