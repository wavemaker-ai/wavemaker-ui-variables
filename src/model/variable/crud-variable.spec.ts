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
import { CrudVariable } from './crud-variable';

describe('CrudVariable', () => {
    let httpService: any;
    const make = (extra: any = {}) => new CrudVariable({ name: 'cv', isList: true, httpService, ...extra });

    beforeEach(() => {
        jest.clearAllMocks();
        httpService = { sendCall: jest.fn(() => Promise.resolve('resp')) };
    });

    it('creates per-operation helpers that tag their calls with the operation', () => {
        const v: any = make();
        v.list.invoke({ a: 1 }, 's', 'e');
        expect(mockManager.invoke).toHaveBeenLastCalledWith(v, { a: 1, operation: 'list' }, 's', 'e');
        v.create.invoke();
        expect(mockManager.invoke).toHaveBeenLastCalledWith(v, { operation: 'create' }, undefined, undefined);
        v.update.invoke({}, 's');
        expect(mockManager.invoke).toHaveBeenLastCalledWith(v, { operation: 'update' }, 's', undefined);
        v.delete.invoke({ b: 1 });
        expect(mockManager.invoke).toHaveBeenLastCalledWith(v, { b: 1, operation: 'delete' }, undefined, undefined);

        v.list.setInput('k', 'v', {});
        expect(mockManager.setInput).toHaveBeenLastCalledWith(v, 'k', 'v', {}, 'list');
        v.create.setInput('k');
        expect(mockManager.setInput).toHaveBeenLastCalledWith(v, 'k', undefined, undefined, 'create');
        v.update.setInput('k');
        expect(mockManager.setInput).toHaveBeenLastCalledWith(v, 'k', undefined, undefined, 'update');
        v.delete.setInput('k');
        expect(mockManager.setInput).toHaveBeenLastCalledWith(v, 'k', undefined, undefined, 'delete');
    });

    describe('execute', () => {
        it('answers the base operations first', () => {
            expect(make().execute(DataSource.Operation.GET_NAME, {})).toBe('cv');
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
            const plain: any = make({ controller: 'other' });
            expect(plain.execute(DataSource.Operation.IS_PAGEABLE, {})).toBe(false);
            plain.pagination = { totalElements: 1 };
            expect(plain.execute(DataSource.Operation.IS_PAGEABLE, {})).toBe(true);
            expect(plain.execute(DataSource.Operation.GET_PAGING_OPTIONS, {})).toEqual({ totalElements: 1 });
        });

        it('routes generic data operations to the manager', () => {
            const v = make();
            expect(v.execute(DataSource.Operation.SET_INPUT, 'k')).toBe('input');
            expect(v.execute(DataSource.Operation.LIST_RECORDS, {})).toBe('invoked');
            expect(v.execute(DataSource.Operation.INVOKE, {})).toBe('invoked');
            expect(v.execute(DataSource.Operation.UPDATE, {})).toBe('invoked');
            expect(v.execute(DataSource.Operation.DOWNLOAD, {})).toBe('downloaded');
            expect(v.execute(DataSource.Operation.CANCEL, {})).toBe('cancelled');
            expect(v.execute(DataSource.Operation.SET_PAGINATION, {})).toBe('paged');
        });

        it.each([
            [DataSource.Operation.INSERT_RECORD, 'create'],
            [DataSource.Operation.UPDATE_RECORD, 'update'],
            [DataSource.Operation.DELETE_RECORD, 'delete']
        ])('tags %s calls with the %s operation', (op, name) => {
            const options: any = {};
            expect(make().execute(op, options)).toBe('invoked');
            expect(options.operation).toBe(name);
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

    describe('record helpers', () => {
        it.each([
            ['createRecord', 'create'],
            ['listRecords', 'list'],
            ['updateRecord', 'update'],
            ['deleteRecord', 'delete']
        ])('%s invokes the %s operation', (method, name) => {
            const v: any = make();
            expect(v[method]({ x: 1 }, 's', 'e')).toBe('invoked');
            expect(mockManager.invoke).toHaveBeenLastCalledWith(v, { x: 1, operation: name }, 's', 'e');
            v[method]();
            expect(mockManager.invoke).toHaveBeenLastCalledWith(v, { operation: name }, undefined, undefined);
        });

        it('invoke, download, setInput, setPagination and cancel delegate to the manager', () => {
            const v = make();
            expect(v.invoke({ a: 1 }, 's', 'e')).toBe('invoked');
            expect(v.download({ a: 2 }, 's', 'e')).toBe('downloaded');
            expect(v.setInput('k', 'v', {})).toBe('input');
            expect(v.setPagination({ p: 1 })).toBe('paged');
            expect(v.cancel({ c: 1 })).toBe('cancelled');
        });
    });

    describe('searchRecords', () => {
        it('resolves with data and pagination', async () => {
            mockManager.searchRecords.mockImplementation((_v: any, _o: any, ok: Function) => ok({ content: [1] }, { page: 2 }));
            await expect(make().searchRecords({})).resolves.toEqual({ data: [1], pagination: { page: 2 } });
            mockManager.searchRecords.mockImplementation((_v: any, _o: any, ok: Function) => ok([2], undefined));
            await expect(make().searchRecords({})).resolves.toEqual({ data: [2], pagination: undefined });
        });

        it('rejects on failure', async () => {
            mockManager.searchRecords.mockImplementation((_v: any, _o: any, _ok: Function, fail: Function) => fail('bad'));
            await expect(make().searchRecords({})).rejects.toBe('bad');
        });
    });

    describe('isUpdateRequired', () => {
        it('is skipped only when there are no query params and data exists', () => {
            mockManager.getInputParms.mockReturnValue([{ pagination: true }]);
            expect(make().isUpdateRequired(true)).toBe(false);
            expect(make().isUpdateRequired(false)).toBe(true);
            mockManager.getInputParms.mockReturnValue([{ name: 'q' }]);
            expect(make().isUpdateRequired(true)).toBe(true);
        });
    });

    it('initialises bindings and first/last record accessors', () => {
        const v = make();
        v.init();
        expect(mockManager.initBinding).toHaveBeenCalledWith(v);
        expect(mockManager.defineFirstLastRecord).toHaveBeenCalledWith(v);
    });

    describe('makeHttpCall', () => {
        it('routes the outcome to the success or error handler', async () => {
            const ok = jest.fn(() => 'done');
            await expect(make().makeHttpCall({ r: 1 }, [], ok, jest.fn())).resolves.toBe('done');
            httpService.sendCall.mockReturnValue(Promise.reject('err'));
            const fail = jest.fn(() => 'handled');
            await expect(make().makeHttpCall({}, [], jest.fn(), fail)).resolves.toBe('handled');
        });
    });
});
