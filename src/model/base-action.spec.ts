import { BaseAction } from './base-action';
import { DataSource } from '../types/types';

class TestAction extends BaseAction {}

describe('BaseAction', () => {
    let action: TestAction;

    beforeEach(() => {
        action = new TestAction();
    });

    describe('execute', () => {
        it('returns the name for GET_NAME', () => {
            action.name = 'myAction';
            expect(action.execute(DataSource.Operation.GET_NAME, {})).toBe('myAction');
        });

        it('returns the id for GET_UNIQUE_IDENTIFIER', () => {
            (action as any)._id = 'id-1';
            expect(action.execute(DataSource.Operation.GET_UNIQUE_IDENTIFIER, {})).toBe('id-1');
        });

        it('returns the context for GET_CONTEXT_IDENTIFIER', () => {
            const ctx = {};
            action._context = ctx;
            expect(action.execute(DataSource.Operation.GET_CONTEXT_IDENTIFIER, {})).toBe(ctx);
        });

        it('returns undefined for an unhandled operation', () => {
            expect(action.execute('unknown-op' as any, {})).toBeUndefined();
        });
    });

    describe('data accessors', () => {
        it('setData accepts a valid dataset and getData returns it', () => {
            action.setData({ a: 1 });
            expect(action.getData()).toEqual({ a: 1 });
        });

        it('setData ignores a falsy dataset', () => {
            action.setData({ a: 1 });
            action.setData(null);
            expect(action.getData()).toEqual({ a: 1 });
        });

        it('getValue/setValue proxy to the dataset', () => {
            action.setData({ name: 'wm' });
            expect(action.getValue('name', 0)).toBe('wm');
            action.setValue('name', 'wm2');
            expect(action.getValue('name', 0)).toBe('wm2');
        });

        it('getItem returns the dataset itself (non-list)', () => {
            action.setData({ a: 1 });
            expect(action.getItem(0)).toEqual({ a: 1 });
        });

        it('clearData resets the dataset to an empty object', () => {
            action.setData({ a: 1 });
            action.clearData();
            expect(action.getData()).toEqual({});
        });

        it('getCount returns the number of keys in the dataset', () => {
            action.setData({ a: 1, b: 2 });
            expect(action.getCount()).toBe(2);
        });
    });

    describe('setItem/addItem (non-list dataset behavior)', () => {
        it('setItem is a no-op because BaseAction always treats the dataset as non-list', () => {
            action.setData({ a: 1 });
            const result = action.setItem(0, { a: 2 });
            expect(result).toEqual({ a: 1 });
        });

        it('addItem is a no-op for a non-list dataset', () => {
            action.setData({ a: 1 });
            const result = action.addItem({ b: 2 }, 0);
            expect(result).toEqual({ a: 1 });
        });
    });

    describe('mute/unmute', () => {
        it('toggles isMuted', () => {
            expect(action.isMuted).toBe(false);
            action.mute();
            expect(action.isMuted).toBe(true);
            action.unmute();
            expect(action.isMuted).toBe(false);
        });
    });

    describe('invokeOnParamChange', () => {
        it('resolves after setting a plain value on the target', () => {
            action.dataBinding = {};
            const p = action.invokeOnParamChange({ target: 'name', type: 'string' }, 'wm', undefined);
            return expect(p).resolves.toBe(action);
        });

        it('skips the update when both old and new values are undefined', () => {
            action.dataBinding = {};
            const result = action.invokeOnParamChange({ target: 'name' }, undefined, undefined);
            expect(result).toBeUndefined();
        });
    });
});
