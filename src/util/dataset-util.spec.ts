import DatasetUtil from './dataset-util';

describe('DatasetUtil', () => {

    describe('isValidDataset', () => {
        it('returns false for falsy dataset', () => {
            expect(DatasetUtil.isValidDataset(null)).toBe(false);
            expect(DatasetUtil.isValidDataset(undefined)).toBe(false);
            expect(DatasetUtil.isValidDataset(0)).toBe(false);
        });

        it('returns false when isList is true but dataset is not an array', () => {
            expect(DatasetUtil.isValidDataset({ a: 1 }, true)).toBe(false);
        });

        it('returns the dataset when valid', () => {
            const list = [1, 2, 3];
            expect(DatasetUtil.isValidDataset(list, true)).toBe(list);
            const obj = { a: 1 };
            expect(DatasetUtil.isValidDataset(obj)).toBe(obj);
        });
    });

    describe('getValue', () => {
        it('gets value from object dataset', () => {
            expect(DatasetUtil.getValue({ name: 'wm' }, 'name', undefined)).toBe('wm');
        });

        it('gets value from list dataset using index', () => {
            const list = [{ name: 'a' }, { name: 'b' }];
            expect(DatasetUtil.getValue(list, 'name', 1, true)).toBe('b');
        });

        it('defaults index to 0 for list dataset', () => {
            const list = [{ name: 'a' }, { name: 'b' }];
            expect(DatasetUtil.getValue(list, 'name', null, true)).toBe('a');
        });
    });

    describe('setValue', () => {
        it('sets value on non-list dataset when key is provided', () => {
            const obj: any = {};
            DatasetUtil.setValue(obj, 'name', 'wm');
            expect(obj.name).toBe('wm');
        });

        it('does not set value when key is missing', () => {
            const obj: any = { name: 'wm' };
            DatasetUtil.setValue(obj, undefined, 'x');
            expect(obj.name).toBe('wm');
        });

        it('does not set value when isList is true', () => {
            const list: any = [{ name: 'a' }];
            DatasetUtil.setValue(list, 'name', 'x', true);
            expect(list.name).toBeUndefined();
        });

        it('returns the dataset', () => {
            const obj: any = {};
            expect(DatasetUtil.setValue(obj, 'name', 'wm')).toBe(obj);
        });
    });

    describe('getItem', () => {
        it('returns the item at index for list dataset', () => {
            const list = ['a', 'b', 'c'];
            expect(DatasetUtil.getItem(list, 1, true)).toBe('b');
        });

        it('returns the dataset itself for non-list dataset', () => {
            const obj = { a: 1 };
            expect(DatasetUtil.getItem(obj, 0, false)).toBe(obj);
        });
    });

    describe('setItem', () => {
        it('returns dataset unchanged when index is undefined', () => {
            const list = [1, 2, 3];
            expect(DatasetUtil.setItem(list, undefined, 9, { isList: true })).toBe(list);
            expect(list).toEqual([1, 2, 3]);
        });

        it('returns dataset unchanged when options.isList is false', () => {
            const list = [1, 2, 3];
            expect(DatasetUtil.setItem(list, 0, 9, { isList: false })).toBe(list);
            expect(list).toEqual([1, 2, 3]);
        });

        it('sets item by numeric index when isList is true', () => {
            const list = [1, 2, 3];
            DatasetUtil.setItem(list, 1, 9, { isList: true });
            expect(list).toEqual([1, 9, 3]);
        });

        it('sets item by matching object when i is an object', () => {
            const list = [{ id: 1 }, { id: 2 }];
            DatasetUtil.setItem(list, { id: 2 }, { id: 2, name: 'x' }, { isList: true });
            expect(list[1]).toEqual({ id: 2, name: 'x' });
        });

        it('does nothing when object match is not found', () => {
            const list = [{ id: 1 }];
            DatasetUtil.setItem(list, { id: 99 }, { id: 99, name: 'x' }, { isList: true });
            expect(list).toEqual([{ id: 1 }]);
        });

        it('sets item inside a nested path using parentIndex', () => {
            const dataSet = [{ innerList: [{ id: 1, name: 'a' }] }];
            DatasetUtil.setItem(dataSet, { id: 1 }, { id: 1, name: 'b' }, {
                isList: true,
                path: 'innerList',
                parentIndex: 0
            });
            expect(dataSet[0].innerList[0]).toEqual({ id: 1, name: 'b' });
        });

        it('sets item inside a nested path using raw index (non-object i)', () => {
            const dataSet = [{ innerList: ['a', 'b'] }];
            DatasetUtil.setItem(dataSet, 0, 'z', {
                isList: true,
                path: 'innerList',
                parentIndex: 0
            });
            expect(dataSet[0].innerList).toEqual(['z', 'b']);
        });
    });

    describe('addItem', () => {
        it('returns dataset unchanged when value is undefined', () => {
            const list = [1, 2];
            expect(DatasetUtil.addItem(list, undefined, 0, { isList: true })).toBe(list);
            expect(list).toEqual([1, 2]);
        });

        it('returns dataset unchanged when options.isList is false', () => {
            const list = [1, 2];
            expect(DatasetUtil.addItem(list, 3, 0, { isList: false })).toBe(list);
            expect(list).toEqual([1, 2]);
        });

        it('appends item at the end when index is not provided', () => {
            const list = [1, 2];
            DatasetUtil.addItem(list, 3, undefined, { isList: true });
            expect(list).toEqual([1, 2, 3]);
        });

        it('inserts item at the specified index', () => {
            const list = [1, 3];
            DatasetUtil.addItem(list, 2, 1, { isList: true });
            expect(list).toEqual([1, 2, 3]);
        });

        it('inserts item into a nested array path', () => {
            const dataSet = [{ innerList: [1, 2] }];
            DatasetUtil.addItem(dataSet, 3, undefined, {
                isList: true,
                path: 'innerList',
                parentIndex: 0
            });
            expect(dataSet[0].innerList).toEqual([1, 2, 3]);
        });

        it('creates the nested array path when it does not exist', () => {
            const dataSet: any = [{}];
            DatasetUtil.addItem(dataSet, 'x', undefined, {
                isList: true,
                path: 'innerList',
                parentIndex: 0
            });
            expect(dataSet[0].innerList).toEqual(['x']);
        });
    });

    describe('removeItem', () => {
        it('removes the last item when index is not provided', () => {
            const list = [1, 2, 3];
            DatasetUtil.removeItem(list, undefined, {});
            expect(list).toEqual([1, 2]);
        });

        it('removes item by numeric index', () => {
            const list = [1, 2, 3];
            DatasetUtil.removeItem(list, 1, {});
            expect(list).toEqual([1, 3]);
        });

        it('removes item by matching object', () => {
            const list = [{ id: 1 }, { id: 2 }];
            DatasetUtil.removeItem(list, { id: 1 }, {});
            expect(list).toEqual([{ id: 2 }]);
        });

        it('respects exactMatch (boolean options) and skips removal on mismatch', () => {
            const list = [{ id: 1, name: 'a' }];
            DatasetUtil.removeItem(list, { id: 1, name: 'b' }, true);
            expect(list).toEqual([{ id: 1, name: 'a' }]);
        });

        it('respects exactMatch (object options) and removes on exact match', () => {
            const list = [{ id: 1, name: 'a' }];
            DatasetUtil.removeItem(list, { id: 1, name: 'a' }, { exactMatch: true });
            expect(list).toEqual([]);
        });

        it('removes item from a nested path', () => {
            const dataSet = [{ innerList: [{ id: 1 }, { id: 2 }] }];
            DatasetUtil.removeItem(dataSet, { id: 1 }, { path: 'innerList', parentIndex: 0 });
            expect(dataSet[0].innerList).toEqual([{ id: 2 }]);
        });
    });

    describe('getValidDataset', () => {
        it('returns an empty array for list', () => {
            expect(DatasetUtil.getValidDataset(true)).toEqual([]);
        });

        it('returns an empty object for non-list', () => {
            expect(DatasetUtil.getValidDataset(false)).toEqual({});
        });
    });

    describe('getCount', () => {
        it('returns length for list dataset', () => {
            expect(DatasetUtil.getCount([1, 2, 3], true)).toBe(3);
        });

        it('returns number of keys for object dataset', () => {
            expect(DatasetUtil.getCount({ a: 1, b: 2 }, false)).toBe(2);
        });
    });
});
