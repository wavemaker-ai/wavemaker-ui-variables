import DatasetUtil from './dataset-util';
import { findValueOf, xmlToJson } from './utils';
import { getAccessToken, performAuthorization, removeAccessToken } from './oAuth.utils';
import { $queue } from './inflight-queue';
import { wmSetDependency } from './variable/variables.utils';

describe('xmlToJson', () => {
    it('returns null for content that is not xml (x2js returns {})', () => {
        expect(xmlToJson('plain text')).toBeNull();
    });

    it('returns null for html parser error documents', () => {
        expect(xmlToJson('<html><body><parsererror>bad</parsererror></body></html>')).toBeNull();
    });

    it('returns the content of the root element', () => {
        expect(xmlToJson('<root><a>1</a></root>')).toEqual({ a: '1' });
    });
});

describe('findValueOf', () => {
    it('creates nested nodes along the path when asked to', () => {
        const obj: any = {};
        findValueOf(obj, 'a.b[0].c', true);
        expect(obj.a).toBeDefined();
    });

    it('reads values without creating them', () => {
        expect(findValueOf({ a: { b: 1 } }, 'a.b')).toBe(1);
        expect(findValueOf(null, 'a')).toBeUndefined();
        expect(findValueOf({}, '')).toBeUndefined();
    });
});

describe('oAuth.utils', () => {
    afterEach(() => {
        wmSetDependency('oAuth', undefined);
        wmSetDependency('appManager', undefined);
    });

    it('does nothing without an oauth service', () => {
        wmSetDependency('appManager', { getCustomUrlScheme: jest.fn(), getDeployedURL: jest.fn() });
        expect(() => performAuthorization('u', 'p', jest.fn(), jest.fn())).not.toThrow();
        expect(getAccessToken('p', true)).toBeUndefined();
    });

    it('delegates to the oauth service when present', () => {
        const svc = {
            perfromOAuthorization: jest.fn(),
            getAccessToken: jest.fn(() => 'tok'),
            removeAccessToken: jest.fn()
        };
        wmSetDependency('oAuth', svc);
        wmSetDependency('appManager', { getCustomUrlScheme: () => 'scheme', getDeployedURL: () => 'url' });
        const ok = jest.fn();
        const fail = jest.fn();
        performAuthorization('u', 'prov', ok, fail, { s: 1 });
        expect(svc.perfromOAuthorization).toHaveBeenCalledWith('u', 'prov', ok, fail, { s: 1 }, 'scheme', 'url');
        expect(getAccessToken('prov', true)).toBe('tok');
        removeAccessToken('prov');
        expect(svc.removeAccessToken).toHaveBeenCalledWith('prov');
    });

    it('returns undefined when the service has no getAccessToken', () => {
        wmSetDependency('oAuth', {});
        expect(getAccessToken('p', false)).toBeUndefined();
    });
});

describe('DatasetUtil edge cases', () => {
    it('sets items inside a nested array by index or by value', () => {
        const dataSet: any = [{ list: [{ a: 1 }, { a: 2 }] }];
        DatasetUtil.setItem(dataSet, 1, { a: 9 }, { isList: true, path: 'list', parentIndex: 0 });
        expect(dataSet[0].list[1]).toEqual({ a: 9 });
        DatasetUtil.setItem(dataSet, { a: 1 }, { a: 7 }, { isList: true, path: 'list', parentIndex: 0 });
        expect(dataSet[0].list[0]).toEqual({ a: 7 });
        DatasetUtil.setItem(dataSet, { a: 'missing' }, { a: 0 }, { isList: true, path: 'list', parentIndex: 0 });
        expect(dataSet[0].list).toHaveLength(2);
    });

    it('creates the nested list when adding to a missing path', () => {
        const withParent: any = [{}];
        DatasetUtil.addItem(withParent, 'x', undefined, { isList: true, path: 'items', parentIndex: 0 });
        expect(withParent[0].items).toEqual(['x']);
        const withoutParent: any = {};
        DatasetUtil.addItem(withoutParent, 'y', undefined, { isList: true, path: 'items' });
        expect(withoutParent.items).toEqual(['y']);
        const existing: any = { items: ['a'] };
        DatasetUtil.addItem(existing, 'z', 0, { isList: true, path: 'items' });
        expect(existing.items).toEqual(['z', 'a']);
        DatasetUtil.addItem(existing, 'end', undefined, { isList: true, path: 'items' });
        expect(existing.items[existing.items.length - 1]).toBe('end');
    });

    it('removes nested items, honouring exact match', () => {
        const dataSet: any = [{ list: [{ a: 1, b: 2 }, { a: 3 }] }];
        DatasetUtil.removeItem(dataSet, { a: 1 }, { exactMatch: true, path: 'list', parentIndex: 0 });
        expect(dataSet[0].list).toHaveLength(2);
        DatasetUtil.removeItem(dataSet, { a: 1 }, { exactMatch: false, path: 'list', parentIndex: 0 });
        expect(dataSet[0].list).toHaveLength(1);
        DatasetUtil.removeItem(dataSet, { a: 3 }, { exactMatch: true, path: 'list', parentIndex: 0 });
        expect(dataSet[0].list).toHaveLength(0);
        DatasetUtil.removeItem(dataSet, { a: 'none' }, { path: 'list', parentIndex: 0 });
    });

    it('removes top-level items by object with and without exact match, and the last item by default', () => {
        const dataSet: any = [{ a: 1, b: 2 }, { a: 2 }, { a: 3 }];
        DatasetUtil.removeItem(dataSet, { a: 1 }, true);
        expect(dataSet).toHaveLength(3);
        DatasetUtil.removeItem(dataSet, { a: 1 }, false);
        expect(dataSet).toHaveLength(2);
        DatasetUtil.removeItem(dataSet, undefined, {});
        expect(dataSet).toEqual([{ a: 2 }]);
    });
});

describe('$queue in-flight behaviours', () => {
    afterEach(() => {
        ($queue as any).requestsQueue = new Map();
    });

    it('queues further submissions behind an active request', () => {
        const variable: any = {};
        $queue.submit(variable);
        $queue.submit(variable);
        expect(($queue as any).requestsQueue.get(variable)).toHaveLength(2);
    });

    it('executeAll skips the active entry and releases the next one', () => {
        const variable: any = { inFlightBehavior: 'executeAll' };
        const resolve = jest.fn();
        ($queue as any).requestsQueue.set(variable, [
            { resolve: jest.fn(), reject: jest.fn(), active: true },
            { resolve, reject: jest.fn(), active: false },
            { resolve: jest.fn(), reject: jest.fn(), active: false }
        ]);
        $queue.process(variable);
        expect(resolve).toHaveBeenCalledTimes(1);
    });
});
