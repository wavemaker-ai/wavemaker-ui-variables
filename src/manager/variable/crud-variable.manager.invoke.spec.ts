import { CrudVariableManager } from './crud-variable.manager';
import { $rootScope } from '../../constants/variables.constants';
import { wmSetDependency } from '../../util/variable/variables.utils';
import { $queue } from '../../util/inflight-queue';
import { getAccessToken } from '../../util/oAuth.utils';

jest.mock('../../util/oAuth.utils', () => ({
    getAccessToken: jest.fn(() => 'token'),
}));

describe('CrudVariableManager - request flow', () => {
    let manager: any;
    let appNotify: jest.Mock;
    let httpCall: jest.SpyInstance;
    let success: jest.Mock;
    let error: jest.Mock;

    const operation = (type: string, info: any = {}) => ({
        operationType: type,
        wmServiceOperationInfo: {
            directPath: 'http://host/api/users',
            relativePath: '/api/users',
            httpMethod: type === 'list' ? 'GET' : type === 'delete' ? 'DELETE' : 'POST',
            proxySettings: { web: false },
            parameters: [],
            ...info,
        },
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
        ...overrides,
    });

    const useMetadata = (ops: any[]) => wmSetDependency('metadata', { getByCrudId: () => ops });

    beforeEach(() => {
        manager = new CrudVariableManager();
        appNotify = jest.fn();
        wmSetDependency('appManager', { notify: appNotify });
        ($rootScope as any).project = { id: 'p1', deployedUrl: 'http://host/' };
        ($queue as any).requestsQueue = new Map();
        success = jest.fn();
        error = jest.fn();
        httpCall = jest.spyOn(manager, 'httpCall').mockResolvedValue({ type: 'ok', body: '{"id":1}', headers: {} });
        jest.spyOn(manager, 'notifyInflight').mockImplementation(() => undefined);
        jest.spyOn(manager, 'processSuccessResponse').mockReturnValue({ id: 1 });
        jest.spyOn(manager, 'processErrorResponse').mockImplementation(() => undefined);
        (getAccessToken as jest.Mock).mockClear();
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('getMethodInfoForCrud', () => {
        it('returns missing and invalid metadata untouched', () => {
            useMetadata([]);
            expect(manager.getMethodInfoForCrud(variable(), {}, { operation: 'list' })).toBeUndefined();
            useMetadata([operation('list')]);
            expect(manager.getMethodInfoForCrud(variable(), {}, { operation: 'delete' })).toEqual({ invalid: true });
        });

        it('sets sample values and the defaults of the pagination params', () => {
            useMetadata([operation('list', {
                parameters: [
                    { name: 'q', parameterType: 'query' },
                    { name: 'size', parameterType: 'query' },
                    { name: 'page', parameterType: 'query' },
                    { name: 'sort', parameterType: 'query' },
                    { name: 'locked', parameterType: 'query', readOnly: true, sampleValue: 'keep' },
                ],
            })]);
            const info = manager.getMethodInfoForCrud(variable({ orderBy: 'name asc' }), { q: 'x' }, { operation: 'list', page: 3, orderBy: 'id desc' });
            const byName = (n: string) => info.parameters.find((p: any) => p.name === n).sampleValue;
            expect(byName('q')).toBe('x');
            expect(byName('size')).toBe(10);
            expect(byName('page')).toBe(3);
            expect(byName('sort')).toBe('id desc,name asc');
            expect(byName('locked')).toBe('keep');
        });

        it('falls back to the first page and size 20', () => {
            useMetadata([operation('list', { parameters: [{ name: 'size', parameterType: 'query' }, { name: 'page', parameterType: 'query' }, { name: 'sort', parameterType: 'query' }] })]);
            const info = manager.getMethodInfoForCrud(variable({ maxResults: undefined }), {}, { operation: 'list' });
            expect(info.parameters.map((p: any) => p.sampleValue)).toEqual([20, 1, '']);
        });

        it('uses the oauth access token for access_token params of oauth services', () => {
            useMetadata([operation('list', {
                securityDefinitions: [{ type: 'oauth2', 'x-WM-PROVIDER_ID': 'google' }],
                parameters: [{ name: 'access_token', parameterType: 'query' }],
            })]);
            const info = manager.getMethodInfoForCrud(variable(), {}, { operation: 'list' });
            expect(getAccessToken).toHaveBeenCalledWith('google', null);
            expect(info.parameters[0].sampleValue).toBe('token');
        });
    });

    describe('getPaginationInfo', () => {
        it('looks up the operation and clears its pagination info', () => {
            useMetadata([operation('list', {}), operation('create')]);
            const options: any = {};
            expect(manager.getPaginationInfo(variable(), {}, options)).toBeNull();
            expect(options.operation).toBe('list');
            expect(manager.getPaginationInfo(variable(), {}, { operation: 'missing' })).toBeUndefined();
        });
    });

    describe('invoke', () => {
        it('notifies the app, defaults the operation and queues the call', async () => {
            useMetadata([operation('list')]);
            const options: any = {};
            const v = variable({ dataBinding: { list: { q: 'x' } } });
            await manager.invoke(v, options, success, error);
            expect(appNotify).toHaveBeenCalledWith('check-state-persistence-options', { options, variable: v });
            expect(options.operation).toBe('list');
            expect(options.inputFields).toEqual({ q: 'x' });
            expect(httpCall).toHaveBeenCalled();
        });
    });

    describe('_invoke', () => {
        const run = (v: any, options: any) => manager._invoke(v, options, success, error);

        it('aborts when onBeforeUpdate returns false', () => {
            useMetadata([operation('list')]);
            const v = variable({ onBeforeUpdate: () => false });
            expect(run(v, { operation: 'list' })).toBeUndefined();
            expect(error).toHaveBeenCalled();
            expect(httpCall).not.toHaveBeenCalled();
        });

        it('lets onBeforeUpdate replace the input fields', async () => {
            useMetadata([operation('list', { parameters: [{ name: 'q', parameterType: 'query' }] })]);
            const v = variable({ onBeforeUpdate: () => ({ q: 'changed' }) });
            await run(v, { operation: 'list', inputFields: { q: 'orig' } });
            expect(httpCall.mock.calls[0][0].url).toContain('q=changed');
        });

        it('lists records through the http call and resolves with the response', async () => {
            useMetadata([operation('list', { parameters: [{ name: 'q', parameterType: 'query' }] })]);
            const response = await run(variable(), { operation: 'list', inputFields: { q: 'abc' } });
            const request = httpCall.mock.calls[0][0];
            expect(request.url).toBe('http://host/api/users?q=abc');
            expect(request.responseType).toBe('text');
            expect(response).toEqual({ type: 'ok', body: '{"id":1}', headers: {} });
            expect(manager.notifyInflight).toHaveBeenCalledWith(expect.anything(), true);
            expect(manager.processSuccessResponse).toHaveBeenCalled();
            expect(manager.notifyInflight).toHaveBeenLastCalledWith(expect.anything(), false, { id: 1 });
        });

        it('does not toggle the state when asked to skip it', async () => {
            useMetadata([operation('list')]);
            await run(variable(), { operation: 'list', skipToggleState: true });
            expect(manager.notifyInflight).toHaveBeenCalledWith(expect.anything(), false);
        });

        it('creates and updates with the body of the given row', async () => {
            useMetadata([
                operation('create', { parameters: [{ name: 'body', parameterType: 'body' }] }),
                operation('update', { parameters: [{ name: 'body', parameterType: 'body' }] }),
            ]);
            await run(variable(), { operation: 'create', row: { name: 'a' } });
            expect(httpCall.mock.calls[0][0].data).toEqual({ name: 'a' });
            await run(variable(), { operation: 'update', row: { id: 1, name: 'b' } });
            expect(httpCall.mock.calls[1][0].data).toEqual({ id: 1, name: 'b' });
        });

        it('wraps the fields into the request body when there is no body param', async () => {
            useMetadata([operation('create', { parameters: [{ name: 'tenant', parameterType: 'query' }] })]);
            await run(variable(), { operation: 'create', inputFields: { tenant: 't1', name: 'a' } });
            const request = httpCall.mock.calls[0][0];
            expect(request.url).toContain('tenant=t1');
        });

        it('merges the bindings of the operation into the input', async () => {
            useMetadata([operation('create', { parameters: [{ name: 'body', parameterType: 'body' }] })]);
            const v = variable({ dataBinding: { create: { body: { extra: 1 }, other: 2 } } });
            await run(v, { operation: 'create', row: { name: 'a' } });
            expect(httpCall.mock.calls[0][0].data).toEqual(expect.objectContaining({ name: 'a', extra: 1 }));
        });

        it('deletes by the path parameter of the given row', async () => {
            useMetadata([operation('delete', { relativePath: '/api/users/{id}', directPath: 'http://host/api/users/{id}', parameters: [{ name: 'id', parameterType: 'path' }] })]);
            await run(variable(), { operation: 'delete', row: { id: 7 } });
            expect(httpCall.mock.calls[0][0].url).toBe('http://host/api/users/7');
        });

        it('copies the path parameter value out of the request body when updating', async () => {
            useMetadata([operation('update', {
                relativePath: '/api/users/{id}',
                directPath: 'http://host/api/users/{id}',
                parameters: [{ name: 'id', parameterType: 'path' }, { name: 'body', parameterType: 'body' }]
            })]);
            await run(variable(), { operation: 'update', row: { id: 5, name: 'x' } });
            expect(httpCall.mock.calls[0][0].url).toBe('http://host/api/users/5');
        });

        it('falls back to the data binding or input fields to delete', async () => {
            useMetadata([operation('delete', { relativePath: '/api/users/{id}', directPath: 'http://host/api/users/{id}', parameters: [{ name: 'id', parameterType: 'path' }] })]);
            await run(variable({ dataBinding: { id: 9 } }), { operation: 'delete' });
            expect(httpCall.mock.calls[0][0].url).toBe('http://host/api/users/9');
        });

        it('reports unknown operations with the operation name', async () => {
            useMetadata([operation('list')]);
            jest.spyOn(manager, 'handleRequestMetaError').mockImplementation((params: any) => ({ error: { message: params.error.message } }));
            await expect(run(variable(), { operation: 'delete' })).rejects.toContain('delete');
            expect(error).toHaveBeenCalled();
            expect(httpCall).not.toHaveBeenCalled();
        });

        it('stays quiet about missing operations when asked to', async () => {
            useMetadata([operation('list')]);
            jest.spyOn(manager, 'handleRequestMetaError');
            await expect(run(variable(), { operation: 'delete', preventMissingOpMsg: true })).resolves.toBe('');
            expect(manager.handleRequestMetaError).not.toHaveBeenCalled();
        });

        it('rejects with a generic reason when the metadata error has no message', async () => {
            useMetadata([operation('list')]);
            jest.spyOn(manager, 'handleRequestMetaError').mockReturnValue(undefined);
            await expect(run(variable(), { operation: 'delete' })).rejects.toBe('An error occurred while triggering the variable');
        });

        it('reports http failures with the error message', async () => {
            useMetadata([operation('list')]);
            httpCall.mockRejectedValue({ status: 404 });
            await expect(run(variable(), { operation: 'list' })).rejects.toEqual({ error: 'Requested resource not found', details: { status: 404 } });
            expect(manager.processErrorResponse).toHaveBeenCalled();
            expect(manager.notifyInflight).toHaveBeenLastCalledWith(expect.anything(), false);
        });

        it('ignores responses without a type', async () => {
            useMetadata([operation('list')]);
            httpCall.mockResolvedValue({});
            let settled = false;
            run(variable(), { operation: 'list' }).then(() => { settled = true; });
            await new Promise((resolve) => setTimeout(resolve, 10));
            expect(settled).toBe(false);
        });

        it('downloads files for octet stream operations', () => {
            useMetadata([operation('list', { produces: ['application/octet-stream'] })]);
            const simulateFileDownload = jest.fn((_req: any, _name: any, _fmt: any, onOk: () => void, onFail: () => void) => {
                onOk();
                onFail();
                return 'downloading';
            });
            const v = variable({ simulateFileDownload, dataBinding: { file: 'report.csv', exportType: 'CSV' } });
            expect(run(v, { operation: 'list' })).toBe('downloading');
            expect(simulateFileDownload.mock.calls[0][1]).toBe('report.csv');
            expect(simulateFileDownload.mock.calls[0][2]).toBe('CSV');
            expect(success).toHaveBeenCalled();
            expect(error).toHaveBeenCalled();
            expect(httpCall).not.toHaveBeenCalled();
        });

        it('uploads files through the file upload handler', async () => {
            useMetadata([operation('create', { parameters: [{ name: 'body', parameterType: 'body' }] })]);
            const upload = jest.spyOn(manager, 'uploadFile').mockReturnValue(Promise.resolve('uploaded'));
            const v = variable({ service: 'FileService', operation: 'uploadFile' });
            await expect(run(v, { operation: 'create', row: { a: 1 } })).resolves.toBe('uploaded');
            expect(upload).toHaveBeenCalled();
        });
    });
});
