import { BaseVariableManager } from './base-variable.manager';
import { ModelVariableManager } from './model-variable.manager';
import { BaseAction } from '../../model/base-action';
import { DefaultEventNotifier } from '../../types/event-notifier';
import { wmSetDependency } from '../../util/variable/variables.utils';

class Manager extends BaseVariableManager {}
class Action extends BaseAction {}

describe('BaseVariableManager.httpCall', () => {
    let manager: Manager;
    let variable: any;

    beforeEach(() => {
        manager = new Manager();
        variable = { httpService: { sendCall: jest.fn(), isPlatformSessionTimeout: jest.fn(() => false) } };
        wmSetDependency('appManager', { notify: jest.fn() });
    });

    it('resolves with responses that have a type or a status', async () => {
        variable.httpService.sendCall.mockResolvedValueOnce({ type: 4 });
        await expect(manager.httpCall({}, variable)).resolves.toMatchObject({ type: 4 });
        variable.httpService.sendCall.mockResolvedValueOnce({ status: 200 });
        await expect(manager.httpCall({}, variable)).resolves.toMatchObject({ status: 200 });
    });

    it('marks the request as coming from the framework', async () => {
        variable.httpService.sendCall.mockResolvedValue({ type: 4 });
        const params: any = {};
        await manager.httpCall(params, variable);
        expect(params._source).toBe('variable');
    });

    it('rejects ordinary failures', async () => {
        variable.httpService.sendCall.mockRejectedValue({ status: 500 });
        await expect(manager.httpCall({}, variable)).rejects.toMatchObject({ status: 500 });
    });

    it('waits for the 401 subscriber on session timeouts', async () => {
        const sub = { asObservable: () => ({ subscribe: (ok: Function) => ok('retried') }) };
        variable.httpService.isPlatformSessionTimeout.mockReturnValue(true);
        variable.httpService.sendCall.mockRejectedValue({ status: 401, _401Subscriber: sub });
        const notify = jest.spyOn(manager, 'notifyInflight');
        await expect(manager.httpCall({}, variable)).resolves.toBe('retried');
        expect(notify).toHaveBeenCalledWith(variable, false, expect.anything());

        const failing = { asObservable: () => ({ subscribe: (_ok: Function, err: Function) => err('nope') }) };
        variable.httpService.sendCall.mockRejectedValue({ status: 401, _401Subscriber: failing });
        await expect(manager.httpCall({}, variable)).rejects.toBe('nope');
    });

    it('treats services without a timeout check as ordinary failures', async () => {
        delete variable.httpService.isPlatformSessionTimeout;
        variable.httpService.sendCall.mockRejectedValue({ e: 'x' });
        await expect(manager.httpCall({}, variable)).rejects.toMatchObject({ e: 'x' });
    });
});

describe('ModelVariableManager.removeFirstEmptyObject', () => {
    const run = (dataSet: any) => {
        const variable: any = { dataSet };
        new ModelVariableManager().removeFirstEmptyObject(variable);
        return variable.dataSet;
    };

    it('clears a list holding one fully empty object', () => {
        expect(run([{ a: '', b: {}, c: [], d: { e: '' }, f: [{}] }])).toEqual([]);
        expect(run([{ a: [''] }])).toEqual([]);
    });

    it('keeps lists with real values', () => {
        expect(run([{ a: 0 }])).toEqual([{ a: 0 }]);
        expect(run([{ a: false }])).toEqual([{ a: false }]);
        expect(run([{ a: 'x' }])).toEqual([{ a: 'x' }]);
        expect(run([{ a: [1, 2] }])).toHaveLength(1);
        expect(run([{ a: { b: 'x' } }])).toHaveLength(1);
        expect(run([{ a: [{ b: 1 }] }])).toHaveLength(1);
    });

    it('ignores non-lists and longer lists', () => {
        expect(run({ a: '' })).toEqual({ a: '' });
        expect(run([{}, {}])).toHaveLength(2);
    });
});

describe('BaseAction.addItem / removeItem', () => {
    it('adds to and removes from the dataset', () => {
        const action: any = new Action();
        action.dataSet = {};
        expect(action.addItem('x', 0)).toEqual({});
        action.dataSet = ['a', 'b'];
        expect(action.removeItem(0, false)).toEqual(['b']);
    });
});

describe('DefaultEventNotifier', () => {
    it('ignores events without listeners and empty listener slots', () => {
        const notifier = new DefaultEventNotifier();
        expect(() => notifier.notify('none', [])).not.toThrow();
        const fn = jest.fn();
        const off = notifier.subscribe('evt', fn);
        (notifier as any).listeners['evt'].push(undefined);
        notifier.notify('evt', [1]);
        expect(fn).toHaveBeenCalledWith(1);
        off();
    });
});
