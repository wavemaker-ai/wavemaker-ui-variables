import { BaseVariable } from './base-variable';
import { BaseAction } from './base-action';
import { internalBoundNodeMap } from '../util/variable/variables.utils';

class Variable extends BaseVariable {}
class Action extends BaseAction {}

describe('BaseVariable.invokeOnParamChange - repeated and object changes', () => {
    it('reuses the internal bound node map and updates nested nodes for object values', async () => {
        const v: any = new Variable();
        v.name = 'v1';
        v.category = 'wm.Variable';
        v.dataSet = {};
        await v.invokeOnParamChange({ target: 'address' }, { city: 'A' }, undefined);
        expect(internalBoundNodeMap.has(v)).toBe(true);
        await v.invokeOnParamChange({ target: 'address' }, { city: 'B' }, { city: 'A' });
        expect(v.dataSet.address).toEqual({ city: 'B' });
        expect((internalBoundNodeMap.get(v) as any).v1).toBeDefined();
    });

    it('stores primitive values without touching nested nodes', async () => {
        const v: any = new Variable();
        v.name = 'v2';
        v.category = 'wm.Variable';
        v.dataSet = {};
        await v.invokeOnParamChange({ target: 'count' }, 3, undefined);
        expect(v.dataSet.count).toBe(3);
    });
});

describe('BaseAction.invokeOnParamChange', () => {
    const make = () => {
        const a: any = new Action();
        a.name = 'act';
        a.category = 'wm.TimerAction';
        a.dataBinding = {};
        return a;
    };

    it('does not clone blob and file values', async () => {
        const action = make();
        const blob = { size: 1 };
        await expect(action.invokeOnParamChange({ target: 'file', type: 'blob' }, blob, undefined)).resolves.toBe(action);
        await expect(action.invokeOnParamChange({ target: 'plain', type: 'string' }, 'x', undefined)).resolves.toBe(action);
    });

    it('ignores changes that carry no information', () => {
        const action = make();
        expect(action.invokeOnParamChange({ target: 'a' }, undefined, undefined)).toBeUndefined();
        expect(action.invokeOnParamChange({ target: 'a' }, undefined, 'old')).toBeUndefined();
    });
});
