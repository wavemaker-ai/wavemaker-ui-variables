import { CrudVariableManager } from './crud-variable.manager';
import { $rootScope } from '../../constants/variables.constants';
import { wmSetDependency } from '../../util/variable/variables.utils';
import { $queue } from '../../util/inflight-queue';

describe('CrudVariableManager - leftover branches', () => {
    let manager: any;
    let operations: any[];
    let notify: jest.Mock;

    const operation = (info: any = {}, type = 'list') => ({
        operationType: type,
        wmServiceOperationInfo: {
            directPath: 'http://host/api/users',
            relativePath: '/api/users',
            httpMethod: 'GET',
            proxySettings: { web: false },
            parameters: [],
            ...info
        }
    });

    const variable = (overrides: any = {}): any => ({
        name: 'crud1',
        crudOperationId: 'c1',
        serviceType: 'RestService',
        dataBinding: {},
        maxResults: 10,
        getPrefabName: () => undefined,
        httpService: { getLocale: () => ({}) },
        _context: { Actions: {} },
        ...overrides
    });

    beforeEach(() => {
        jest.restoreAllMocks();
        manager = new CrudVariableManager();
        notify = jest.fn();
        operations = [operation()];
        wmSetDependency('appManager', { notify });
        wmSetDependency('metadata', { getByCrudId: () => operations });
        ($rootScope as any).project = { id: 'p1', deployedUrl: 'http://host/' };
        ($queue as any).requestsQueue = new Map();
        jest.spyOn(manager, 'notifyInflight').mockImplementation(() => undefined);
        jest.spyOn(manager, 'processSuccessResponse').mockReturnValue({});
        jest.spyOn(manager, 'processErrorResponse').mockImplementation(() => undefined);
    });

    describe('getMethodInfoForCrud pagination params', () => {
        const methodInfo = (v: any, options: any, inputFields: any = {}) => manager.getMethodInfoForCrud(v, inputFields, options);
        const params = () => [{ name: 'page' }, { name: 'size' }, { name: 'sort' }].map(p => ({ ...p }));

        it('takes size, page and sort from options when present', () => {
            operations = [operation({ parameters: params() })];
            const info = methodInfo(variable({ orderBy: 'a asc' }), { operation: 'list', size: 7, page: 3, orderBy: 'b desc' });
            expect(info.parameters.map((p: any) => p.sampleValue)).toEqual([3, 7, expect.stringContaining('b desc')]);
        });

        it('falls back to input values, then defaults', () => {
            operations = [operation({ parameters: params() })];
            const withInput = methodInfo(variable(), { operation: 'list' }, { page: 4, size: 8, sort: 'x' });
            expect(withInput.parameters.map((p: any) => p.sampleValue)).toEqual([4, 8, 'x']);
            operations = [operation({ parameters: params() })];
            const defaults = methodInfo(variable({ maxResults: undefined }), { operation: 'list' });
            expect(defaults.parameters.map((p: any) => p.sampleValue)).toEqual([1, 20, '']);
        });

        it('handles operations without a parameter list', () => {
            operations = [operation({ parameters: undefined })];
            expect(methodInfo(variable(), { operation: 'list' }).parameters).toBeUndefined();
        });

        it('returns invalid operations untouched', () => {
            operations = [operation({ invalid: true })];
            expect(methodInfo(variable(), { operation: 'list' }).invalid).toBe(true);
        });
    });

    describe('invoke', () => {
        it('defaults options and operation, and reads the bound input fields', async () => {
            const v = variable({ dataBinding: { list: { a: 1 } } });
            const spy = jest.spyOn(manager, '_invoke').mockResolvedValue('done');
            await manager.invoke(v, undefined, jest.fn(), jest.fn());
            const options = spy.mock.calls[0][1] as any;
            expect(options.operation).toBe('list');
            expect(options.inputFields).toEqual({ a: 1 });
            expect(notify).toHaveBeenCalledWith('check-state-persistence-options', expect.anything());
        });

        it('keeps the supplied operation and input fields', async () => {
            const spy = jest.spyOn(manager, '_invoke').mockResolvedValue('done');
            await manager.invoke(variable(), { operation: 'insert', inputFields: { z: 1 } }, jest.fn(), jest.fn());
            expect((spy.mock.calls[0][1] as any).inputFields).toEqual({ z: 1 });
        });
    });

    describe('file download and upload', () => {
        it('simulates a download for octet-stream operations', () => {
            operations = [operation({ produces: ['application/octet-stream'] })];
            const v = variable({ simulateFileDownload: jest.fn().mockReturnValue('dl'), dataBinding: { file: 'f' } });
            expect(manager._invoke(v, { operation: 'list', inputFields: {} }, jest.fn(), jest.fn())).toBe('dl');
            expect(v.simulateFileDownload.mock.calls[0][1]).toBe('f');
        });

        it('falls back to the variable name for downloads', () => {
            operations = [operation({ produces: ['application/octet-stream'] })];
            const v = variable({ simulateFileDownload: jest.fn().mockReturnValue('dl') });
            v.dataBinding = {};
            manager._invoke(v, { operation: 'list', inputFields: {} }, jest.fn(), jest.fn());
            expect(v.simulateFileDownload.mock.calls[0][1]).toBe('crud1');
        });

        it('does not treat non array produces values as downloads', () => {
            operations = [operation({ produces: 'application/octet-stream' })];
            jest.spyOn(manager, 'httpCall').mockResolvedValue({ type: 'ok', body: '{}', headers: {} });
            const v = variable({ simulateFileDownload: jest.fn() });
            manager._invoke(v, { operation: 'list', inputFields: {} }, jest.fn(), jest.fn());
            expect(v.simulateFileDownload).not.toHaveBeenCalled();
        });
    });

    describe('initBinding', () => {
        it('flattens bindings per operation and tolerates missing bindings', () => {
            const v: any = { dataBinding: { list: [{ target: 'a' }], insert: null }, _context: {} };
            jest.spyOn(Object.getPrototypeOf(CrudVariableManager.prototype), 'initBinding').mockImplementation(() => undefined);
            manager.initBinding(v);
            expect(v.dataBinding).toEqual([{ target: 'list.a' }]);
            const empty: any = { _context: {} };
            manager.initBinding(empty);
            expect(empty.dataBinding).toEqual([]);
        });
    });

    describe('final branches', () => {
        it('fails for a missing service definition', () => {
            wmSetDependency('metadata', { getByCrudId: () => null });
            expect(() => manager.getMethodInfoForCrud(variable(), {}, { operation: 'list' })).toThrow();
        });

        it('keeps input fields as they are when the operation has no parameters', async () => {
            operations = [operation({ parameters: undefined })];
            const spy = jest.spyOn(manager, 'httpCall').mockResolvedValue({ type: 'ok', body: '{}', headers: {} });
            await manager._invoke(variable(), { operation: 'list', inputFields: { keep: 1 } }, jest.fn(), jest.fn());
            expect(spy).toHaveBeenCalled();
        });

        it('continues with the http call when the file upload yields no promise', async () => {
            const spy = jest.spyOn(manager, 'httpCall').mockResolvedValue({ type: 'ok', body: '{}', headers: {} });
            jest.spyOn(manager, 'uploadFile').mockReturnValue(undefined);
            const v = variable({ service: 'FileService', operation: 'uploadFile' });
            await manager._invoke(v, { operation: 'list', inputFields: {} }, jest.fn(), jest.fn());
            expect(spy).toHaveBeenCalled();
        });
    });
});
