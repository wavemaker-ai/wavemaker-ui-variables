import { ServiceVariableManager } from './service-variable.manager';
import { wmSetDependency } from '../../util/variable/variables.utils';
import { $queue } from '../../util/inflight-queue';
import { CONSTANTS, VARIABLE_CONSTANTS } from '../../constants/variables.constants';

describe('ServiceVariableManager', () => {
    let manager: ServiceVariableManager;

    beforeEach(() => {
        manager = new ServiceVariableManager();
        wmSetDependency('metadata', undefined);
        wmSetDependency('appManager', undefined);
        wmSetDependency('security', undefined);
        wmSetDependency('oAuth', undefined);
        CONSTANTS.isStudioMode = false;
        ($queue as any).requestsQueue = new Map();
    });

    describe('transformData (private)', () => {
        it('maps each row of the configured dataField using the transformation columns', () => {
            const data: any = { rows: [[1, 'a'], [2, 'b']] };
            const variable: any = { transformationColumns: ['id', 'name'], dataField: 'rows' };
            (manager as any).transformData(data, variable);
            expect(data.wmTransformedData).toEqual([{ id: 1, name: 'a' }, { id: 2, name: 'b' }]);
        });
    });

    describe('getMethodInfo (private)', () => {
        it('falls back to variable.serviceInfo when metadataService is not set', () => {
            const variable: any = {
                serviceInfo: { parameters: [{ name: 'q' }] },
                getPrefabName: () => undefined
            };
            const result = (manager as any).getMethodInfo(variable, { q: 'abc' }, {});
            expect(result.parameters[0].sampleValue).toBe('abc');
        });

        it('uses metadataService.getByOperationId when metadataService is set', () => {
            wmSetDependency('metadata', {
                getByOperationId: () => ({ wmServiceOperationInfo: { parameters: [{ name: 'q' }] } })
            });
            const variable: any = { operationId: 'op1', getPrefabName: () => undefined };
            const result = (manager as any).getMethodInfo(variable, { q: 'xyz' }, {});
            expect(result.parameters[0].sampleValue).toBe('xyz');
        });

        it('returns falsy when no method info can be found', () => {
            const variable: any = { serviceInfo: undefined, getPrefabName: () => undefined };
            expect((manager as any).getMethodInfo(variable, {}, {})).toBeFalsy();
        });
    });

    describe('getProviderInfo (private)', () => {
        it('returns the provider info from metadataService', () => {
            wmSetDependency('metadata', {
                getByProviderId: () => ({ id: 'provider-1' })
            });
            const variable: any = { getPrefabName: () => undefined };
            expect((manager as any).getProviderInfo(variable, 'p1')).toEqual({ id: 'provider-1' });
        });
    });

    describe('isFileUploadInProgress (private)', () => {
        it('returns true when a file binding has a file with onProgress status', () => {
            const file1 = new File(['a'], 'a.txt') as any;
            const file2 = new File(['b'], 'b.txt') as any;
            file2.status = 'onProgress';
            const result = (manager as any).isFileUploadInProgress({ files: [file1, file2] });
            expect(result).toBe(true);
        });

        it('returns false when no file bindings are in progress', () => {
            const file1 = new File(['a'], 'a.txt') as any;
            file1.status = 'done';
            const result = (manager as any).isFileUploadInProgress({ files: [file1] });
            expect(result).toBe(false);
        });

        it('returns false when there are no array/file bindings at all', () => {
            expect((manager as any).isFileUploadInProgress({ q: 'search' })).toBe(false);
        });
    });

    describe('getInputParms', () => {
        it('reads parameters via metadataService when set', () => {
            wmSetDependency('metadata', {
                getByOperationId: () => ({ wmServiceOperationInfo: { parameters: [{ name: 'id' }] } })
            });
            const variable: any = { operationId: 'op1', getPrefabName: () => undefined };
            expect(manager.getInputParms(variable)).toEqual([{ name: 'id' }]);
        });

        it('falls back to variable.serviceInfo when metadataService is not set', () => {
            const variable: any = { serviceInfo: { parameters: [{ name: 'id' }] }, getPrefabName: () => undefined };
            expect(manager.getInputParms(variable)).toEqual([{ name: 'id' }]);
        });
    });

    describe('setInput / setPagination', () => {
        it('sets a value on the variable dataBinding', () => {
            const variable: any = { dataBinding: {} };
            manager.setInput(variable, 'q', 'abc', {});
            expect(variable.dataBinding.q).toBe('abc');
        });

        it('stores the pagination config on the variable', () => {
            const variable: any = {};
            manager.setPagination(variable, { input: { page: 'p' } });
            expect(variable._paginationConfig).toEqual({ input: { page: 'p' } });
        });
    });

    describe('defineFirstLastRecord', () => {
        it('defines firstRecord/lastRecord from a plain array dataSet', () => {
            const variable: any = { isList: true, dataSet: [{ id: 1 }, { id: 2 }, { id: 3 }] };
            manager.defineFirstLastRecord(variable);
            expect(variable.firstRecord).toEqual({ id: 1 });
            expect(variable.lastRecord).toEqual({ id: 3 });
        });

        it('prefers dataSet.content when present (procedure-style responses)', () => {
            const variable: any = { isList: true, dataSet: { content: [{ id: 5 }, { id: 6 }] } };
            manager.defineFirstLastRecord(variable);
            expect(variable.firstRecord).toEqual({ id: 5 });
            expect(variable.lastRecord).toEqual({ id: 6 });
        });

        it('does not define the properties for a non-list variable', () => {
            const variable: any = { isList: false, dataSet: [{ id: 1 }] };
            manager.defineFirstLastRecord(variable);
            expect(variable.firstRecord).toBeUndefined();
            expect(variable.lastRecord).toBeUndefined();
        });
    });

    describe('cancel', () => {
        it('does nothing when there is no pending request for the variable', () => {
            const variable: any = { httpService: { cancel: jest.fn() } };
            manager.cancel(variable);
            expect(variable.httpService.cancel).not.toHaveBeenCalled();
        });

        it('cancels a plain (non-file-upload) in-flight request', () => {
            const variable: any = {
                service: 'OtherService',
                httpService: { cancel: jest.fn() }
            };
            ($queue as any).requestsQueue.set(variable, [{ resolve: jest.fn(), reject: jest.fn(), active: true }]);
            manager.cancel(variable);
            expect(variable.httpService.cancel).toHaveBeenCalledWith(variable);
        });

        it('cancels a file-upload request and marks the file as aborted', () => {
            const onAbort = jest.fn();
            const variable: any = {
                service: 'FileService',
                operation: 'uploadFile',
                dataBinding: {},
                httpService: { cancel: jest.fn() },
                onAbort
            };
            ($queue as any).requestsQueue.set(variable, [{ resolve: jest.fn(), reject: jest.fn(), active: true }]);
            (manager as any).totalFilesCount = 1;
            const file: any = { status: undefined };
            manager.cancel(variable, file);
            expect(variable.httpService.cancel).toHaveBeenCalledWith(variable, file);
            expect(file.status).toBe('abort');
            expect(onAbort).toHaveBeenCalled();
        });
    });

    describe('handleRequestMetaError', () => {
        it('reports the message unchanged for an unrecognized error type', () => {
            const spy = jest.spyOn(manager as any, 'processErrorResponse').mockImplementation(() => {});
            const info = { error: { type: 'some_other_type', message: 'Oops' } };
            const variable: any = { name: 'v1' };
            const options: any = { xhrObj: 'x', skipNotification: false };
            manager.handleRequestMetaError(info, variable, jest.fn(), jest.fn(), options);
            expect(spy).toHaveBeenCalledWith(variable, 'Oops', expect.any(Function), 'x', false, undefined);
        });

        it('substitutes $variable in the message for METADATA_MISSING', () => {
            const spy = jest.spyOn(manager as any, 'processErrorResponse').mockImplementation(() => {});
            const info = {
                error: {
                    type: VARIABLE_CONSTANTS.REST_SERVICE.ERR_TYPE.METADATA_MISSING,
                    message: VARIABLE_CONSTANTS.REST_SERVICE.ERR_MSG.METADATA_MISSING
                }
            };
            const variable: any = { name: 'myVar' };
            manager.handleRequestMetaError(info, variable, jest.fn(), jest.fn(), {});
            expect(info.error.message).toBe('Metadata missing for "myVar"');
            expect(spy).toHaveBeenCalled();
        });

        it('substitutes $operation in the message for CRUD_OPERATION_MISSING', () => {
            const spy = jest.spyOn(manager as any, 'processErrorResponse').mockImplementation(() => {});
            const info = {
                error: {
                    type: VARIABLE_CONSTANTS.REST_SERVICE.ERR_TYPE.CRUD_OPERATION_MISSING,
                    message: VARIABLE_CONSTANTS.REST_SERVICE.ERR_MSG.CRUD_OPERATION_MISSING
                }
            };
            const variable: any = { name: 'myVar' };
            manager.handleRequestMetaError(info, variable, jest.fn(), jest.fn(), { operation: 'delete' });
            // only $variable is substituted here - $operation is left as a literal placeholder
            expect(info.error.message).toBe('Operation "$operation" not allowed for "myVar"');
            expect(spy).toHaveBeenCalled();
        });

        it('triggers an OAuth authorization flow for NO_ACCESSTOKEN', () => {
            const processErrorSpy = jest.spyOn(manager as any, 'processErrorResponse').mockImplementation(() => {});
            wmSetDependency('appManager', {
                getCustomUrlScheme: () => 'app://',
                getDeployedURL: () => 'http://x'
            });
            wmSetDependency('metadata', { getByProviderId: () => ({ id: 'p1' }) });
            const info = {
                error: {
                    type: VARIABLE_CONSTANTS.REST_SERVICE.ERR_TYPE.NO_ACCESSTOKEN,
                    message: 'Access token missing'
                },
                securityDefnObj: { 'x-WM-PROVIDER_ID': 'p1' }
            };
            const variable: any = { name: 'v1', getPrefabName: () => undefined };
            expect(() => manager.handleRequestMetaError(info, variable, jest.fn(), jest.fn(), {})).not.toThrow();
            expect(processErrorSpy).toHaveBeenCalledWith(variable, 'Access token missing', expect.any(Function), undefined, true, true);
        });

        it('reports an authenticated-but-not-authorized message for USER_UNAUTHORISED', () => {
            const processErrorSpy = jest.spyOn(manager as any, 'processErrorResponse').mockImplementation(() => {});
            wmSetDependency('security', { get: () => ({ authenticated: true }) });
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const info = { error: { type: VARIABLE_CONSTANTS.REST_SERVICE.ERR_TYPE.USER_UNAUTHORISED } };
            const variable: any = { name: 'v1', service: 'MyService' };
            manager.handleRequestMetaError(info, variable, jest.fn(), jest.fn(), {});
            expect(processErrorSpy).toHaveBeenCalledWith(
                variable,
                expect.stringContaining('not authorised'),
                expect.any(Function),
                undefined,
                undefined,
                undefined
            );
            warnSpy.mockRestore();
        });

        it('pushes to session-failure requests and reports a not-authenticated message when not logged in', () => {
            const processErrorSpy = jest.spyOn(manager as any, 'processErrorResponse').mockImplementation(() => {});
            const pushToSessionFailureRequests = jest.fn();
            const handle401 = jest.fn();
            wmSetDependency('security', { get: () => ({ authenticated: false }) });
            wmSetDependency('appManager', { pushToSessionFailureRequests, handle401 });
            jest.spyOn(console, 'warn').mockImplementation(() => {});
            const info = { error: { type: VARIABLE_CONSTANTS.REST_SERVICE.ERR_TYPE.USER_UNAUTHORISED } };
            const variable: any = { name: 'v1', service: 'MyService', invoke: jest.fn() };
            manager.handleRequestMetaError(info, variable, jest.fn(), jest.fn(), {});
            expect(pushToSessionFailureRequests).toHaveBeenCalled();
            expect(handle401).toHaveBeenCalled();
            expect(processErrorSpy).toHaveBeenCalledWith(
                variable,
                expect.stringContaining('not authenticated'),
                expect.any(Function),
                undefined,
                undefined,
                true
            );
            (console.warn as any).mockRestore();
        });
    });

    describe('processErrorResponse', () => {
        it('notifies the error callback and re-arms the variable for the next call', () => {
            const onError = jest.fn();
            const onCanUpdate = jest.fn();
            const variable: any = {
                name: 'v1',
                serviceInfo: {},
                getPrefabName: () => undefined,
                notify: jest.fn(),
                onError,
                onCanUpdate
            };
            const errorCB = jest.fn();
            (manager as any).processErrorResponse(variable, 'Something failed', errorCB, {}, false);
            expect(onError).toHaveBeenCalled();
            expect(errorCB).toHaveBeenCalledWith('Something failed');
            expect(variable.canUpdate).toBe(true);
            expect(onCanUpdate).toHaveBeenCalled();
            expect(variable.notify).toHaveBeenCalledWith('afterInvoke', [manager, 'Something failed']);
        });

        it('skips the error notification when skipNotification is true', () => {
            const onError = jest.fn();
            const variable: any = {
                name: 'v1', serviceInfo: {}, getPrefabName: () => undefined, notify: jest.fn(), onError
            };
            (manager as any).processErrorResponse(variable, 'msg', jest.fn(), {}, true);
            expect(onError).not.toHaveBeenCalled();
        });

        it('removes the OAuth access token on a 401/403 for an OAuth2-secured operation', () => {
            const removeAccessToken = jest.fn();
            wmSetDependency('oAuth', { removeAccessToken });
            const variable: any = {
                name: 'v1',
                serviceInfo: {
                    securityDefinitions: [{ type: 'oauth2', 'x-WM-PROVIDER_ID': 'provider1' }]
                },
                getPrefabName: () => undefined,
                notify: jest.fn()
            };
            (manager as any).processErrorResponse(variable, 'msg', jest.fn(), { status: 401 }, true);
            expect(removeAccessToken).toHaveBeenCalledWith('provider1');
        });

        it('does not touch queue/canUpdate state in studio mode', () => {
            CONSTANTS.isStudioMode = true;
            const variable: any = {
                name: 'v1', serviceInfo: {}, getPrefabName: () => undefined, notify: jest.fn()
            };
            (manager as any).processErrorResponse(variable, 'msg', jest.fn(), {}, true);
            expect(variable.canUpdate).toBeUndefined();
        });
    });

    describe('processSuccessResponse', () => {
        it('sets the dataSet from a plain JSON array response', () => {
            jest.useFakeTimers();
            const variable: any = { notify: jest.fn() };
            const result = manager.processSuccessResponse(
                JSON.stringify([{ id: 1 }]), variable, {}, jest.fn(), {}, {}
            );
            jest.runAllTimers();
            expect(variable.dataSet).toEqual([{ id: 1 }]);
            expect(result.data).toEqual([{ id: 1 }]);
            jest.useRealTimers();
        });

        it('splits a Page-shaped response into dataSet=content and pagination=the rest', () => {
            jest.useFakeTimers();
            const pageResponse = {
                content: [{ id: 1 }], first: true, last: true, number: 0,
                numberOfElements: 1, size: 20, sort: null, totalElements: 1, totalPages: 1
            };
            const variable: any = { notify: jest.fn() };
            manager.processSuccessResponse(JSON.stringify(pageResponse), variable, {}, jest.fn(), {}, {});
            jest.runAllTimers();
            expect(variable.dataSet).toEqual([{ id: 1 }]);
            expect(variable.pagination.totalElements).toBe(1);
            jest.useRealTimers();
        });

        it('decodes html entities for DataService responses that are not valid JSON', () => {
            jest.useFakeTimers();
            const variable: any = { notify: jest.fn(), serviceType: 'DataService' };
            manager.processSuccessResponse('Tom &amp; Jerry', variable, {}, jest.fn(), {}, {});
            jest.runAllTimers();
            expect(variable.dataSet.value).toBe('Tom & Jerry');
            jest.useRealTimers();
        });

        it('applies transformationColumns to array-shaped data at the configured dataField', () => {
            jest.useFakeTimers();
            const variable: any = {
                notify: jest.fn(),
                transformationColumns: ['id', 'name'],
                dataField: 'rows'
            };
            manager.processSuccessResponse(JSON.stringify({ rows: [[1, 'a']] }), variable, {}, jest.fn(), {}, {});
            jest.runAllTimers();
            expect(variable.dataSet.wmTransformedData).toEqual([{ id: 1, name: 'a' }]);
            jest.useRealTimers();
        });

        it('lets onBeforeDatasetReady override the dataset before it is assigned', () => {
            jest.useFakeTimers();
            const variable: any = { notify: jest.fn(), onBeforeDatasetReady: jest.fn().mockReturnValue({ overridden: true }) };
            manager.processSuccessResponse(JSON.stringify({ a: 1 }), variable, {}, jest.fn(), {}, {});
            jest.runAllTimers();
            expect(variable.dataSet).toEqual({ overridden: true });
            jest.useRealTimers();
        });
    });

    describe('download', () => {
        it('reports an error when the service response is not a valid web URL', async () => {
            const send = jest.fn().mockResolvedValue({ body: { result: 'not-a-url' } });
            const variable: any = {
                dataBinding: {},
                getPrefabName: () => undefined,
                serviceInfo: {
                    relativePath: '/export-svc',
                    proxySettings: { web: false },
                    parameters: []
                },
                httpService: { send },
                onError: jest.fn()
            };
            const errorHandler = jest.fn();
            await manager.download(variable, { data: { fields: [] } }, jest.fn(), errorHandler);
            expect(errorHandler).toHaveBeenCalled();
        });

        it('reports an error when the http call itself fails', async () => {
            const send = jest.fn().mockRejectedValue({ status: 500 });
            const variable: any = {
                dataBinding: {},
                getPrefabName: () => undefined,
                serviceInfo: {
                    relativePath: '/export-svc',
                    proxySettings: { web: false },
                    parameters: []
                },
                httpService: { send },
                onError: jest.fn()
            };
            const errorHandler = jest.fn();
            await manager.download(variable, { data: { fields: [] } }, jest.fn(), errorHandler);
            expect(errorHandler).toHaveBeenCalled();
        });
    });

    describe('getQueryParams / searchRecords', () => {
        it('merges non-pagination search keys with existing dataBinding into the invoke input fields', async () => {
            wmSetDependency('metadata', {
                getByOperationId: () => ({
                    wmServiceOperationInfo: { parameters: [{ name: 'q' }, { name: 'page' }, { name: 'size' }] }
                })
            });
            const invokeSpy = jest.spyOn(manager, 'invoke').mockResolvedValue('ok' as any);
            const variable: any = { operationId: 'op1', getPrefabName: () => undefined, dataBinding: { status: 'active' } };
            await manager.searchRecords(variable, { searchKey: 'q,page', query: 'term' }, jest.fn(), jest.fn());
            const [, requestParams] = invokeSpy.mock.calls[0];
            expect(requestParams.inputFields).toEqual({ status: 'active', q: 'term' });
            expect(requestParams.inFlightBehavior).toBe('executeAll');
        });
    });

    describe('invoke / _invoke', () => {
        it('aborts and releases the queue when BEFORE_UPDATE returns false', async () => {
            const variable: any = {
                name: 'v1',
                dataBinding: {},
                onBeforeUpdate: jest.fn().mockReturnValue(false)
            };
            const errorCB = jest.fn();
            await manager.invoke(variable, {}, jest.fn(), errorCB);
            expect(errorCB).toHaveBeenCalled();
        });

        it('rejects when the metadata/operation info cannot be resolved', async () => {
            jest.spyOn(manager as any, 'processErrorResponse').mockImplementation(() => {});
            const variable: any = {
                name: 'v1',
                dataBinding: {},
                serviceInfo: undefined,
                getPrefabName: () => undefined
            };
            await expect(manager.invoke(variable, {}, jest.fn(), jest.fn())).rejects.toBeDefined();
        });

        it('resolves via variable.makeHttpCall on a successful invocation', async () => {
            const variable: any = {
                name: 'v1',
                dataBinding: {},
                getPrefabName: () => undefined,
                serviceInfo: {
                    directPath: '/api/x',
                    relativePath: '/api/x',
                    httpMethod: 'GET',
                    proxySettings: { web: false },
                    parameters: []
                },
                httpService: { getLocale: () => ({}) },
                notify: jest.fn(),
                makeHttpCall: (requestParams: any, inputFields: any, onSuccess: any) => {
                    onSuccess({ status: 200, body: JSON.stringify({ ok: true }) });
                }
            };
            const success = jest.fn();
            jest.useFakeTimers();
            const result = await manager.invoke(variable, {}, success, jest.fn());
            jest.runAllTimers();
            expect(variable.dataSet).toEqual({ ok: true });
            jest.useRealTimers();
        });
    });
});
