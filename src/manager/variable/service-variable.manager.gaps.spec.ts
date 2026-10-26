import { ServiceVariableManager } from './service-variable.manager';
import { ServiceVariableUtils } from '../../util/variable/service-variable.utils';
import { PaginationUtils } from '../../util/variable/pagination.utils';
import * as variablesUtils from '../../util/variable/variables.utils';
import { wmSetDependency } from '../../util/variable/variables.utils';
import { $queue } from '../../util/inflight-queue';
import { CONSTANTS, VARIABLE_CONSTANTS } from '../../constants/variables.constants';

describe('ServiceVariableManager - remaining paths', () => {
    let manager: any;

    beforeEach(() => {
        jest.restoreAllMocks();
        manager = new ServiceVariableManager();
        wmSetDependency('metadata', undefined);
        wmSetDependency('appManager', undefined);
        wmSetDependency('oAuth', undefined);
        CONSTANTS.isStudioMode = false;
        ($queue as any).requestsQueue = new Map();
        jest.useFakeTimers();
    });

    afterEach(() => {
        jest.runOnlyPendingTimers();
        jest.useRealTimers();
    });

    describe('processSuccessResponse pagination handling', () => {
        const variable = () => ({
            name: 'sv',
            notify: jest.fn(),
            getPrefabName: () => '',
            serviceType: 'RestService'
        } as any);

        beforeEach(() => {
            jest.spyOn(variablesUtils, 'initiateCallback').mockImplementation(() => undefined);
            jest.spyOn(manager, 'getMethodInfo').mockReturnValue({ info: true });
        });

        it('records the generated pagination and exposes the legacy content getter for pageable responses', () => {
            jest.spyOn(PaginationUtils, 'getPaginationInfo').mockReturnValue({ p: 1 } as any);
            const generate = jest.spyOn(PaginationUtils, 'generatePaginationRes').mockReturnValue({ totalElements: 2 } as any);
            const record = jest.spyOn(PaginationUtils, 'setVariablePagination').mockImplementation(() => undefined);
            const v = variable();
            const response = { content: [{ a: 1 }, { a: 2 }], totalElements: 2, first: true, last: true, number: 0, numberOfElements: 2, size: 2, sort: null, totalPages: 1 };
            const out = manager.processSuccessResponse(JSON.stringify(response), v, {}, jest.fn());
            expect(generate).toHaveBeenCalled();
            expect(record).toHaveBeenCalledWith(v, { totalElements: 2 }, {});
            expect(v.dataSet).toHaveLength(2);
            expect((v.dataSet as any).content).toBe(v.dataSet);
            expect(out.data).toBe(v.dataSet);
            jest.advanceTimersByTime(10);
            expect(v.canUpdate).toBe(true);
        });

        it('ignores empty pagination results and keeps a configured pagination config', () => {
            jest.spyOn(PaginationUtils, 'getPaginationInfo').mockReturnValue({ p: 1 } as any);
            jest.spyOn(PaginationUtils, 'generatePaginationRes').mockReturnValue({} as any);
            const record = jest.spyOn(PaginationUtils, 'setVariablePagination').mockImplementation(() => undefined);
            const v: any = variable();
            v._paginationConfig = { c: 1 };
            v.pagination = 'unchanged';
            manager.processSuccessResponse(JSON.stringify([{ a: 1 }]), v, {}, jest.fn());
            expect(record).not.toHaveBeenCalled();
            expect(v.pagination).toBe('unchanged');
        });

        it('skips dataset updates when asked to', () => {
            jest.spyOn(PaginationUtils, 'getPaginationInfo').mockReturnValue(undefined as any);
            const v: any = variable();
            v.dataSet = 'before';
            manager.processSuccessResponse(JSON.stringify([{ a: 1 }]), v, { skipDataSetUpdate: true }, jest.fn());
            expect(v.dataSet).toBe('before');
        });
    });

    describe('getMethodInfo parameters', () => {
        const info = (parameters: any[], securityDefinitions?: any[]) => ({ parameters, securityDefinitions });

        it('applies pagination defaults and skips read-only parameters', () => {
            const v: any = {
                serviceInfo: info([
                    { name: 'ro', readOnly: true },
                    { name: 'size' }, { name: 'page' }, { name: 'sort' },
                    { name: 'q' }
                ]),
                maxResults: '15', orderBy: 'name asc', getPrefabName: () => ''
            };
            const result = manager.getMethodInfo(v, { q: 'x', ro: 'no' }, {});
            const byName: any = {};
            result.parameters.forEach((p: any) => (byName[p.name] = p));
            expect(byName.ro.sampleValue).toBeUndefined();
            expect(byName.size.sampleValue).toBe(15);
            expect(byName.page.sampleValue).toBe(1);
            expect(byName.sort.sampleValue).toBeDefined();
            expect(byName.q.sampleValue).toBe('x');
        });

        it('prefers explicit options and the pagination config for the page size and page', () => {
            const v: any = { serviceInfo: info([{ name: 'size' }, { name: 'page' }]), _paginationConfig: { input: { size: 7 } }, getPrefabName: () => '' };
            const fromConfig = manager.getMethodInfo(v, {}, {});
            expect(fromConfig.parameters[0].sampleValue).toBe(7);
            const v2: any = { serviceInfo: info([{ name: 'size' }, { name: 'page' }]), getPrefabName: () => '' };
            const explicit = manager.getMethodInfo(v2, {}, { size: 30, page: 4 });
            expect(explicit.parameters[0].sampleValue).toBe(30);
            expect(explicit.parameters[1].sampleValue).toBe(4);
            const defaults = manager.getMethodInfo({ serviceInfo: info([{ name: 'size' }]), getPrefabName: () => '' }, {}, {});
            expect(defaults.parameters[0].sampleValue).toBe(20);
        });

        it('fills the access token for OAuth2 secured services', () => {
            wmSetDependency('oAuth', { getAccessToken: jest.fn(() => 'secret') });
            const key = VARIABLE_CONSTANTS.REST_SERVICE.OAUTH_PROVIDER_KEY;
            const v: any = {
                serviceInfo: info([{ name: 'access_token' }], [{ type: VARIABLE_CONSTANTS.REST_SERVICE.SECURITY_DEFN.OAUTH2, [key]: 'prov' }]),
                getPrefabName: () => ''
            };
            expect(manager.getMethodInfo(v, {}, {}).parameters[0].sampleValue).toBe('secret');
            const plain: any = { serviceInfo: info([{ name: 'access_token' }]), getPrefabName: () => '' };
            expect(manager.getMethodInfo(plain, { access_token: 'given' }, {}).parameters[0].sampleValue).toBe('given');
        });

        it('returns method info without parameters untouched', () => {
            const v: any = { serviceInfo: { relativePath: '/x' }, getPrefabName: () => '' };
            expect(manager.getMethodInfo(v, {}, {})).toEqual({ relativePath: '/x' });
        });
    });

    describe('download', () => {
        const variable = (extra: any = {}) => ({
            dataBinding: {},
            serviceInfo: { relativePath: '/svc' },
            getPrefabName: () => '',
            httpService: { send: jest.fn(() => Promise.resolve({ body: { result: 'http://file' } })) },
            ...extra
        } as any);

        beforeEach(() => {
            jest.spyOn(console, 'error').mockImplementation(() => {});
            jest.spyOn(variablesUtils, 'initiateCallback').mockImplementation(() => undefined);
            jest.spyOn(ServiceVariableUtils, 'constructRequestParams').mockImplementation(() => ({ url: '/svc/export' } as any));
        });

        it('sends the export request with the overridden method and url', async () => {
            const v = variable();
            const success = jest.fn();
            await manager.download(v, { data: { fields: [] }, httpMethod: 'GET', url: '/custom' }, success, jest.fn());
            expect(v.httpService.send).toHaveBeenCalledWith(expect.objectContaining({ method: 'GET', url: '/custom' }));
        });

        it('defaults the method and url and works without options', async () => {
            const v = variable();
            await manager.download(v, undefined, jest.fn(), jest.fn());
            expect(v.httpService.send).toHaveBeenCalledWith(expect.objectContaining({ method: 'POST', url: '/svc/export' }));
        });

        it('rejects when building the request fails', async () => {
            (ServiceVariableUtils.constructRequestParams as jest.Mock).mockReturnValue({ error: { message: 'bad request' } });
            const errorHandler = jest.fn();
            await expect(manager.download(variable(), { data: {} }, jest.fn(), errorHandler)).rejects.toBe('bad request');
            expect(errorHandler).toHaveBeenCalledWith('bad request');
        });

        it('raises an error event for invalid results and failed calls', async () => {
            const errorHandler = jest.fn();
            const invalid = variable({ httpService: { send: jest.fn(() => Promise.resolve({ body: { result: 'not a url' } })) } });
            await manager.download(invalid, { data: {} }, jest.fn(), errorHandler);
            expect(errorHandler).toHaveBeenCalled();
            const failing = variable({ httpService: { send: jest.fn(() => Promise.reject('down')) } });
            await manager.download(failing, { data: {} }, jest.fn(), errorHandler);
            expect(errorHandler).toHaveBeenCalledWith('down');
        });
    });

    describe('input parameters and search', () => {
        it('reads the parameters from the metadata service or the variable', () => {
            wmSetDependency('metadata', { getByOperationId: () => ({ wmServiceOperationInfo: { parameters: ['meta'] } }) });
            expect(manager.getInputParms({ operationId: 'op', getPrefabName: () => '' })).toEqual(['meta']);
            wmSetDependency('metadata', undefined);
            expect(manager.getInputParms({ serviceInfo: { parameters: ['own'] } })).toEqual(['own']);
        });

        it('searchRecords maps the search value into query parameters and runs the call quietly', async () => {
            jest.spyOn(manager, 'getQueryParams').mockReturnValue({ name: 'bob' });
            const invoke = jest.spyOn(manager, 'invoke').mockReturnValue(Promise.reject('ignored'));
            const onBefore = jest.fn();
            const v: any = {};
            await manager.searchRecords(v, { searchKey: 'name', query: 'bob', page: 2, pagesize: 5, onBeforeservicecall: onBefore }, jest.fn(), jest.fn());
            expect(onBefore).toHaveBeenCalledWith({ name: 'bob' });
            expect(invoke).toHaveBeenCalledWith(v, expect.objectContaining({ page: 2, pagesize: 5, skipDataSetUpdate: true, inFlightBehavior: 'executeAll', inputFields: { name: 'bob' } }), expect.anything(), expect.anything());
        });

        it('searchRecords works without a before-call hook', async () => {
            jest.spyOn(manager, 'getQueryParams').mockReturnValue({});
            jest.spyOn(manager, 'invoke').mockReturnValue(Promise.resolve('ok'));
            await expect(manager.searchRecords({}, { searchKey: 'a' }, jest.fn(), jest.fn())).resolves.toBe('ok');
        });
    });
});
