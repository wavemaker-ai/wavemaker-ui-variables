const mockManager = {
    invoke: jest.fn(() => 'invoked'),
    download: jest.fn(() => 'downloaded'),
    setInput: jest.fn(() => 'input'),
    searchRecords: jest.fn(),
    getInputParms: jest.fn(() => []),
    setPagination: jest.fn(() => 'paged'),
    cancel: jest.fn(() => 'cancelled'),
    initBinding: jest.fn(),
    defineFirstLastRecord: jest.fn()
};

jest.mock('../../factory/variable-manager.factory', () => ({
    VariableManagerFactory: { get: jest.fn(() => mockManager) }
}));
jest.mock('../../util/variable/service-variable.utils', () => ({
    ServiceVariableUtils: { excludePaginationParams: jest.fn((fields: any[]) => fields.filter(f => !f.pagination)) }
}));

import { VARIABLE_CONSTANTS } from '../../constants/variables.constants';
import { DataSource } from '../../types/types';
import { ServiceVariable } from './service-variable';

describe('ServiceVariable', () => {
    let httpService: any;
    const make = (extra: any = {}) => new ServiceVariable({
        name: 'sv', dataSet: [], isList: false, service: 's', operation: 'o', operationId: 'id',
        dataBinding: [], serviceInfo: { info: 1 }, httpClientService: httpService, ...extra
    });

    beforeEach(() => {
        jest.clearAllMocks();
        httpService = { sendCall: jest.fn(() => Promise.resolve('resp')) };
    });

    it('stores the service info and http client from its configuration', () => {
        const v = make();
        expect(v.serviceInfo).toEqual({ info: 1 });
        expect(v.httpService).toBe(httpService);
    });

    describe('execute', () => {
        it('falls back to the base operations first', () => {
            expect(make().execute(DataSource.Operation.GET_NAME, {})).toBe('sv');
        });

        it('reports static capabilities', () => {
            const v = make();
            expect(v.execute(DataSource.Operation.IS_API_AWARE, {})).toBe(true);
            expect(v.execute(DataSource.Operation.SUPPORTS_CRUD, {})).toBe(false);
            expect(v.execute(DataSource.Operation.SUPPORTS_DISTINCT_API, {})).toBe(false);
            expect(v.execute(DataSource.Operation.SUPPORTS_SERVER_FILTER, {})).toBe(false);
            expect(v.execute(DataSource.Operation.IS_BOUND_TO_LOCALE, {})).toBe(false);
        });

        it('reports pagination capabilities', () => {
            const v: any = make({ controller: VARIABLE_CONSTANTS.CONTROLLER_TYPE.QUERY });
            expect(v.execute(DataSource.Operation.IS_PAGEABLE, {})).toBe(true);
            expect(v.execute(DataSource.Operation.IS_SORTABLE, {})).toBe(true);
            v._paginationConfig = {};
            expect(v.execute(DataSource.Operation.IS_SORTABLE, {})).toBe(false);
            const plain = make({ controller: 'other' });
            expect(plain.execute(DataSource.Operation.IS_PAGEABLE, {})).toBe(false);
            plain.pagination = { totalElements: 1 };
            expect(plain.execute(DataSource.Operation.IS_PAGEABLE, {})).toBe(true);
            expect(plain.execute(DataSource.Operation.GET_PAGING_OPTIONS, {})).toEqual({ totalElements: 1 });
        });

        it('routes data operations to the manager', () => {
            const v = make();
            expect(v.execute(DataSource.Operation.SET_INPUT, 'k')).toBe('input');
            expect(v.execute(DataSource.Operation.LIST_RECORDS, { o: 1 })).toBe('invoked');
            expect(v.execute(DataSource.Operation.INVOKE, { o: 2 })).toBe('invoked');
            expect(v.execute(DataSource.Operation.UPDATE, { o: 3 })).toBe('invoked');
            expect(v.execute(DataSource.Operation.DOWNLOAD, { o: 4 })).toBe('downloaded');
            expect(v.execute(DataSource.Operation.CANCEL, { o: 5 })).toBe('cancelled');
            expect(v.execute(DataSource.Operation.SET_PAGINATION, { o: 6 })).toBe('paged');
            expect(mockManager.invoke).toHaveBeenCalledTimes(3);
        });

        it('answers search and update-required operations through their helpers', async () => {
            const v: any = make();
            mockManager.searchRecords.mockImplementation((_v: any, _o: any, ok: Function) => ok({ content: [1] }, undefined));
            await expect(v.execute(DataSource.Operation.SEARCH_RECORDS, {})).resolves.toEqual({ data: [1], pagination: undefined });
            mockManager.getInputParms.mockReturnValue([]);
            expect(v.execute(DataSource.Operation.IS_UPDATE_REQUIRED, true)).toBe(false);
            expect(v.execute(DataSource.Operation.IS_UPDATE_REQUIRED, false)).toBe(true);
        });

        it('returns an empty object for unknown operations', () => {
            expect(make().execute('unknown' as any, {})).toEqual({});
        });
    });

    describe('searchRecords', () => {
        it('resolves with the content and pagination of the response', async () => {
            mockManager.searchRecords.mockImplementation((_v: any, _o: any, ok: Function) => ok({ content: [1, 2] }, { page: 1 }));
            await expect(make().searchRecords({})).resolves.toEqual({ data: [1, 2], pagination: { page: 1 } });
            mockManager.searchRecords.mockImplementation((_v: any, _o: any, ok: Function) => ok([3], undefined));
            await expect(make().searchRecords({})).resolves.toEqual({ data: [3], pagination: undefined });
        });

        it('rejects when the search fails', async () => {
            mockManager.searchRecords.mockImplementation((_v: any, _o: any, _ok: Function, fail: Function) => fail('bad'));
            await expect(make().searchRecords({})).rejects.toBe('bad');
        });
    });

    describe('isUpdateRequired', () => {
        it('is not required when there are no query params and data exists', () => {
            mockManager.getInputParms.mockReturnValue([{ pagination: true }]);
            expect(make().isUpdateRequired(true)).toBe(false);
        });

        it('is required without data, or when query params exist', () => {
            mockManager.getInputParms.mockReturnValue([{ pagination: true }]);
            expect(make().isUpdateRequired(false)).toBe(true);
            mockManager.getInputParms.mockReturnValue([{ name: 'q' }]);
            expect(make().isUpdateRequired(true)).toBe(true);
        });
    });

    it('delegates the remaining calls to the manager', () => {
        const v = make();
        expect(v.invoke({ a: 1 })).toBe('invoked');
        expect(v.update({ a: 2 })).toBe('invoked');
        expect(v.download({ a: 3 })).toBe('downloaded');
        expect(v.setInput('k', 'v', {})).toBe('input');
        expect(v.setPagination({ p: 1 })).toBe('paged');
        expect(v.cancel({ c: 1 })).toBe('cancelled');
        expect(mockManager.setInput).toHaveBeenCalledWith(v, 'k', 'v', {});
    });

    it('initialises bindings and first/last record accessors', () => {
        const v = make();
        v.init();
        expect(mockManager.initBinding).toHaveBeenCalledWith(v);
        expect(mockManager.defineFirstLastRecord).toHaveBeenCalledWith(v);
    });

    describe('makeHttpCall', () => {
        it('passes successful responses to the success handler', async () => {
            const ok = jest.fn(() => 'done');
            const fail = jest.fn();
            await expect(make().makeHttpCall({ r: 1 }, [], ok, fail)).resolves.toBe('done');
            expect(httpService.sendCall).toHaveBeenCalledWith({ r: 1 }, expect.anything());
            expect(fail).not.toHaveBeenCalled();
        });

        it('passes failures to the error handler', async () => {
            httpService.sendCall.mockReturnValue(Promise.reject('err'));
            const fail = jest.fn(() => 'handled');
            await expect(make().makeHttpCall({}, [], jest.fn(), fail)).resolves.toBe('handled');
            expect(fail).toHaveBeenCalledWith('err');
        });
    });
});
