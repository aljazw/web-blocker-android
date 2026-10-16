import { NativeModules } from 'react-native';

const { VpnControl } = NativeModules;

/** Whether the DNS-filtering VPN is currently running. */
export async function isDnsBlockingRunning(): Promise<boolean> {
    try {
        return await VpnControl.isRunning();
    } catch {
        return false;
    }
}

export interface DnsStats {
    running: boolean;
    ruleCount: number;
    forwarded: number;
    blocked: number;
    errors: number;
    lastBlocked: string | null;
    lastError: string | null;
    /** Android's Private DNS hostname mode is on, so the filter is passing lookups through. */
    privateDnsActive: boolean;
}

/** Live DNS diagnostics for the status panel. */
export async function getDnsStats(): Promise<DnsStats | null> {
    try {
        return await VpnControl.getStats();
    } catch {
        return null;
    }
}

/**
 * Requests the one-time system VPN consent (if needed) and starts DNS filtering.
 * Resolves true when protection is on, false if the user declined consent.
 */
export async function enableDnsBlocking(): Promise<boolean> {
    try {
        return await VpnControl.enable();
    } catch {
        return false;
    }
}

/** Stops DNS filtering. */
export async function disableDnsBlocking(): Promise<boolean> {
    try {
        return await VpnControl.disable();
    } catch {
        return false;
    }
}

/**
 * Opens Android's VPN settings so the user can enable "Always-on VPN" +
 * "Block connections without VPN" for the app — making the DNS layer
 * persistent and much harder to switch off.
 */
export async function openVpnSettings(): Promise<void> {
    try {
        await VpnControl.openVpnSettings();
    } catch {
        // ignore
    }
}

/** Opens the Android Private DNS settings page. */
export async function openPrivateDnsSettings(): Promise<void> {
    try {
        await VpnControl.openPrivateDnsSettings();
    } catch {
        // ignore
    }
}

/** AdGuard's default DNS (ad & tracker blocking). */
export const ADGUARD_DNS = '94.140.14.14';

/** Android's Private DNS hostname (e.g. dns.adguard-dns.com) when one is set, else null. */
export async function getPrivateDnsHost(): Promise<string | null> {
    try {
        return (await VpnControl.getPrivateDnsHost()) ?? null;
    } catch {
        return null;
    }
}

/** A Private DNS hostname like dns.adguard-dns.com (not an IP address). */
export function isDnsHostname(value: string): boolean {
    return /^(?=.{1,253}$)([a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(value.trim());
}

/** Current upstream resolver ('' = automatic). */
export async function getUpstreamDns(): Promise<string> {
    try {
        return await VpnControl.getUpstreamDns();
    } catch {
        return '';
    }
}

/**
 * Set the resolver for allowed sites: an IP, a Private DNS hostname (sent
 * encrypted), or '' for automatic. Applies at once.
 */
export async function setUpstreamDns(value: string): Promise<void> {
    try {
        await VpnControl.setUpstreamDns(value);
    } catch {
        // ignore
    }
}
