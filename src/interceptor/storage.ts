export interface StorageService {
    setItem(key: string, value: any, ttl: number): Promise<void>;
    getItem(key: string): Promise<any>;
    removeItem(key: string): Promise<void>;
    clear(): Promise<any>;
}

const TTL_KEY_SUFFIX = '_ttl';

class SimpleStorageService implements StorageService {

    constructor(private cache: any, private keyPrefix: string) {
        this.keyPrefix = keyPrefix;
    }

    getKey(key: string) {
        return this.keyPrefix + key;
    }

    getTtlKey(key: string) {
        return this.getKey(key) + TTL_KEY_SUFFIX;
    }

    public async setItem(key: string, value: any, ttl: number) {
        this.cache[this.getKey(key)] = value;
        if (ttl && ttl > 0) {
            this.cache[this.getTtlKey(key)] = Date.now() + ttl;
        }
    }

    public async getItem(key: string) {
        const value = this.cache[this.getKey(key)];
        if (value) {
            const ttl = this.cache[this.getTtlKey(key)];
            if (ttl && ttl < Date.now()) {
                await this.removeItem(key);
                return null;
            }
        }
        return value;
    }

    public async removeItem(key: string) {
        delete this.cache[this.getKey(key)];
        delete this.cache[this.getTtlKey(key)];
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

export class SessionStorageService extends SimpleStorageService {
    static cache = {} as any;
    static inerval: NodeJS.Timeout | null = null;

    private constructor(keyPrefix: string) {
        super(SessionStorageService.cache, keyPrefix);
    }

    static getInstance(keyPrefix: string) {
        return new SessionStorageService(keyPrefix);
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