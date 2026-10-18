import { InterceptContext } from './intercept-context';

class TestContext extends InterceptContext<any> {
    proceed() {
        return Promise.resolve('go');
    }
}

describe('InterceptContext', () => {
    it('keeps the variable and stores it was created with', async () => {
        const stores: any = { temp: {}, session: {}, persistent: {} };
        const variable = { name: 'v' };
        const context = new TestContext(variable, stores);

        expect(context.variable).toBe(variable);
        expect(context.stores).toBe(stores);
        await expect(context.proceed()).resolves.toBe('go');
    });
});
