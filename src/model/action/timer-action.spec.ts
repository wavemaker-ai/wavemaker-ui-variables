const mockManager = {
    trigger: jest.fn(() => 'triggered'),
    cancel: jest.fn(() => 'cancelled')
};

jest.mock('../../factory/variable-manager.factory', () => ({
    VariableManagerFactory: { get: jest.fn(() => mockManager) }
}));

import { VariableManagerFactory } from '../../factory/variable-manager.factory';
import { VARIABLE_CONSTANTS } from '../../constants/variables.constants';
import { TimerAction } from './timer-action';

describe('TimerAction', () => {
    beforeEach(() => jest.clearAllMocks());

    it('copies the configuration onto the action', () => {
        expect(new TimerAction({ name: 't', delay: 5 } as any).name).toBe('t');
    });

    describe('fire / invoke', () => {
        it('triggers the manager without remembering options for one-shot timers', () => {
            const t: any = new TimerAction({ name: 't' });
            const success = jest.fn();
            const error = jest.fn();
            expect(t.fire({ a: 1 }, success, error)).toBe('triggered');
            expect(VariableManagerFactory.get).toHaveBeenCalledWith(VARIABLE_CONSTANTS.CATEGORY.TIMER);
            expect(mockManager.trigger).toHaveBeenCalledWith(t, { a: 1 }, success, error);
            expect(t._isFired).toBe(false);
            expect(t.currentOptions).toBeUndefined();
        });

        it('remembers the options of repeating timers', () => {
            const t: any = new TimerAction({ name: 't', repeating: true });
            t.fire({ a: 1 }, null, null);
            expect(t._isFired).toBe(true);
            expect(t.currentOptions).toEqual({ a: 1 });
        });

        it('invoke is an alias of fire', () => {
            const t: any = new TimerAction({ name: 't' });
            expect(t.invoke({ b: 1 }, 's', 'e')).toBe('triggered');
            expect(mockManager.trigger).toHaveBeenCalledWith(t, { b: 1 }, 's', 'e');
        });
    });

    it('cancel delegates to the manager', () => {
        const t: any = new TimerAction({ name: 't' });
        expect(t.cancel()).toBe('cancelled');
        expect(mockManager.cancel).toHaveBeenCalledWith(t);
    });

    describe('mute / unmute', () => {
        it('only cancels repeating timers when muted', () => {
            const once: any = new TimerAction({ name: 'a' });
            once.mute();
            expect(once.isMuted).toBe(true);
            expect(mockManager.cancel).not.toHaveBeenCalled();

            const repeating: any = new TimerAction({ name: 'b', repeating: true });
            repeating.mute();
            expect(mockManager.cancel).toHaveBeenCalledWith(repeating);
        });

        it('re-fires repeating timers that were fired before, when unmuted', () => {
            const t: any = new TimerAction({ name: 'b', repeating: true });
            t.fire({ c: 1 }, null, null);
            mockManager.trigger.mockClear();
            t.mute();
            t.unmute();
            expect(t.isMuted).toBe(false);
            expect(mockManager.trigger).toHaveBeenCalledWith(t, { c: 1 }, null, null);
        });

        it('does not fire on unmute for timers that never ran or are not repeating', () => {
            const never: any = new TimerAction({ name: 'x', repeating: true });
            never.unmute();
            const once: any = new TimerAction({ name: 'y' });
            once.unmute();
            expect(mockManager.trigger).not.toHaveBeenCalled();
        });
    });
});
