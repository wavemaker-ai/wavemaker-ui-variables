import { BaseInterceptor } from './interceptor';
import { InterceptorManager } from './interceptor.manager';
import { InterceptService } from './intercept.service';

class TestInterceptor extends BaseInterceptor<any> {
    async intercept(context: any) {
        return context;
    }
}

describe('BaseInterceptor', () => {
    it('matches when the match option returns a truthy value', () => {
        const interceptor = new TestInterceptor({ match: () => true });
        expect(interceptor.match({})).toBe(true);
    });

    it('does not match when the match option returns a falsy value', () => {
        const interceptor = new TestInterceptor({ match: () => false });
        expect(interceptor.match({})).toBe(false);
    });

    it('does not match when no match option is provided', () => {
        const interceptor = new TestInterceptor({});
        expect(interceptor.match({})).toBe(false);
    });
});

describe('InterceptorManager', () => {
    const matching = { match: jest.fn(() => true), intercept: jest.fn() };
    const nonMatching = { match: jest.fn(() => false), intercept: jest.fn() };

    it('filters interceptors by their match result', () => {
        const manager = new InterceptorManager();
        manager.add(matching);
        manager.add(nonMatching);
        expect(manager.filter({} as any)).toEqual([matching]);
    });

    it('stops returning an interceptor once it is removed', () => {
        const manager = new InterceptorManager();
        manager.add(matching);
        manager.remove(matching);
        expect(manager.filter({} as any)).toEqual([]);
    });
});

describe('InterceptService', () => {
    it('proceeds with the context when no interceptor matches', async () => {
        const manager = new InterceptorManager();
        const service = new InterceptService(manager);
        const context = { proceed: jest.fn().mockResolvedValue('proceeded') };
        await expect(service.intercept(context)).resolves.toBe('proceeded');
    });

    it('runs all matching interceptors and resolves with the variable dataSet', async () => {
        const manager = new InterceptorManager();
        const first = { match: () => true, intercept: jest.fn().mockResolvedValue(1) };
        const second = { match: () => true, intercept: jest.fn().mockResolvedValue(2) };
        manager.add(first);
        manager.add(second);
        const service = new InterceptService(manager);
        const context = { proceed: jest.fn(), variable: { dataSet: ['ds'] } };

        await expect(service.intercept(context)).resolves.toEqual(['ds']);
        expect(first.intercept).toHaveBeenCalledWith(context);
        expect(second.intercept).toHaveBeenCalledWith(context);
        expect(context.proceed).not.toHaveBeenCalled();
    });
});
