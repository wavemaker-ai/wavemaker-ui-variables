import { $queue } from './inflight-queue';

describe('InflightQueue ($queue)', () => {

    afterEach(() => {
        // avoid cross-test leakage of the internal requestsQueue map
        ($queue as any).requestsQueue = new Map();
    });

    it('resolves the first submission immediately (queue length 1)', async () => {
        const variable: any = {};
        await expect($queue.submit(variable)).resolves.toBeUndefined();
    });

    it('clear() removes any queued entries for a variable', async () => {
        const variable: any = {};
        $queue.submit(variable);
        $queue.clear(variable);
        expect(($queue as any).requestsQueue.has(variable)).toBe(false);
    });

    it('process() clears the queue when called again on an already-active lone entry', async () => {
        const variable: any = {};
        await $queue.submit(variable);
        $queue.process(variable);
        expect(($queue as any).requestsQueue.has(variable)).toBe(false);
    });

    it('process() is a no-op when nothing is queued for the variable', () => {
        expect(() => $queue.process({})).not.toThrow();
    });

    describe('default inFlightBehavior (no explicit variable.inFlightBehavior)', () => {
        it('rejects every older entry and drops the newest one without settling it, then clears the queue', () => {
            const variable: any = {};
            const resolve1 = jest.fn(), reject1 = jest.fn();
            const resolve2 = jest.fn(), reject2 = jest.fn();
            ($queue as any).requestsQueue.set(variable, [
                { resolve: resolve1, reject: reject1, active: true },
                { resolve: resolve2, reject: reject2, active: false }
            ]);

            $queue.process(variable);

            expect(reject1).toHaveBeenCalledWith('PROCESS_REJECTED_IN_QUEUE');
            expect(resolve2).not.toHaveBeenCalled();
            expect(reject2).not.toHaveBeenCalled();
            expect(($queue as any).requestsQueue.has(variable)).toBe(false);
        });
    });

    describe('executeAll inFlightBehavior', () => {
        it('resolves queued entries one at a time, oldest first, as process() is called repeatedly', () => {
            const variable: any = { inFlightBehavior: 'executeAll' };
            const resolve1 = jest.fn(), resolve2 = jest.fn();
            ($queue as any).requestsQueue.set(variable, [
                { resolve: resolve1, reject: jest.fn(), active: false },
                { resolve: resolve2, reject: jest.fn(), active: false }
            ]);

            $queue.process(variable);
            expect(resolve1).toHaveBeenCalledTimes(1);
            expect(resolve2).not.toHaveBeenCalled();

            // simulate the first in-flight call completing and releasing the next one
            $queue.process(variable);
            expect(resolve2).toHaveBeenCalledTimes(1);
        });
    });

    describe('executeLast inFlightBehavior', () => {
        it('rejects only the oldest entry, silently drops any middle entries, and resolves the last one', () => {
            const variable: any = { inFlightBehavior: 'executeLast' };
            const resolve0 = jest.fn(), reject0 = jest.fn();
            const resolve1 = jest.fn(), reject1 = jest.fn();
            const resolve2 = jest.fn(), reject2 = jest.fn();
            ($queue as any).requestsQueue.set(variable, [
                { resolve: resolve0, reject: reject0, active: false },
                { resolve: resolve1, reject: reject1, active: false },
                { resolve: resolve2, reject: reject2, active: false }
            ]);

            $queue.process(variable);

            expect(reject0).toHaveBeenCalledWith('PROCESS_REJECTED_IN_QUEUE');
            expect(resolve1).not.toHaveBeenCalled();
            expect(reject1).not.toHaveBeenCalled();
            expect(resolve2).toHaveBeenCalledTimes(1);
        });
    });
});
