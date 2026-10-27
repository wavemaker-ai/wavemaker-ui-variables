import { ServiceVariableManager } from './service-variable.manager';
import { ServiceVariableUtils } from '../../util/variable/service-variable.utils';
import * as variablesUtils from '../../util/variable/variables.utils';
import * as uploadUtil from '../../util/file-upload.util';
import { wmSetDependency } from '../../util/variable/variables.utils';
import { $queue } from '../../util/inflight-queue';
import { CONSTANTS, VARIABLE_CONSTANTS } from '../../constants/variables.constants';

describe('ServiceVariableManager - branches', () => {
    let manager: any;

    beforeEach(() => {
        jest.restoreAllMocks();
        manager = new ServiceVariableManager();
        wmSetDependency('metadata', undefined);
        wmSetDependency('appManager', { notify: jest.fn() });
        CONSTANTS.isStudioMode = false;
        ($queue as any).requestsQueue = new Map();
        jest.spyOn(variablesUtils, 'initiateCallback').mockImplementation(() => undefined);
    });

    afterEach(() => {
        CONSTANTS.isStudioMode = false;
    });

    describe('processSuccessResponse', () => {
        const variable = (extra: any = {}) => ({ name: 'sv', notify: jest.fn(), getPrefabName: () => '', serviceType: 'RestService', ...extra } as any);

        it('decodes data service responses, replacing string responses with the decoded text', () => {
            jest.useFakeTimers();
            const v = variable({ serviceType: 'DataService' });
            manager.processSuccessResponse('plain &amp; text', v, {}, jest.fn());
            expect(v.dataSet).toEqual({ value: 'plain & text' });
            const object = variable({ serviceType: 'JavaService' });
            manager.processSuccessResponse(JSON.stringify({ a: 'x&lt;y' }), object, {}, jest.fn());
            expect(object.dataSet.a).toBe('x<y');
            const array = variable({ serviceType: 'DataService' });
            manager.processSuccessResponse(JSON.stringify([1, 2]), array, {}, jest.fn());
            expect(array.dataSet).toEqual([1, 2]);
            jest.runOnlyPendingTimers();
            jest.useRealTimers();
        });

        it('does not release the queue in studio mode', () => {
            jest.useFakeTimers();
            CONSTANTS.isStudioMode = true;
            const process = jest.spyOn($queue, 'process');
            const v = variable();
            manager.processSuccessResponse(JSON.stringify({ a: 1 }), v, {}, jest.fn());
            jest.runOnlyPendingTimers();
            expect(process).not.toHaveBeenCalled();
            expect(v.canUpdate).toBeUndefined();
            jest.useRealTimers();
        });
    });

    describe('handleRequestMetaError', () => {
        beforeEach(() => {
            jest.spyOn(console, 'warn').mockImplementation(() => undefined);
            jest.spyOn(console, 'error').mockImplementation(() => undefined);
            jest.spyOn(manager, 'processErrorResponse').mockImplementation(() => undefined);
        });

        const handle = (info: any) => manager.handleRequestMetaError(info, { name: 'sv' }, jest.fn(), jest.fn(), { operation: 'list' });
        const T = VARIABLE_CONSTANTS.REST_SERVICE.ERR_TYPE;

        it.each([[T.METADATA_MISSING], [T.CRUD_OPERATION_MISSING]])('handles %s errors with and without messages', type => {
            handle({ error: { type, message: 'Missing $variable' } });
            expect(console.warn).toHaveBeenCalledWith(expect.stringContaining('Missing sv'));
            (console.warn as jest.Mock).mockClear();
            handle({ error: { type } });
            expect(console.warn).not.toHaveBeenCalled();
            expect(manager.processErrorResponse).toHaveBeenCalledTimes(2);
        });

        it('reports unknown errors only when they carry a message', () => {
            handle({ error: { type: 'other', message: 'oops' } });
            expect(manager.processErrorResponse).toHaveBeenCalledTimes(1);
            handle({ error: { type: 'other' } });
            expect(manager.processErrorResponse).toHaveBeenCalledTimes(1);
        });

        it('logs failures while handling errors', () => {
            expect(handle(undefined)).toBeUndefined();
            expect(console.error).toHaveBeenCalled();
        });
    });

    describe('getMethodInfo parameters', () => {
        it('uses the size/sort fallbacks and ignores other parameter names', () => {
            const info = { parameters: [{ name: 'size' }, { name: 'sort' }, { name: 'q' }] };
            const v: any = { serviceInfo: info, maxResults: undefined, orderBy: undefined, getPrefabName: () => '' };
            const result = manager.getMethodInfo(v, {}, {});
            expect(result.parameters[0].sampleValue).toBe(20);
            expect(result.parameters[1].sampleValue).toBe('');
            expect(result.parameters[2].sampleValue).toBeUndefined();
        });

        it('keeps a sampled sort value when the order by is empty', () => {
            const v: any = { serviceInfo: { parameters: [{ name: 'sort' }] }, getPrefabName: () => '' };
            expect(manager.getMethodInfo(v, { sort: 'name asc' }, {}).parameters[0].sampleValue).toBe('name asc');
        });

        it('keeps the metadata service result when a service definition is missing', () => {
            wmSetDependency('metadata', { getByOperationId: () => null });
            const v: any = { operationId: 'op', getPrefabName: () => '' };
            expect(manager.getMethodInfo(v, {}, {})).toBeFalsy();
        });
    });

    describe('provider info', () => {
        it('returns undefined without a metadata service', () => {
            expect(manager.getProviderInfo({ getPrefabName: () => '' }, 'p')).toBeUndefined();
            wmSetDependency('metadata', { getByProviderId: jest.fn(() => ({ id: 'p' })) });
            expect(manager.getProviderInfo({ getPrefabName: () => '' }, 'p')).toEqual({ id: 'p' });
        });
    });

    describe('file uploads', () => {
        const file = (name = 'a.txt') => new File(['x'], name);

        it('detects uploads in progress', () => {
            expect(manager.isFileUploadInProgress({ files: [Object.assign(file(), { status: 'onProgress' })], other: 'x', notFiles: [1] })).toBe(true);
            expect(manager.isFileUploadInProgress({ files: [Object.assign(file(), { status: 'done' })] })).toBe(false);
            expect(manager.isFileUploadInProgress(undefined)).toBe(false);
        });

        it('uploads one file or several files per request and ignores non-file inputs', () => {
            const spy = jest.spyOn(manager, 'uploadFileInFormData').mockReturnValue(Promise.resolve('uploaded') as any);
            const single = manager.uploadFile({}, {}, jest.fn(), jest.fn(), { files: [file()], name: 'x' }, {});
            expect(spy).toHaveBeenCalledTimes(1);
            expect(single).toBeInstanceOf(Promise);

            spy.mockClear();
            const multi = manager.uploadFile({}, {}, jest.fn(), jest.fn(), { files: [file('1'), file('2')] }, {});
            expect(spy).toHaveBeenCalledTimes(2);
            expect(multi).toBeInstanceOf(Promise);

            expect(manager.uploadFile({}, {}, jest.fn(), jest.fn(), { text: 'nothing' }, {})).toBeUndefined();
            const direct = manager.uploadFile({}, {}, jest.fn(), jest.fn(), { files: file() }, {});
            expect(direct).toBeDefined();
        });

        it('counts blob holding objects as files', () => {
            jest.spyOn(manager, 'uploadFileInFormData').mockReturnValue(Promise.resolve('uploaded') as any);
            const result = manager.uploadFile({}, {}, jest.fn(), jest.fn(), { files: [{ blob: new Blob(['x']) }] }, {});
            expect(result).toBeDefined();
        });

        it('reports upload results that failed without a progress observable', async () => {
            jest.spyOn(uploadUtil, 'upload').mockReturnValue(Promise.resolve([{ success: false, errorMessage: 'bad' }]) as any);
            jest.spyOn(manager, 'processErrorResponse').mockImplementation(() => undefined);
            const v: any = { _progressObservable: undefined, name: 'sv', httpService: {} };
            const f: any = file();
            await manager.uploadFileInFormData(v, {}, jest.fn(), jest.fn(), f, { data: {}, url: '/u' });
            expect(f._response).toEqual({ success: false, errorMessage: 'bad' });
        });
    });

    describe('cancel', () => {
        const queued = (v: any) => ($queue as any).requestsQueue.set(v, [{ resolve: jest.fn(), reject: jest.fn(), active: false }]);

        it('does nothing when nothing is queued', () => {
            const v: any = { httpService: { cancel: jest.fn() } };
            manager.cancel(v);
            expect(v.httpService.cancel).not.toHaveBeenCalled();
        });

        it('keeps the queue while other uploads are still running', () => {
            const v: any = { service: 'FileService', operation: 'uploadFile', dataBinding: { files: [Object.assign(new File(['x'], 'a'), { status: 'onProgress' })] }, httpService: { cancel: jest.fn() } };
            queued(v);
            const process = jest.spyOn($queue, 'process');
            manager.totalFilesCount = 2;
            manager.cancel(v, { status: '' });
            expect(process).not.toHaveBeenCalled();
            expect(v.httpService.cancel).toHaveBeenCalled();
        });

        it('cancels plain requests only when the http service supports it', () => {
            const supported: any = { httpService: { cancel: jest.fn() } };
            queued(supported);
            manager.cancel(supported);
            expect(supported.httpService.cancel).toHaveBeenCalledWith(supported);
            const unsupported: any = { httpService: {} };
            queued(unsupported);
            expect(() => manager.cancel(unsupported)).not.toThrow();
        });
    });

    describe('first and last records', () => {
        it('falls back to the dataset itself and to an empty object', () => {
            const list: any = { isList: true, dataSet: [{ a: 1 }, { a: 2 }] };
            manager.defineFirstLastRecord(list);
            expect(list.firstRecord).toEqual({ a: 1 });
            expect(list.lastRecord).toEqual({ a: 2 });
            list.dataSet = { content: [{ c: 1 }, { c: 2 }] };
            expect(list.firstRecord).toEqual({ c: 1 });
            expect(list.lastRecord).toEqual({ c: 2 });
            list.dataSet = undefined;
            expect(list.firstRecord).toEqual({});
            expect(list.lastRecord).toEqual({});
            const single: any = { isList: false };
            manager.defineFirstLastRecord(single);
            expect(single.firstRecord).toBeUndefined();
        });
    });

    describe('transformData', () => {
        it('tolerates a missing data field', () => {
            const data: any = {};
            manager.transformData(data, { transformationColumns: ['a'], dataField: 'rows' });
            expect(data.wmTransformedData).toEqual([]);
        });
    });
});
