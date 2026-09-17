import { TimerActionManager } from './timer-action.manager';
import { CONSTANTS } from '../../constants/variables.constants';

describe('TimerActionManager', () => {
    let manager: TimerActionManager;

    beforeEach(() => {
        jest.useFakeTimers();
        manager = new TimerActionManager();
    });

    afterEach(() => {
        jest.useRealTimers();
        CONSTANTS.isStudioMode = false;
    });

    describe('trigger', () => {
        it('does nothing when a call is already in-flight', () => {
            const variable: any = { _promise: 123 };
            expect(manager.trigger(variable, {}, jest.fn(), jest.fn())).toBeUndefined();
        });

        it('does nothing in studio mode', () => {
            CONSTANTS.isStudioMode = true;
            const variable: any = {};
            expect(manager.trigger(variable, {}, jest.fn(), jest.fn())).toBeUndefined();
        });

        it('fires onTimerFire once after the delay for a non-repeating timer', () => {
            const variable: any = { onTimerFire: jest.fn(), delay: 100 };
            manager.trigger(variable, {}, jest.fn(), jest.fn());
            expect(variable._promise).toBeDefined();
            jest.advanceTimersByTime(100);
            expect(variable.onTimerFire).toHaveBeenCalledTimes(1);
            expect(variable._promise).toBeUndefined();
        });

        it('fires onTimerFire repeatedly for a repeating timer', () => {
            const variable: any = { onTimerFire: jest.fn(), delay: 100, repeating: true };
            manager.trigger(variable, {}, jest.fn(), jest.fn());
            jest.advanceTimersByTime(300);
            expect(variable.onTimerFire).toHaveBeenCalledTimes(3);
            manager.cancel(variable);
        });

        it('uses the default delay when the variable has none configured', () => {
            const variable: any = { onTimerFire: jest.fn() };
            manager.trigger(variable, {}, jest.fn(), jest.fn());
            jest.advanceTimersByTime(CONSTANTS.DEFAULT_TIMER_DELAY);
            expect(variable.onTimerFire).toHaveBeenCalledTimes(1);
        });
    });

    describe('cancel', () => {
        it('clears a pending one-shot timer', () => {
            const variable: any = { onTimerFire: jest.fn(), delay: 100 };
            manager.trigger(variable, {}, jest.fn(), jest.fn());
            manager.cancel(variable);
            jest.advanceTimersByTime(200);
            expect(variable.onTimerFire).not.toHaveBeenCalled();
            expect(variable._promise).toBeUndefined();
        });

        it('clears a repeating timer', () => {
            const variable: any = { onTimerFire: jest.fn(), delay: 100, repeating: true };
            manager.trigger(variable, {}, jest.fn(), jest.fn());
            jest.advanceTimersByTime(100);
            manager.cancel(variable);
            jest.advanceTimersByTime(500);
            expect(variable.onTimerFire).toHaveBeenCalledTimes(1);
        });

        it('does nothing when there is no pending timer', () => {
            expect(() => manager.cancel({})).not.toThrow();
        });
    });
});
