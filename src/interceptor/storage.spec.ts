import { SessionStorageService, TemporaryStorageService } from './storage';

describe('storage services', () => {
    beforeEach(() => {
        jest.useFakeTimers();
        SessionStorageService.cache = {};
        SessionStorageService.maxEntries = 100;
    });

    afterEach(() => {
        SessionStorageService.stopCleanup();
        jest.useRealTimers();
    });

    describe('TemporaryStorageService', () => {
        it('stores, reads and removes items under its key prefix', async () => {
            const store = TemporaryStorageService.getInstance('tmp_');
            await store.setItem('a', { x: 1 }, 0);
            expect(await store.getItem('a')).toEqual({ x: 1 });
            await store.removeItem('a');
            expect(await store.getItem('a')).toBeNull();
        });

        it('returns null for a missing key without creating a placeholder', async () => {
            const store = TemporaryStorageService.getInstance('tmp_');
            expect(await store.getItem('missing')).toBeNull();
        });

        it('expires items once their ttl has elapsed', async () => {
            const store = TemporaryStorageService.getInstance('tmp_');
            await store.setItem('a', 'v', 1000);
            jest.advanceTimersByTime(1001);
            expect(await store.getItem('a')).toBeNull();
        });

        it('clears all items', async () => {
            const store = TemporaryStorageService.getInstance('tmp_');
            await store.setItem('a', 'v', 0);
            await store.clear();
            expect(await store.getItem('a')).toBeNull();
        });
    });

    describe('SessionStorageService', () => {
        it('shares the static cache across instances with the same prefix', async () => {
            await SessionStorageService.getInstance('s_').setItem('a', 'v', 0);
            expect(await SessionStorageService.getInstance('s_').getItem('a')).toBe('v');
            expect(await SessionStorageService.getInstance('other_').getItem('a')).toBeNull();
        });

        it('clears the static cache', async () => {
            const store = SessionStorageService.getInstance('s_');
            await store.setItem('a', 'v', 0);
            await store.clear();
            expect(SessionStorageService.cache).toEqual({});
        });

        it('configure only accepts a positive maxEntries', () => {
            SessionStorageService.configure({ maxEntries: 5 });
            expect(SessionStorageService.maxEntries).toBe(5);
            SessionStorageService.configure({ maxEntries: 0 });
            SessionStorageService.configure({});
            expect(SessionStorageService.maxEntries).toBe(5);
        });

        it('evicts the least recently used entry when the cache is full', async () => {
            SessionStorageService.configure({ maxEntries: 3 });
            const store = SessionStorageService.getInstance('s_');
            await store.setItem('a', 1, 0);
            jest.advanceTimersByTime(10);
            await store.setItem('b', 2, 0);
            jest.advanceTimersByTime(10);
            await store.setItem('c', 3, 0);
            jest.advanceTimersByTime(10);
            await store.getItem('a'); // touch a so b becomes the LRU
            jest.advanceTimersByTime(10);
            await store.setItem('d', 4, 0);
            expect(await store.getItem('b')).toBeNull();
            expect(await store.getItem('a')).toBe(1);
            expect(await store.getItem('d')).toBe(4);
        });

        it('drops expired entries first instead of evicting live ones', async () => {
            SessionStorageService.configure({ maxEntries: 2 });
            const store = SessionStorageService.getInstance('s_');
            await store.setItem('old', 1, 100);
            await store.setItem('live', 2, 0);
            jest.advanceTimersByTime(200);
            await store.setItem('new', 3, 0);
            expect(await store.getItem('live')).toBe(2);
            expect(await store.getItem('new')).toBe(3);
            expect(SessionStorageService.cache['s_old']).toBeUndefined();
        });

        it('does not evict when overwriting an existing key', async () => {
            SessionStorageService.configure({ maxEntries: 1 });
            const store = SessionStorageService.getInstance('s_');
            await store.setItem('a', 1, 0);
            await store.setItem('a', 2, 0);
            expect(await store.getItem('a')).toBe(2);
        });

        it('cleanEntriesWithExpiredTTL returns the number of removed entries', async () => {
            const store = SessionStorageService.getInstance('s_');
            await store.setItem('a', 1, 100);
            await store.setItem('b', 2, 0);
            jest.advanceTimersByTime(200);
            expect(SessionStorageService.cleanEntriesWithExpiredTTL()).toBe(1);
        });

        it('schedules a single periodic ttl cleanup and can stop it', async () => {
            const store = SessionStorageService.getInstance('s_');
            await store.setItem('a', 1, 100);
            SessionStorageService.scheduleTTLCleanup(500);
            const interval = SessionStorageService.cleanupInterval;
            SessionStorageService.scheduleTTLCleanup(500); // second call is a no-op
            expect(SessionStorageService.cleanupInterval).toBe(interval);

            jest.advanceTimersByTime(600);
            expect(SessionStorageService.cache['s_a']).toBeUndefined();

            SessionStorageService.stopCleanup();
            expect(SessionStorageService.cleanupInterval).toBeNull();
            SessionStorageService.stopCleanup(); // safe to call again
        });
    });
});
