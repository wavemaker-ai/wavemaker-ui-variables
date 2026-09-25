import { BaseVariable } from './base-variable';
import { DataSource } from '../types/types';

class TestVariable extends BaseVariable {}

describe('BaseVariable', () => {
    let variable: TestVariable;

    beforeEach(() => {
        variable = new TestVariable();
    });

    describe('notify/subscribe', () => {
        it('invokes subscribed listeners on notify', () => {
            const listener = jest.fn();
            variable.subscribe('onResult', listener);
            variable.notify('onResult', ['a', 'b']);
            expect(listener).toHaveBeenCalledWith('a', 'b');
        });

        it('unsubscribes via the returned function', () => {
            const listener = jest.fn();
            const unsubscribe = variable.subscribe('onResult', listener);
            unsubscribe();
            variable.notify('onResult', []);
            expect(listener).not.toHaveBeenCalled();
        });
    });

    describe('execute', () => {
        it('returns the name for GET_NAME', () => {
            variable.name = 'myVar';
            expect(variable.execute(DataSource.Operation.GET_NAME, {})).toBe('myVar');
        });

        it('delegates to addItem for ADD_ITEM', () => {
            variable.isList = true;
            variable.dataSet = [];
            const result = variable.execute(DataSource.Operation.ADD_ITEM, { item: 'x' });
            expect(result).toEqual([ 'x' ]);
        });

        it('delegates to removeItem for REMOVE_ITEM', () => {
            variable.isList = true;
            variable.dataSet = ['x', 'y'];
            const result = variable.execute(DataSource.Operation.REMOVE_ITEM, { item: 'x' });
            expect(result).toEqual(['y']);
        });
    });

    describe('data accessors (list dataset)', () => {
        beforeEach(() => {
            variable.isList = true;
            variable.dataSet = [{ id: 1, name: 'a' }, { id: 2, name: 'b' }];
        });

        it('getValue reads a field from the item at the given index', () => {
            expect(variable.getValue('name', 1)).toBe('b');
        });

        it('getItem returns the item at the index', () => {
            expect(variable.getItem(0)).toEqual({ id: 1, name: 'a' });
        });

        it('getCount returns the list length', () => {
            expect(variable.getCount()).toBe(2);
        });

        it('addItem appends a new item at the end', () => {
            variable.addItem({ id: 3, name: 'c' });
            expect(variable.dataSet).toHaveLength(3);
            expect(variable.dataSet[2]).toEqual({ id: 3, name: 'c' });
        });

        it('addItem inserts at a numeric index option', () => {
            variable.addItem({ id: 0, name: 'z' }, 0);
            expect(variable.dataSet[0]).toEqual({ id: 0, name: 'z' });
        });

        it('removeItem removes a matching object by identity', () => {
            variable.removeItem({ id: 1, name: 'a' });
            expect(variable.dataSet).toEqual([{ id: 2, name: 'b' }]);
        });

        it('setItem replaces the item at a matching object', () => {
            variable.setItem({ id: 2, name: 'b' }, { id: 2, name: 'updated' });
            expect(variable.dataSet[1]).toEqual({ id: 2, name: 'updated' });
        });

        it('clearData resets the dataset to an empty array', () => {
            variable.clearData();
            expect(variable.dataSet).toEqual([]);
        });
    });

    describe('addItem/setItem/removeItem with a nested inner list path', () => {
        beforeEach(() => {
            variable.isList = false;
            variable.dataSet = { innerList: [{ id: 1 }] };
        });

        it('adds an item to the nested inner list', () => {
            variable.addItem({ id: 2 }, { path: 'innerList' });
            expect(variable.dataSet.innerList).toEqual([{ id: 1 }, { id: 2 }]);
        });

        it('sets an item inside the nested inner list', () => {
            variable.setItem({ id: 1 }, { id: 1, name: 'x' }, { path: 'innerList' });
            expect(variable.dataSet.innerList[0]).toEqual({ id: 1, name: 'x' });
        });

        it('removes an item from the nested inner list', () => {
            variable.removeItem({ id: 1 }, { path: 'innerList' });
            expect(variable.dataSet.innerList).toEqual([]);
        });
    });

    describe('getPrefabName', () => {
        it('returns undefined when there is no context', () => {
            expect(variable.getPrefabName()).toBeUndefined();
        });

        it('returns the prefab name from the context', () => {
            variable._context = { prefabname: 'MyPrefab' };
            expect(variable.getPrefabName()).toBe('MyPrefab');
        });

        it('falls back to prefabName (camel case) on the context', () => {
            variable._context = { prefabName: 'MyPrefab2' };
            expect(variable.getPrefabName()).toBe('MyPrefab2');
        });

        it('returns false for the special __self__ prefab name', () => {
            variable._context = { prefabname: '__self__' };
            expect(variable.getPrefabName()).toBe(false);
        });
    });

    describe('mute/unmute', () => {
        it('toggles isMuted', () => {
            expect(variable.isMuted).toBe(false);
            variable.mute();
            expect(variable.isMuted).toBe(true);
            variable.unmute();
            expect(variable.isMuted).toBe(false);
        });
    });

    describe('invokeOnParamChange', () => {
        it('returns immediately when obj is not provided', () => {
            expect(variable.invokeOnParamChange()).toBeUndefined();
        });

        it('resolves and records the internal bound node map for an object value', () => {
            variable.name = 'myVar';
            variable.category = 'wm.Variable' as any;
            variable.dataSet = {};
            const p = variable.invokeOnParamChange({ target: 'address' }, { city: 'NYC' }, undefined);
            return expect(p).resolves.toBe(variable);
        });
    });
});
