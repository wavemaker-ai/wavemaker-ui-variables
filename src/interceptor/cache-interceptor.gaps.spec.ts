import { CacheInterceptor } from './cache-interceptor';

describe('CacheInterceptor edge cases', () => {
    const makeContext = () => ({
        variable: {} as any,
        stores: {
            session: { getItem: jest.fn(async () => undefined), setItem: jest.fn(async () => undefined) },
            persistent: { getItem: jest.fn(async () => undefined), setItem: jest.fn(async () => undefined) }
        }
    }) as any;

    it('does not match when the wrapped interceptor has no match function', () => {
        const interceptor: any = new CacheInterceptor({ intercept: jest.fn() } as any);
        expect(interceptor.match({} as any)).toBe(false);
    });

    it('uses the persistent store when configured and falls through to the interceptor on a miss', async () => {
        const inner: any = { match: () => true, intercept: jest.fn(async () => 'fresh') };
        const interceptor = new CacheInterceptor(inner, 'persistent', 1000);
        const ctx = makeContext();
        await expect(interceptor.intercept(ctx)).resolves.toBe('fresh');
        expect(ctx.stores.persistent.setItem).toHaveBeenCalledWith('response', 'fresh', 1000);
        expect(ctx.stores.session.getItem).not.toHaveBeenCalled();
    });

    it('returns cached data directly unless pass-through is on', async () => {
        const inner: any = { match: () => true, intercept: jest.fn(async () => 'fresh') };
        const ctx = makeContext();
        ctx.stores.session.getItem.mockResolvedValue('cached');
        await expect(new CacheInterceptor(inner).intercept(ctx)).resolves.toBe('cached');
        expect(ctx.variable.dataSet).toBe('cached');
        expect(inner.intercept).not.toHaveBeenCalled();

        await expect(new CacheInterceptor(inner, 'session', 5, true).intercept(ctx)).resolves.toBe('fresh');
        expect(inner.intercept).toHaveBeenCalled();
    });
});
