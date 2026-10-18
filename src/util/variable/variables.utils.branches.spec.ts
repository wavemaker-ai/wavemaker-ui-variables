import { decodeData, setInput, setValueToNode, wmSetDependency } from './variables.utils';
import { VARIABLE_CONSTANTS } from '../../constants/variables.constants';

describe('variables.utils - branches', () => {
    describe('setInput option types', () => {
        it('leaves values alone for option types without conversion and for missing options', () => {
            const target: any = {};
            setInput(target, 'a', '5', { type: 'string' });
            expect(target.a).toBe('5');
            setInput(target, 'b', '6', undefined);
            expect(target.b).toBe('6');
            setInput(target, 'c', '7', { type: 'number' });
            expect(target.c).toBe(7);
            setInput(target, 'd', 8, { type: 'number' });
            expect(target.d).toBe(8);
        });

        it('creates the target object when none is given', () => {
            expect(() => setInput(undefined as any, 'a', 1, undefined)).not.toThrow();
        });
    });

    describe('decodeData', () => {
        it('decodes strings inside arrays and nested objects, ignoring other values', () => {
            const data: any = ['a&amp;b', 5, null, { x: 'y&lt;z', n: 3, nested: { s: '&quot;q&quot;' }, empty: '' }];
            decodeData(data);
            expect(data[0]).toBe('a&amp;b'); // primitives inside arrays are not written back
            expect(data[3].x).toBe('y<z');
            expect(data[3].nested.s).toBe('"q"');
            expect(data[3].n).toBe(3);
            expect(data[3].empty).toBe('');
        });

        it('decodes object content and returns decoded plain strings', () => {
            const obj: any = { a: '&amp;', b: 2, c: { d: '&gt;' } };
            decodeData(obj);
            expect(obj).toEqual({ a: '&', b: 2, c: { d: '>' } });
            expect(decodeData('x&amp;y')).toBe('x&y');
        });

        it('returns falsy and non-string primitives untouched', () => {
            expect(decodeData(undefined)).toBeUndefined();
            expect(decodeData(null)).toBeNull();
            expect(decodeData(5)).toBeUndefined();
        });
    });

    describe('automatic updates are skipped when autoUpdate is off', () => {
        const node = (target: string) => ({ target, type: 'string' });

        it('does not invoke live variables with write operations', () => {
            const insertRecord = jest.fn();
            const variable: any = { category: VARIABLE_CONSTANTS.CATEGORY.LIVE, operation: 'insert', inputFields: {}, autoUpdate: false, insertRecord };
            setValueToNode('name', node('inputFields.name'), 'inputFields', variable, 'x');
            expect(variable.inputFields.name).toBe('x');
            expect(insertRecord).not.toHaveBeenCalled();
        });

        it('does not invoke crud variables whose operation is not a list or without autoUpdate', () => {
            const invoke = jest.fn();
            const variable: any = { category: VARIABLE_CONSTANTS.CATEGORY.CRUD, operationType: 'list', autoUpdate: false, invoke, dataBinding: {} };
            setValueToNode('q', node('dataBinding.q'), 'dataBinding', variable, 'x');
            const other: any = { category: VARIABLE_CONSTANTS.CATEGORY.CRUD, operationType: 'create', autoUpdate: true, invoke, dataBinding: {} };
            setValueToNode('q', node('dataBinding.q'), 'dataBinding', other, 'x');
            expect(invoke).not.toHaveBeenCalled();
        });

        it('does not invoke service, login or device variables without autoUpdate', () => {
            const invoke = jest.fn();
            [VARIABLE_CONSTANTS.CATEGORY.SERVICE, VARIABLE_CONSTANTS.CATEGORY.LOGIN, VARIABLE_CONSTANTS.CATEGORY.DEVICE].forEach(category => {
                const variable: any = { category, autoUpdate: false, invoke, dataBinding: {} };
                setValueToNode('q', node('dataBinding.q'), 'dataBinding', variable, 'x');
            });
            expect(invoke).not.toHaveBeenCalled();
        });
    });
});
