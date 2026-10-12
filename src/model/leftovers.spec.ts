import { BaseVariable } from './base-variable';
import { BaseAction } from './base-action';

class Variable extends BaseVariable {}
class Action extends BaseAction {}

describe('invokeOnParamChange early exits', () => {
    const variable = () => {
        const v: any = new Variable();
        v.name = 'v';
        v.category = 'wm.Variable';
        v.dataSet = { keep: 1 };
        return v;
    };

    it('ignores a missing binding object', () => {
        expect(variable().invokeOnParamChange()).toBeUndefined();
    });

    it('ignores unchanged undefined values', () => {
        expect(variable().invokeOnParamChange({ target: 'a' }, undefined, undefined)).toBeUndefined();
    });

    it('ignores an undefined new value when the old one was defined or the target already has data', () => {
        const v = variable();
        expect(v.invokeOnParamChange({ target: 'a' }, undefined, 'old')).toBeUndefined();
        expect(v.invokeOnParamChange({ target: 'keep' }, undefined, undefined)).toBeUndefined();
    });

    it('does not clone blob and file values', async () => {
        const v = variable();
        const blob = { size: 1 };
        await v.invokeOnParamChange({ target: 'b', type: 'blob' }, blob, undefined);
        expect(v.dataSet.b).toBe(blob);
        const file = { name: 'f' };
        await v.invokeOnParamChange({ target: 'f', type: 'file' }, file, undefined);
        expect(v.dataSet.f).toBe(file);
    });

    it('action: ignores an undefined new value when the target already has data', () => {
        const a: any = new Action();
        a.name = 'a';
        a.category = 'wm.TimerAction';
        a.dataBinding = { present: 1 };
        expect(a.invokeOnParamChange({ target: 'present' }, undefined, undefined)).toBeUndefined();
    });

    it('ignores an undefined new value when the nested target already holds data', () => {
        const v = variable();
        v.dataSet = { a: { b: 1 } };
        expect(v.invokeOnParamChange({ target: 'a.b' }, undefined, undefined)).toBeUndefined();
        const a: any = new Action();
        a.name = 'a';
        a.category = 'wm.TimerAction';
        a.dataBinding = { a: { b: 1 } };
        expect(a.invokeOnParamChange({ target: 'a.b' }, undefined, undefined)).toBeUndefined();
    });

    it('exposes no-op lifecycle hooks', () => {
        expect(new Action().init()).toBeUndefined();
        expect(new Variable().destroy()).toBeUndefined();
    });
});
