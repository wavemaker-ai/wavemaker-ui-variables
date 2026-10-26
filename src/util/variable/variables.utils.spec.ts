import {
    wmSetDependency,
    isFileUploadSupported,
    formatExportExpression,
    getBlob,
    setInput,
    decodeData,
    getEvaluatedOrderBy,
    getTarget,
    getTargetNodeKey,
    getTargetObj,
    setValueToNode,
    formatDate,
    getErrMessage,
    debounceVariableCall,
    updateInternalNodes,
    internalBoundNodeMap
} from './variables.utils';
import { VARIABLE_CONSTANTS } from '../../constants/variables.constants';

describe('variables.utils', () => {

    describe('wmSetDependency', () => {
        it('sets the oAuth service dependency, usable by getAccessToken via wiring', () => {
            const oauthService = { getAccessToken: jest.fn() };
            expect(() => wmSetDependency('oAuth', oauthService)).not.toThrow();
        });

        it('is a no-op for an unknown dependency type', () => {
            expect(() => wmSetDependency('unknown-type' as any, {})).not.toThrow();
        });
    });

    describe('isFileUploadSupported', () => {
        it('returns true when File/FileReader/FileList/Blob are available (jsdom)', () => {
            expect(isFileUploadSupported()).toBeTruthy();
        });
    });

    describe('formatExportExpression', () => {
        it('wraps each fieldDef expression in ${...}', () => {
            const fieldDefs = [{ expression: 'a.b' }, { expression: 'c.d' }, {}];
            formatExportExpression(fieldDefs);
            expect(fieldDefs[0].expression).toBe('${a.b}');
            expect(fieldDefs[1].expression).toBe('${c.d}');
        });
    });

    describe('getBlob', () => {
        it('returns the same Blob instance if val is already a Blob', () => {
            const blob = new Blob(['x']);
            expect(getBlob(blob)).toBe(blob);
        });

        it('wraps a JSON-parseable object value into a JSON blob', () => {
            const blob = getBlob('{"a":1}');
            expect(blob.type).toBe('application/json');
        });

        it('wraps a plain string value into a text blob', () => {
            const blob = getBlob('hello');
            expect(blob.type).toBe('text/plain');
        });

        it('respects the provided content type', () => {
            const blob = getBlob('hello', 'text/csv');
            expect(blob.type).toBe('text/csv');
        });
    });

    describe('setInput', () => {
        it('sets a plain string key on the target object', () => {
            const target = setInput({}, 'name', 'wm', {});
            expect(target).toEqual({ name: 'wm' });
        });

        it('sets a nested key using dot notation, returning the resolved nested node', () => {
            const original: any = { employee: { department: {} } };
            const target = setInput(original, 'employee.department.id', 5, {});
            expect(target.id).toBe(5);
            expect(original.employee.department.id).toBe(5);
        });

        it('accepts an object as the key to set multiple values at once', () => {
            const target = setInput({}, { a: 1, b: 2 }, undefined, {});
            expect(target).toEqual({ a: 1, b: 2 });
        });

        it('parses the value as a number when options.type is number', () => {
            const target = setInput({}, 'age', '25', { type: 'number' });
            expect(target.age).toBe(25);
        });

        it('creates a blob when options.type is file', () => {
            const target = setInput({}, 'file', 'content', { type: 'file', contentType: 'text/plain' });
            expect(target.file).toBeInstanceOf(Blob);
        });

        it('defaults targetObj to an empty object when not provided', () => {
            const target = setInput(undefined, 'a', 1, {});
            expect(target).toEqual({ a: 1 });
        });
    });

    describe('decodeData', () => {
        it('returns falsy input unchanged', () => {
            expect(decodeData(null)).toBeNull();
            expect(decodeData(undefined)).toBeUndefined();
        });

        it('decodes html entities in a plain string', () => {
            expect(decodeData('Tom &amp; Jerry')).toBe('Tom & Jerry');
        });

        it('leaves a top-level array of plain strings untouched (only object entries are decoded in place)', () => {
            const arr = ['A &amp; B', 'C &amp; D'];
            decodeData(arr);
            expect(arr).toEqual(['A &amp; B', 'C &amp; D']);
        });

        it('decodes nested string values inside objects within an array', () => {
            const arr = [{ name: 'A &amp; B' }];
            decodeData(arr);
            expect(arr[0].name).toBe('A & B');
        });

        it('decodes nested string values inside a plain object', () => {
            const obj = { name: 'A &amp; B', nested: { title: 'X &lt; Y' } };
            decodeData(obj);
            expect(obj.name).toBe('A & B');
            expect(obj.nested.title).toBe('X < Y');
        });
    });

    describe('getEvaluatedOrderBy', () => {
        it('returns variable order when options order is empty', () => {
            expect(getEvaluatedOrderBy('name asc', undefined)).toBe('name asc');
            expect(getEvaluatedOrderBy('name asc', '')).toBe('name asc');
        });

        it('returns options order when variable order is not defined', () => {
            expect(getEvaluatedOrderBy(undefined, 'age desc')).toBe('age desc');
        });

        it('combines both, giving options order precedence and dropping duplicate fields', () => {
            const result = getEvaluatedOrderBy('name asc,age desc', 'age asc');
            expect(result).toBe('age asc,name asc');
        });
    });

    describe('getTarget', () => {
        it('returns dataSet for MODEL category', () => {
            expect(getTarget({ category: VARIABLE_CONSTANTS.CATEGORY.MODEL })).toBe('dataSet');
        });

        it('returns filterFields for LIVE read operation', () => {
            expect(getTarget({ category: VARIABLE_CONSTANTS.CATEGORY.LIVE, operation: 'read' })).toBe('filterFields');
        });

        it('returns inputFields for LIVE non-read operation', () => {
            expect(getTarget({ category: VARIABLE_CONSTANTS.CATEGORY.LIVE, operation: 'insert' })).toBe('inputFields');
        });

        it('defaults to dataBinding for any other category', () => {
            expect(getTarget({ category: VARIABLE_CONSTANTS.CATEGORY.SERVICE })).toBe('dataBinding');
        });
    });

    describe('getTargetNodeKey', () => {
        it('returns the last segment of a dotted target', () => {
            expect(getTargetNodeKey('employee.department.name')).toBe('name');
        });

        it('returns the target unchanged when it has no dots', () => {
            expect(getTargetNodeKey('name')).toBe('name');
        });

        it('preserves a bracketed dotted key as a single key', () => {
            expect(getTargetNodeKey("['my.param']")).toBe('my.param');
        });
    });

    describe('getTargetObj', () => {
        it('returns the root node when target equals root', () => {
            const variable = { dataSet: { a: 1 } };
            expect(getTargetObj({ target: 'dataSet' }, 'dataSet', variable)).toBe(variable);
        });

        it('returns the root node when target has no parent path', () => {
            const variable = { dataSet: { a: 1 } };
            expect(getTargetObj({ target: 'a' }, 'dataSet', variable)).toBe(variable.dataSet);
        });

        it('resolves a nested parent path from the root node', () => {
            const variable = { dataSet: { department: { budget: 100 } } };
            expect(getTargetObj({ target: 'department.budget' }, 'dataSet', variable)).toBe(variable.dataSet.department);
        });

        it('treats a bracketed dotted target as the root node itself', () => {
            const variable = { dataSet: { 'my.param': 1 } };
            expect(getTargetObj({ target: "['my.param']" }, 'dataSet', variable)).toBe(variable.dataSet);
        });
    });

    describe('setValueToNode', () => {
        it('sets a plain value on the target node', () => {
            const variable: any = { dataSet: {} };
            setValueToNode('name', { target: 'name', value: 'wm' }, 'dataSet', variable, undefined, true);
            expect(variable.dataSet.name).toBe('wm');
        });

        it('uses the explicit value over obj.value when provided', () => {
            const variable: any = { dataSet: {} };
            setValueToNode('name', { target: 'name', value: 'ignored' }, 'dataSet', variable, 'explicit', true);
            expect(variable.dataSet.name).toBe('explicit');
        });

        it('creates a new slot per distinct binding for a multi-value target', () => {
            const variable: any = { dataSet: {} };
            setValueToNode('tags', { target: 'tags', collectionFormat: 'multi' }, 'dataSet', variable, 'a', true);
            setValueToNode('tags', { target: 'tags', collectionFormat: 'multi' }, 'dataSet', variable, 'b', true);
            expect(variable.dataSet.tags).toEqual(['a', 'b']);
        });

        it('updates the same slot when the same binding rebinds with a new value', () => {
            const variable: any = { dataSet: {} };
            const obj: any = { target: 'tags', collectionFormat: 'multi' };
            setValueToNode('tags', obj, 'dataSet', variable, 'a', true);
            setValueToNode('tags', obj, 'dataSet', variable, 'b', true);
            expect(variable.dataSet.tags).toEqual(['b']);
        });

        it('does nothing when targetObj cannot be resolved', () => {
            const variable: any = { dataSet: undefined };
            expect(() => setValueToNode('a.b', { target: 'a.b', value: 1 }, 'dataSet', variable, undefined, true)).not.toThrow();
        });
    });

    describe('formatDate', () => {
        it('formats a single date value using the provided dateFormatter', () => {
            const dateFormatter = { format: jest.fn().mockReturnValue('2024-01-01') };
            const epoch = new Date('2024-01-01T00:00:00Z').getTime();
            const result = formatDate(epoch, 'timestamp', dateFormatter);
            expect(result).toBe(epoch);
        });

        it('formats each value in an array', () => {
            const dateFormatter = { format: jest.fn().mockReturnValue('formatted') };
            const result = formatDate(['2024-01-01', '2024-01-02'], 'date', dateFormatter);
            expect(result).toEqual(['formatted', 'formatted']);
            expect(dateFormatter.format).toHaveBeenCalledTimes(2);
        });

        it('extracts the type from a dotted type reference', () => {
            const dateFormatter = { format: jest.fn().mockReturnValue('formatted') };
            const result = formatDate('2024-01-01', 'java.util.Date', dateFormatter);
            expect(dateFormatter.format).toHaveBeenCalled();
            expect(result).toBe('formatted');
        });
    });

    describe('getErrMessage', () => {
        it('returns the localized message for a known http status', () => {
            const localeObject = { MESSAGE_404_ERROR: 'Not found!' };
            expect(getErrMessage({ status: 404 }, localeObject)).toBe('Not found!');
        });

        it('falls back to a default message for a known status without a locale override', () => {
            expect(getErrMessage({ status: 404 }, {})).toBe('Requested resource not found');
        });

        it('parses WM service error format from err.error', () => {
            const err = {
                status: 500,
                error: { errors: { error: [{ message: 'Bad {0}', parameters: ['input'] }] } }
            };
            expect(getErrMessage(err, {})).toBe('Bad input');
        });

        it('falls back to a generic message when nothing else matches', () => {
            expect(getErrMessage({ status: 500 }, {})).toBe('Service Call Failed');
        });
    });

    describe('debounceVariableCall', () => {
        it('invokes the named operation on the variable after the debounce delay', () => {
            jest.useFakeTimers();
            const variable = { listRecords: jest.fn().mockResolvedValue(undefined) };
            debounceVariableCall(variable, 'listRecords');
            jest.advanceTimersByTime(150);
            expect(variable.listRecords).toHaveBeenCalledTimes(1);
            jest.useRealTimers();
        });

        it('cancels a pending call when invoked again before the delay elapses', () => {
            jest.useFakeTimers();
            const variable = { invoke: jest.fn().mockResolvedValue(undefined) };
            debounceVariableCall(variable, 'invoke');
            jest.advanceTimersByTime(50);
            debounceVariableCall(variable, 'invoke');
            jest.advanceTimersByTime(150);
            expect(variable.invoke).toHaveBeenCalledTimes(1);
            jest.useRealTimers();
        });
    });

    describe('updateInternalNodes', () => {
        it('reassigns previously computed internal node values back onto the variable', () => {
            const variable: any = { name: 'employeeVar', dataSet: {} };
            internalBoundNodeMap.set(variable, {
                employeeVar: {
                    dataSet: {
                        'department.budget': { q1: 100 }
                    }
                }
            });
            updateInternalNodes('department', 'dataSet', variable);
            expect(variable.dataSet.department).toEqual({ budget: { q1: 100 } });
        });
    });
});
