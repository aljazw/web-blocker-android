import { NativeModules } from 'react-native';
import { BlockedWebsitesData } from '../types/types';

const { SharedStorage } = NativeModules;

export const getBlockedWebsites = async (): Promise<BlockedWebsitesData[]> => {
    try {
        const existingData = await SharedStorage.getItem('@blocked_websites');
        return existingData ? JSON.parse(existingData) : [];
    } catch (error) {
        throw new Error('Failed to get blocked websites');
    }
};

export const isWebsiteBlocked = async (url: string): Promise<boolean> => {
    try {
        const websites = await getBlockedWebsites();
        return websites.some((site: { websiteUrl: string }) => site.websiteUrl === url);
    } catch {
        return false;
    }
};

export const deleteBlockedWebsite = async (url: string): Promise<boolean> => {
    try {
        const websites = await getBlockedWebsites();

        const updatedWebsites = websites.filter(site => site.websiteUrl !== url);

        return await SharedStorage.setItem('@blocked_websites', JSON.stringify(updatedWebsites));
    } catch (error) {
        return false;
    }
};

export const hideBlockedWebsite = async (url: string): Promise<boolean> => {
    try {
        const websites = await getBlockedWebsites();
        const updatedWebsites = websites.map((site: { websiteUrl: string; visible: boolean }) => {
            if (site.websiteUrl === url) {
                return { ...site, visible: false };
            }
            return site;
        });
        return await SharedStorage.setItem('@blocked_websites', JSON.stringify(updatedWebsites));
    } catch {
        return false;
    }
};

export const addBlockedWebsite = async (entry: BlockedWebsitesData): Promise<boolean> => {
    try {
        const websites = await getBlockedWebsites();
        websites.push(entry);

        return await SharedStorage.setItem('@blocked_websites', JSON.stringify(websites));
    } catch {
        return false;
    }
};
