import { interceptorManager, interceptService } from './index';
import { InterceptorManager } from './interceptor.manager';
import { InterceptService } from './intercept.service';

describe('interceptor index', () => {
    it('exposes a shared manager and service', () => {
        expect(interceptorManager).toBeInstanceOf(InterceptorManager);
        expect(interceptService).toBeInstanceOf(InterceptService);
    });

    it('routes the shared service through the shared manager', async () => {
        const interceptor = { match: () => true, intercept: jest.fn().mockResolvedValue(null) };
        interceptorManager.add(interceptor);
        const context = { proceed: jest.fn(), variable: { dataSet: 'ds' } };
        await expect(interceptService.intercept(context)).resolves.toBe('ds');
        interceptorManager.remove(interceptor);
    });
});
