export interface StorageService {
    setItem(key: string, value: any, ttl: number): Promise<void>;
    getItem(key: string): Promise<any>;
    removeItem(key: string): Promise<void>;
    clear(): Promise<any>;
}

export interface CacheStats {
    totalEntries: number;
    maxEntries: number;
    usagePercent: number;
}

export interface StorageConfig {
    maxEntries?: number;
}

export interface CacheEntry {
    value: any;
    createdAt: number;
    lastAccessedAt: number;
    ttl: number | undefined;
}

class SimpleStorageService implements StorageService {
    
    
    constructor(private cache: any, private keyPrefix: string) {
        this.keyPrefix = keyPrefix;
    }

    getKey(key: string) {
        return this.keyPrefix + key;
    }


    public async setItem(key: string, value: any, ttl: number) {
        const record: CacheEntry = {
            value,
            createdAt: Date.now(),
            lastAccessedAt: Date.now(),
            ttl: ttl && ttl > 0 ? Date.now() + ttl : undefined
        };
        this.cache[this.getKey(key)] = record;
    }

    public async getItem(key: string) {
        const value = this.cache[this.getKey(key)];
        if (!value) {
            // Do not create placeholder entries for missing keys
            return null;
        }

        const ttl = value.ttl;
        if (ttl && ttl < Date.now()) {
            await this.removeItem(key);
            return null;
        }
        // Update the last accessed time which helps in LRU eviction.
        value.lastAccessedAt = Date.now();
        return value.value;
    }

    public async removeItem(key: string) {
        delete this.cache[this.getKey(key)];
    }

    public async clear() {
        // For SessionStorageService, clear the static cache
        if (this.cache === SessionStorageService.cache) {
            SessionStorageService.cache = {} as any;
        } else {
            this.cache = {} as any;
        }
    }
}

const DEFAULT_MAX_ENTRIES = 100;
export class SessionStorageService extends SimpleStorageService {
    static cache: Record<string, CacheEntry> = {};
    static maxEntries: number = DEFAULT_MAX_ENTRIES;
    static cleanupInterval: NodeJS.Timeout | null = null;

    static configure(config: StorageConfig) {
        if (config.maxEntries !== undefined && config.maxEntries > 0) {
            SessionStorageService.maxEntries = config.maxEntries;
        }
    }

    private constructor(keyPrefix: string) {
        super(SessionStorageService.cache, keyPrefix);
    }

    static getInstance(keyPrefix: string) {
        return new SessionStorageService(keyPrefix);
    }

    public async setItem(key: string, value: any, ttl: number) {
        const fullKey = this.getKey(key);
        if (!SessionStorageService.cache[fullKey]) {
            await SessionStorageService.evictIfNeeded();
        }
        super.setItem(key, value, ttl);
    }

    static async evictIfNeeded(): Promise<void> {
        const currentCount = Object.keys(SessionStorageService.cache).length;
        if (currentCount < SessionStorageService.maxEntries) {
            return;
        }
        SessionStorageService.cleanEntriesWithExpiredTTL();
        const countAfterCleanup = Object.keys(SessionStorageService.cache).length;
        if (countAfterCleanup < SessionStorageService.maxEntries) {
            return;
        }
        const entriesToEvict = Math.max(1, Math.floor(SessionStorageService.maxEntries * 0.1));
        SessionStorageService.evictLRU(entriesToEvict);
    }

    /**
     * Evict the N least recently used entries.
     * @param count - The number of entries to evict.
     */
    private static evictLRU(count: number): void {
        const entries = Object.entries(SessionStorageService.cache)
            .map(([key, entry]) => ({ key, lastAccessedAt: entry.lastAccessedAt }))
            .sort((a, b) => a.lastAccessedAt - b.lastAccessedAt);
        for (let i = 0; i < Math.min(count, entries.length); i++) {
            delete SessionStorageService.cache[entries[i].key];
        }
    }

    /**
     * The keys with expired TTL are removed from the cache.
     */
    static cleanEntriesWithExpiredTTL(): number {
        const now = Date.now();
        let cleanedCount = 0;
        for (const key in SessionStorageService.cache) {
            const entry = SessionStorageService.cache[key];
            if (entry.ttl && entry.ttl < now) {
                // Keys in cache are already full keys, so delete directly
                delete SessionStorageService.cache[key];
                cleanedCount++;
            }
        }
        return cleanedCount;
    }

    static scheduleTTLCleanup(interval: number): void {
        if (SessionStorageService.cleanupInterval) {
            return;
        }
        SessionStorageService.cleanupInterval = setInterval(
            SessionStorageService.cleanEntriesWithExpiredTTL,
            interval
        );
    }

    static stopCleanup(): void {
        if (SessionStorageService.cleanupInterval) {
            clearInterval(SessionStorageService.cleanupInterval);
            SessionStorageService.cleanupInterval = null;
        }
    }
}

export class TemporaryStorageService extends SimpleStorageService {
    private constructor(keyPrefix: string) {
        super({}, keyPrefix);
    }

    static getInstance(keyPrefix: string) {
        return new TemporaryStorageService(keyPrefix);
    }
}