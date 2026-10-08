import { useCallback, useEffect, useState } from 'react';
import { checkAdmin } from '../utils/deviceAdmin';
import { checkAccessibilityEnabled } from '../utils/accessibility';
import { DnsStats, getDnsStats, getUpstreamDns, isDnsBlockingRunning } from '../utils/dnsBlocking';
import { canDrawOverlays } from '../utils/overlay';
import { isWatchdogRunning } from '../utils/watchdog';
import { getBlockedWebsites } from '../utils/storage';
import { ALL_DAY, FULL_WEEK } from '../utils/schedule';
import { useAppForeground } from './useAppForeground';

export interface ProtectionStatus {
    accessibility: boolean;
    watchdog: boolean;
    overlay: boolean;
    dns: boolean;
    admin: boolean;
    dnsStats: DnsStats | null;
    /** Sites the DNS layer covers: only "every day, all day" blocks. */
    dnsRuleCount: number;
    upstream: string;
}

const INITIAL: ProtectionStatus = {
    accessibility: false,
    watchdog: false,
    overlay: true,
    dns: false,
    admin: false,
    dnsStats: null,
    dnsRuleCount: 0,
    upstream: '',
};

/**
 * Live state of every protection layer. Refreshes on mount and whenever the
 * app returns to the foreground (e.g. after a system settings screen).
 * Each probe already swallows its own errors, so one failing check can't
 * stop the others from updating.
 */
export const useProtectionStatus = () => {
    const [status, setStatus] = useState<ProtectionStatus>(INITIAL);

    const refresh = useCallback(async () => {
        const [admin, dns, overlay, accessibility, dnsStats, sites, upstream, watchdog] = await Promise.all([
            checkAdmin(),
            isDnsBlockingRunning(),
            canDrawOverlays(),
            checkAccessibilityEnabled(),
            getDnsStats(),
            getBlockedWebsites().catch(() => []),
            getUpstreamDns(),
            isWatchdogRunning(),
        ]);
        setStatus({
            admin,
            dns,
            overlay,
            accessibility,
            dnsStats,
            upstream,
            watchdog,
            dnsRuleCount: sites.filter(s => s.days === FULL_WEEK && s.time === ALL_DAY).length,
        });
    }, []);

    /** Optimistically update part of the status before the next refresh confirms it. */
    const patch = useCallback((changes: Partial<ProtectionStatus>) => setStatus(prev => ({ ...prev, ...changes })), []);

    useEffect(() => {
        refresh();
    }, [refresh]);
    useAppForeground(refresh);

    return { status, refresh, patch };
};
