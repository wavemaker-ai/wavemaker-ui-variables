import {
    DataType,
    IDGenerator,
    extractType,
    findValueOf,
    getBlob,
    getClonedObject,
    getValidJSON,
    hasCordova,
    isDateTimeType,
    isDefined,
    isNumberType,
    isObject,
    isPageable,
    isValidWebURL,
    noop,
    removeExtraSlashes,
    replace,
    stringStartsWith,
    triggerFn,
    xmlToJson,
} from './utils';

describe('utils', () => {
    describe('noop / isDefined / isObject', () => {
        it('noop returns undefined', () => {
            expect(noop(1, 2)).toBeUndefined();
        });

        it('isDefined distinguishes undefined from other values', () => {
            expect(isDefined(undefined)).toBe(false);
            expect(isDefined(null)).toBe(true);
            expect(isDefined(0)).toBe(true);
        });

        it('isObject is false for null and primitives', () => {
            expect(isObject(null)).toBe(false);
            expect(isObject('a')).toBe(false);
            expect(isObject({})).toBe(true);
            expect(isObject([])).toBe(true);
        });
    });

    describe('isValidWebURL', () => {
        it('accepts http and https urls', () => {
            expect(isValidWebURL('https://example.com/path')).toBe(true);
        });

        it('rejects non urls', () => {
            expect(isValidWebURL('not a url')).toBe(false);
        });
    });

    describe('isPageable', () => {
        const pageable = {
            content: [], first: true, last: true, number: 0, numberOfElements: 10,
            size: 20, sort: null, totalElements: 10, totalPages: 1,
        };

        it('recognises a pageable object with or without the empty flag', () => {
            expect(isPageable(pageable)).toBe(true);
            expect(isPageable({ ...pageable, empty: false })).toBe(true);
        });

        it('rejects objects with different keys', () => {
            expect(isPageable({ content: [] })).toBe(false);
        });
    });

    describe('IDGenerator', () => {
        it('produces sequential prefixed ids', () => {
            const generator = new IDGenerator('id');
            expect(generator.nextUid()).toBe('id1');
            expect(generator.nextUid()).toBe('id2');
        });
    });

    describe('hasCordova', () => {
        afterEach(() => {
            delete (window as any).cordova;
        });

        it('reflects the presence of window.cordova', () => {
            expect(hasCordova()).toBe(false);
            (window as any).cordova = {};
            expect(hasCordova()).toBe(true);
        });
    });

    describe('removeExtraSlashes', () => {
        it('collapses repeated slashes but keeps the protocol', () => {
            expect(removeExtraSlashes('http://a.com//b///c')).toBe('http://a.com/b/c');
        });

        it('leaves file:/// and base64 urls untouched', () => {
            expect(removeExtraSlashes('file:///a//b')).toBe('file:///a//b');
            const data = 'data:image/png;base64,AA//BB';
            expect(removeExtraSlashes(data)).toBe(data);
        });

        it('returns undefined for non string input', () => {
            expect(removeExtraSlashes(undefined)).toBeUndefined();
        });
    });

    describe('type helpers', () => {
        it('extractType returns the last segment lowercased', () => {
            expect(extractType('java.lang.String')).toBe('string');
        });

        it('extractType defaults to string for an empty reference', () => {
            expect(extractType('')).toBe(DataType.STRING);
        });

        it('extractType maps localdatetime to datetime', () => {
            expect(extractType('java.time.LocalDateTime')).toBe(DataType.DATETIME);
        });

        it('isNumberType recognises numeric types', () => {
            expect(isNumberType('java.lang.Integer')).toBe(true);
            expect(isNumberType('int')).toBe(true);
            expect(isNumberType('java.lang.String')).toBe(false);
        });

        it('isDateTimeType recognises plain and qualified date types', () => {
            expect(isDateTimeType('date')).toBe(true);
            expect(isDateTimeType('java.sql.Timestamp')).toBe(true);
            expect(isDateTimeType('string')).toBe(false);
        });
    });

    describe('getValidJSON', () => {
        it('returns undefined for empty content', () => {
            expect(getValidJSON('')).toBeUndefined();
            expect(getValidJSON(undefined)).toBeUndefined();
        });

        it('parses a json string', () => {
            expect(getValidJSON('{"a":1}')).toEqual({ a: 1 });
        });

        it('returns objects and numeric strings as they are', () => {
            const obj = { a: 1 };
            expect(getValidJSON(obj)).toBe(obj);
            expect(getValidJSON('12')).toBe('12');
        });

        it('returns undefined for invalid json', () => {
            expect(getValidJSON('{bad')).toBeUndefined();
        });
    });

    describe('xmlToJson', () => {
        it('converts an xml document to an object under its root node', () => {
            expect(xmlToJson('<root><name>wm</name></root>')).toEqual({ name: 'wm' });
        });

        it('returns null when the input is not convertible', () => {
            expect(xmlToJson('plain text')).toBeNull();
        });
    });

    describe('replace', () => {
        it('returns undefined without a template', () => {
            expect(replace('', {})).toBeUndefined();
        });

        it('replaces ${key} patterns from an object', () => {
            expect(replace('Hello, ${first} ${last}!', { first: 'wave', last: 'maker' })).toBe('Hello, wave maker!');
        });

        it('replaces {index} patterns from an array when parseError is set', () => {
            expect(replace('Hello, {0} {1}!', ['wave', 'maker'], true)).toBe('Hello, wave maker!');
        });
    });

    describe('getBlob', () => {
        it('returns a blob unchanged', () => {
            const blob = new Blob(['x']);
            expect(getBlob(blob)).toBe(blob);
        });

        it('wraps json content as application/json by default', () => {
            const blob = getBlob({ a: 1 });
            expect(blob.type).toBe('application/json');
        });

        it('honours an explicit content type for json', () => {
            expect(getBlob({ a: 1 }, 'text/x-json').type).toBe('text/x-json');
        });

        it('wraps non json content as text/plain by default', () => {
            expect(getBlob('plain').type).toBe('text/plain');
            expect(getBlob('plain', 'text/csv').type).toBe('text/csv');
        });
    });

    describe('getClonedObject', () => {
        it('deep clones the input', () => {
            const source = { a: { b: 1 } };
            const clone = getClonedObject(source);
            expect(clone).toEqual(source);
            expect(clone.a).not.toBe(source.a);
        });
    });

    describe('stringStartsWith', () => {
        it('is false for an empty string', () => {
            expect(stringStartsWith('', 'a')).toBe(false);
        });

        it('is case sensitive unless ignoreCase is set', () => {
            expect(stringStartsWith('Hello', 'he')).toBe(false);
            expect(stringStartsWith('Hello', 'he', true)).toBe(true);
        });
    });

    describe('triggerFn', () => {
        it('calls a function with the remaining arguments', () => {
            const fn = jest.fn().mockReturnValue('r');
            expect(triggerFn(fn, 1, 2)).toBe('r');
            expect(fn).toHaveBeenCalledWith(1, 2);
        });

        it('ignores a non function', () => {
            expect(triggerFn('nope', 1)).toBeUndefined();
        });
    });

    describe('findValueOf', () => {
        it('returns undefined without an object or key', () => {
            expect(findValueOf(null, 'a')).toBeUndefined();
            expect(findValueOf({}, '')).toBeUndefined();
        });

        it('reads nested values without creating anything', () => {
            const obj = { b: { c: 'd' } };
            expect(findValueOf(obj, 'b.c')).toBe('d');
            expect(findValueOf(obj, 'x')).toBeUndefined();
            expect(obj).toEqual({ b: { c: 'd' } });
        });

        it('creates missing nodes when create is true', () => {
            const obj: any = {};
            expect(findValueOf(obj, 'a.b', true)).toEqual({});
            expect(obj).toEqual({ a: { b: {} } });
        });

        it('creates arrays for indexed segments', () => {
            const obj: any = {};
            findValueOf(obj, 'list[0]', true);
            expect(Array.isArray(obj.list)).toBe(true);
        });

        it('parses existing json strings along the path', () => {
            const obj: any = { a: '{"b":1}' };
            expect(findValueOf(obj, 'a', true)).toEqual({ b: 1 });
        });
    });
});
