import { ServiceVariableManager } from './service-variable.manager';
import { wmSetDependency } from '../../util/variable/variables.utils';
import { $queue } from '../../util/inflight-queue';
import { $rootScope } from '../../constants/variables.constants';
import { upload } from '../../util/file-upload.util';

jest.mock('../../util/file-upload.util', () => ({
    upload: jest.fn(),
}));

type Handlers = { ok?: Function; fail?: Function; progress?: Function };

describe('ServiceVariableManager - file transfers and request flow', () => {
    let manager: any;
    let appManager: any;
    let handlers: Handlers;
    let processError: jest.SpyInstance;
    let processSuccess: jest.SpyInstance;

    const variable = (overrides: any = {}): any => ({
        name: 'svc',
        service: 'FileService',
        operation: 'uploadFile',
        serviceType: 'RestService',
        dataBinding: {},
        getPrefabName: () => undefined,
        httpService: { getLocale: () => ({}) },
        _context: { Actions: {} },
        _progressObservable: { next: jest.fn() },
        makeHttpCall: jest.fn(),
        ...overrides,
    });

    beforeEach(() => {
        manager = new ServiceVariableManager();
        handlers = {};
        (upload as jest.Mock).mockReset();
        (upload as jest.Mock).mockImplementation(() => ({
            then: (ok: Function, fail: Function, progress: Function) => {
                handlers = { ok, fail, progress };
            },
        }));
        appManager = {
            notify: jest.fn(),
            notifyApp: jest.fn(),
            getAppLocale: () => ({ MESSAGE_FILE_UPLOAD_SUCCESS: 'uploaded', MESSAGE_FILE_UPLOAD_ERROR: 'failed' }),
        };
        wmSetDependency('appManager', appManager);
        wmSetDependency('metadata', undefined);
        ($rootScope as any).project = { id: 'p1', deployedUrl: 'http://host/' };
        ($queue as any).requestsQueue = new Map();
        processError = jest.spyOn(manager, 'processErrorResponse').mockImplementation(() => undefined);
        processSuccess = jest.spyOn(manager, 'processSuccessResponse').mockReturnValue({ ok: true });
        jest.spyOn(manager, 'notifyInflight').mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('uploadFileInFormData', () => {
        const file = (name = 'a.txt'): any => Object.assign(new File(['x'], name), { uniqueId: 'u1' });
        const send = (v: any, f: any, options: any = {}) => manager.uploadFileInFormData(v, options, jest.fn(), jest.fn(), f, { data: new FormData(), url: '/upload' });

        it('uploads under the files param to the request url', () => {
            const f = file();
            send(variable(), f);
            expect(upload).toHaveBeenCalledWith(f, expect.anything(), expect.any(FormData), { fileParamName: 'files', url: '/upload' });
        });

        it('finishes the upload after the last file succeeded', () => {
            const v = variable();
            const f = file();
            manager.totalFilesCount = 1;
            send(v, f);
            handlers.ok!([{ success: true }]);
            expect(processSuccess).toHaveBeenCalled();
            expect(appManager.notifyApp).toHaveBeenCalledWith('uploaded', 'success');
            expect(manager.fileUploadCount).toBe(0);
            expect(manager.totalFilesCount).toBe(0);
            expect(f._response).toEqual({ success: true });
        });

        it('does not notify when the variable has an onSuccess handler', () => {
            manager.totalFilesCount = 1;
            send(variable({ onSuccess: () => undefined }), file());
            handlers.ok!([{ success: true }]);
            expect(appManager.notifyApp).not.toHaveBeenCalled();
        });

        it('waits for the remaining files before finishing', () => {
            manager.totalFilesCount = 2;
            send(variable(), file());
            handlers.ok!([{ success: true }]);
            expect(processSuccess).not.toHaveBeenCalled();
            expect(manager.fileUploadCount).toBe(1);
        });

        it('reports a backend rejection of a file', () => {
            const v = variable();
            const f = file();
            manager.totalFilesCount = 1;
            send(v, f);
            handlers.ok!([{ success: false, errorMessage: 'too big' }]);
            expect(v._progressObservable.next).toHaveBeenCalledWith({ status: 'error', fileName: 'a.txt', errMsg: 'too big', uniqueId: 'u1' });
            expect(processError).toHaveBeenCalledWith(v, 'too big', expect.any(Function), expect.anything(), undefined);
            expect(manager.fileUploadResponse).toEqual([]);
        });

        it('raises the error event when some files failed earlier', () => {
            manager.totalFilesCount = 2;
            manager.failedFileUploadCount = 1;
            const onError = jest.fn();
            const v = variable({ onError });
            send(v, file());
            manager.fileUploadCount = 1;
            handlers.ok!([{ success: true }]);
            expect(onError).toHaveBeenCalled();
            expect(appManager.notifyApp).toHaveBeenCalledWith('failed', 'error');
            expect(manager.totalFilesCount).toBe(0);
        });

        it('reports transfer failures once every file was attempted', () => {
            const v = variable();
            const f = file();
            manager.totalFilesCount = 1;
            send(v, f);
            handlers.fail!({ status: 500 });
            expect(v._progressObservable.next).toHaveBeenCalledWith(expect.objectContaining({ status: 'error', fileName: 'a.txt' }));
            expect(processError).toHaveBeenCalled();
            expect(manager.failedFileUploadCount).toBe(0);
        });

        it('keeps counting failures while other files are pending', () => {
            manager.totalFilesCount = 2;
            send(variable({ _progressObservable: undefined }), file());
            handlers.fail!({ status: 500 });
            expect(processError).not.toHaveBeenCalled();
            expect(manager.failedFileUploadCount).toBe(1);
        });

        it('forwards the progress of the transfer', () => {
            const onProgress = jest.fn();
            const v = variable({ onProgress });
            send(v, file());
            handlers.progress!({ loaded: 5, total: 10 });
            expect(v._progressObservable.next).toHaveBeenCalledWith({ progress: { loaded: 5, total: 10 }, status: 'onProgress', fileName: 'a.txt', uniqueId: 'u1' });
            expect(onProgress).toHaveBeenCalled();
            expect(() => send(variable({ _progressObservable: undefined }), file())).not.toThrow();
            handlers.progress!({});
        });
    });

    describe('uploadFile', () => {
        const file = (name: string): any => new File(['x'], name);
        let sendOne: jest.SpyInstance;

        beforeEach(() => {
            sendOne = jest.spyOn(manager, 'uploadFileInFormData').mockReturnValue('promise');
        });

        it('uploads a single file', () => {
            const f = file('a.txt');
            const result = manager.uploadFile(variable(), {}, jest.fn(), jest.fn(), { files: [f] }, {});
            expect(result).toBe('promise');
            expect(sendOne).toHaveBeenCalledTimes(1);
            expect(manager.totalFilesCount).toBe(1);
        });

        it('uploads every file of a list separately', async () => {
            const result = manager.uploadFile(variable(), {}, jest.fn(), jest.fn(), { files: [file('a'), file('b')] }, {});
            await expect(result).resolves.toEqual(['promise', 'promise']);
            expect(sendOne).toHaveBeenCalledTimes(2);
            expect(manager.totalFilesCount).toBe(2);
        });

        it('handles a file that is a direct input field', () => {
            const f = file('single');
            manager.uploadFile(variable(), {}, jest.fn(), jest.fn(), { files: f }, {});
            expect(sendOne).toHaveBeenCalled();
        });

        it('accepts objects that contain a blob', () => {
            manager.uploadFile(variable(), {}, jest.fn(), jest.fn(), { files: [{ content: new Blob(['x']), name: 'b' }] }, {});
            expect(sendOne).toHaveBeenCalledTimes(1);
        });

        it('does nothing without files or with several file params', () => {
            expect(manager.uploadFile(variable(), {}, jest.fn(), jest.fn(), { files: [] }, {})).toBeUndefined();
            expect(manager.uploadFile(variable(), {}, jest.fn(), jest.fn(), { a: [file('a')], b: [file('b')] }, {})).toBeUndefined();
            expect(sendOne).not.toHaveBeenCalled();
        });
    });

    describe('_invoke', () => {
        const info = (extra: any = {}) => ({
            directPath: 'http://host/api',
            relativePath: '/api',
            httpMethod: 'GET',
            proxySettings: { web: false },
            parameters: [],
            ...extra,
        });
        let success: jest.Mock;
        let error: jest.Mock;

        const run = (v: any, options: any = {}) => manager._invoke(v, options, success, error);

        beforeEach(() => {
            success = jest.fn();
            error = jest.fn();
        });

        it('aborts when onBeforeUpdate returns false', () => {
            const v = variable({ service: 'x', serviceInfo: info(), onBeforeUpdate: () => false });
            expect(run(v)).toBeUndefined();
            expect(error).toHaveBeenCalled();
        });

        it('uses the object returned by onBeforeUpdate as the input', async () => {
            const v = variable({ service: 'x', serviceInfo: info({ parameters: [{ name: 'q', parameterType: 'query' }] }), onBeforeUpdate: () => ({ q: 'changed' }) });
            v.makeHttpCall.mockImplementation((_req: any, _input: any, ok: Function) => ok({ type: 'ok', body: '{}' }));
            await run(v, { inputFields: { q: 'orig' } });
            expect(v.makeHttpCall.mock.calls[0][0].url).toContain('q=changed');
        });

        it('rejects with the metadata error of the variable', async () => {
            const v = variable({ service: 'x', serviceInfo: undefined });
            jest.spyOn(manager, 'handleRequestMetaError').mockReturnValue({ error: { message: 'metadata missing' } });
            await expect(run(v)).rejects.toContain('metadata missing');
            expect(error).toHaveBeenCalled();
        });

        it('uploads files for the file service', async () => {
            const f = new File(['x'], 'a.txt');
            const v = variable({ serviceInfo: info({ httpMethod: 'POST' }) });
            jest.spyOn(manager, 'uploadFile').mockReturnValue(Promise.resolve('uploaded'));
            await expect(run(v, { inputFields: { files: [f] } })).resolves.toBe('uploaded');
        });

        it('falls through to the http call when nothing needs uploading', async () => {
            const v = variable({ serviceInfo: info() });
            jest.spyOn(manager, 'uploadFile').mockReturnValue(undefined);
            v.makeHttpCall.mockImplementation((_req: any, _input: any, ok: Function) => ok({ type: 'ok', body: '{}' }));
            await run(v, { inputFields: {} });
            expect(v.makeHttpCall).toHaveBeenCalled();
        });

        it('downloads octet stream responses', () => {
            const simulateFileDownload = jest.fn((_r: any, _n: any, _f: any, ok: () => void, fail: (e?: any) => void) => {
                ok();
                fail({ status: 404 });
                fail();
                return 'download';
            });
            const v = variable({ service: 'x', serviceInfo: info({ produces: ['application/octet-stream'] }), simulateFileDownload, dataBinding: { file: 'f.csv', exportType: 'CSV' } });
            expect(run(v)).toBe('download');
            expect(simulateFileDownload.mock.calls[0][1]).toBe('f.csv');
            expect(success).toHaveBeenCalled();
            expect(error).toHaveBeenCalledTimes(2);
        });

        it('resolves with the response of the http call', async () => {
            const v = variable({ service: 'x', serviceInfo: info() });
            v.makeHttpCall.mockImplementation((_r: any, _i: any, ok: Function) => ok({ type: 'ok', body: '{"a":1}', headers: {} }));
            const response = await run(v, {});
            expect(response).toEqual({ type: 'ok', body: '{"a":1}', headers: {} });
            expect(processSuccess).toHaveBeenCalled();
            expect(manager.notifyInflight).toHaveBeenLastCalledWith(v, false, { ok: true });
        });

        it('accepts status based responses and reads their data', async () => {
            const v = variable({ service: 'x', serviceInfo: info() });
            v.makeHttpCall.mockImplementation((_r: any, _i: any, ok: Function) => ok({ status: 200, data: 'payload' }));
            await run(v, {});
            expect(processSuccess.mock.calls[0][0]).toBe('payload');
        });

        it('reports a successful file deletion', async () => {
            const next = jest.fn();
            const v = variable({ operation: 'deleteFile', serviceInfo: info(), _deleteFileObservable: { next, error: jest.fn() } });
            v.makeHttpCall.mockImplementation((_r: any, _i: any, ok: Function) => ok({ type: 'ok', body: 'done' }));
            await run(v, {});
            expect(next).toHaveBeenCalledWith({ status: 'success', response: 'done' });
            expect(appManager.notifyApp).toHaveBeenCalledWith('File delete success', 'success');
        });

        it('reports http failures with parsed error details', async () => {
            const v = variable({ service: 'x', serviceInfo: info() });
            v.makeHttpCall.mockImplementation((_r: any, _i: any, _ok: Function, fail: Function) => fail({ status: 500, error: '{"message":"boom"}' }));
            await expect(run(v, {})).rejects.toEqual({ error: 'Service Call Failed', details: { status: 500, error: { message: 'boom' } } });
            expect(processError).toHaveBeenCalled();
        });

        it('tolerates failures without details', async () => {
            const v = variable({ service: 'x', serviceInfo: info() });
            v.makeHttpCall.mockImplementation((_r: any, _i: any, _ok: Function, fail: Function) => fail());
            await expect(run(v, {})).rejects.toEqual(expect.objectContaining({ error: 'Service Call Failed' }));
        });

        it('reports a failed file deletion', async () => {
            const error$ = jest.fn();
            const v = variable({ operation: 'deleteFile', serviceInfo: info(), _deleteFileObservable: { next: jest.fn(), error: error$ } });
            v.makeHttpCall.mockImplementation((_r: any, _i: any, _ok: Function, fail: Function) => fail({ status: 500 }));
            await expect(run(v, {})).rejects.toBeDefined();
            expect(error$).toHaveBeenCalledWith(expect.objectContaining({ status: 'error' }));
            expect(appManager.notifyApp).toHaveBeenCalledWith('File delete failed', 'error');
        });
    });

    describe('invoke', () => {
        it('queues the call with the input fields of the variable', async () => {
            const v = variable({ service: 'x', serviceInfo: { directPath: 'http://h/a', relativePath: '/a', httpMethod: 'GET', proxySettings: { web: false }, parameters: [] }, dataBinding: { q: 1 } });
            v.makeHttpCall.mockImplementation((_r: any, _i: any, ok: Function) => ok({ type: 'ok', body: '{}' }));
            const options: any = {};
            await manager.invoke(v, options, jest.fn(), jest.fn());
            expect(options.inputFields).toEqual({ q: 1 });
        });
    });
});
