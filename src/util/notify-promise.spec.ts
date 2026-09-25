import { NotifyPromise } from './notify-promise';

describe('NotifyPromise', () => {
    it('resolves like a normal promise', async () => {
        const p: any = new (NotifyPromise as any)((resolve: any) => {
            resolve('done');
        });
        await expect(p).resolves.toBe('done');
    });

    it('rejects like a normal promise', async () => {
        const p: any = new (NotifyPromise as any)((_resolve: any, reject: any) => {
            reject('failed');
        });
        await expect(p).rejects.toBe('failed');
    });

    it('invokes notify callbacks registered via then', () => {
        let notifyFn: any;
        const p: any = new (NotifyPromise as any)((resolve: any, _reject: any, notify: any) => {
            notifyFn = notify;
            resolve('done');
        });
        const onNotify = jest.fn();
        p.then(() => {}, () => {}, onNotify);
        notifyFn('in-progress');
        expect(onNotify).toHaveBeenCalledWith('in-progress');
    });

    it('cleans up notify queue after resolution so late notifications are dropped', async () => {
        let notifyFn: any;
        const p: any = new (NotifyPromise as any)((resolve: any, _reject: any, notify: any) => {
            notifyFn = notify;
            resolve('done');
        });
        const onNotify = jest.fn();
        p.then(() => {}, () => {}, onNotify);
        await p.superThen();
        notifyFn('too-late');
        expect(onNotify).not.toHaveBeenCalled();
    });

    it('calls onResolve and onReject passed to then', async () => {
        const onResolve = jest.fn();
        const p: any = new (NotifyPromise as any)((resolve: any) => {
            resolve('value');
        });
        p.then(onResolve, jest.fn());
        await p.superThen();
        expect(onResolve).toHaveBeenCalledWith('value');
    });
});
