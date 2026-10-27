import { CacheInterceptor } from './cache-interceptor';

describe('CacheInterceptor', () => {
    let session: any;
    let persistent: any;
    let context: any;
    let inner: any;

    beforeEach(() => {
        session = { getItem: jest.fn(), setItem: jest.fn() };
        persistent = { getItem: jest.fn(), setItem: jest.fn() };
        context = { variable: { dataSet: null }, stores: { session, persistent } };
        inner = { match: jest.fn(() => true), intercept: jest.fn().mockResolvedValue('fresh') };
    });

    describe('match', () => {
        it('delegates to the wrapped interceptor', () => {
            expect(new CacheInterceptor(inner).match(context)).toBe(true);
            expect(inner.match).toHaveBeenCalledWith(context);
        });

        it('returns false when the wrapped interceptor has no match function', () => {
            expect(new CacheInterceptor({ intercept: jest.fn() } as any).match(context)).toBe(false);
        });
    });

    describe('intercept', () => {
        it('returns the cached response without calling the wrapped interceptor', async () => {
            session.getItem.mockResolvedValue('cached');
            const result = await new CacheInterceptor(inner).intercept(context);
            expect(result).toBe('cached');
            expect(context.variable.dataSet).toBe('cached');
            expect(inner.intercept).not.toHaveBeenCalled();
            expect(session.getItem).toHaveBeenCalledWith('response');
        });

        it('fetches and stores the response in the session store on a cache miss', async () => {
            session.getItem.mockResolvedValue(null);
            const result = await new CacheInterceptor(inner, 'session', 1000).intercept(context);
            expect(result).toBe('fresh');
            expect(session.setItem).toHaveBeenCalledWith('response', 'fresh', 1000);
        });

        it('uses the persistent store when the cache type is persistent', async () => {
            persistent.getItem.mockResolvedValue(null);
            await new CacheInterceptor(inner, 'persistent').intercept(context);
            expect(persistent.getItem).toHaveBeenCalledWith('response');
            expect(persistent.setItem).toHaveBeenCalledWith('response', 'fresh', 5 * 60 * 1000);
            expect(session.getItem).not.toHaveBeenCalled();
        });

        it('serves the cached data to the variable but still refreshes when passThrough is set', async () => {
            session.getItem.mockResolvedValue('cached');
            const result = await new CacheInterceptor(inner, 'session', 1000, true).intercept(context);
            expect(context.variable.dataSet).toBe('cached');
            expect(inner.intercept).toHaveBeenCalledWith(context);
            expect(result).toBe('fresh');
            expect(session.setItem).toHaveBeenCalledWith('response', 'fresh', 1000);
        });
    });
});
