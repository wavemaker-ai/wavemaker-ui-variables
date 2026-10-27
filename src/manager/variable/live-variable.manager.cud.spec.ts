import { LiveVariableManager } from './live-variable.manager';
import { LiveVariableUtils } from '../../util/variable/live-variable.utils';
import { wmSetDependency } from '../../util/variable/variables.utils';
import { $queue } from '../../util/inflight-queue';
import { $rootScope, CONSTANTS } from '../../constants/variables.constants';

describe('LiveVariableManager - create, update and delete', () => {
    let manager: any;
    let makeCall: jest.SpyInstance;

    const variable = (overrides: any = {}): any => ({
        operation: 'insert',
        inputFields: {},
        propertiesMap: { primaryFields: ['id'] },
        liveSource: 'hrdb',
        type: 'User',
        dateFormatter: { format: (epoch: any) => `fmt-${epoch}` },
        notify: jest.fn(),
        onError: jest.fn(),
        _context: { Actions: {} },
        httpService: { getLocale: () => ({}) },
        ...overrides,
    });

    const stubUtils = (overrides: any = {}) => {
        jest.spyOn(LiveVariableUtils, 'getPrimaryKey').mockReturnValue(overrides.primaryKey || ['id']);
        jest.spyOn(LiveVariableUtils, 'isCompositeKey').mockImplementation((key: any) => (overrides.composite ?? key.length > 1));
        jest.spyOn(LiveVariableUtils, 'isNoPrimaryKey').mockReturnValue(overrides.noPrimaryKey ?? false);
        jest.spyOn(LiveVariableUtils, 'getFieldType').mockImplementation((name: string) => (overrides.types || {})[name] || 'string');
        jest.spyOn(LiveVariableUtils, 'isStringType').mockImplementation((type: string) => type === 'string');
        jest.spyOn(LiveVariableUtils, 'hasBlob').mockReturnValue(overrides.blob ?? false);
        jest.spyOn(LiveVariableUtils, 'prepareFormData').mockReturnValue('form-data' as any);
        jest.spyOn(LiveVariableUtils, 'getCompositeIDURL').mockImplementation((data: any) => Object.values(data).join('/'));
    };

    const call = () => ({ action: makeCall.mock.calls[0][1], operations: makeCall.mock.calls[0][2] });

    beforeEach(() => {
        manager = new LiveVariableManager();
        wmSetDependency('appManager', undefined);
        CONSTANTS.isStudioMode = false;
        ($rootScope as any).project = { id: 'p1', deployedUrl: 'http://host' };
        ($queue as any).requestsQueue = new Map();
        makeCall = jest.spyOn(manager, 'makeCall').mockResolvedValue({ type: 'ok', body: { id: 1 } });
        jest.spyOn(manager, 'notifyInflight').mockImplementation(() => undefined);
    });

    afterEach(() => {
        jest.useRealTimers();
        jest.restoreAllMocks();
    });

    describe('inserting', () => {
        it('sends the fields of the variable as the request data', async () => {
            stubUtils();
            await manager.insertRecord(variable({ inputFields: { name: 'wm', empty: '', missing: undefined } }), {}, jest.fn(), jest.fn());
            const { action, operations } = call();
            expect(action).toBe('insertTableData');
            expect(operations.data).toEqual({ name: 'wm' });
            expect(operations).toMatchObject({ projectID: 'p1', service: 'services', dataModelName: 'hrdb', entityName: 'User', url: 'http://host' });
        });

        it('formats date fields and joins list values for string fields', async () => {
            stubUtils({ types: { born: 'date', tags: 'string' } });
            await manager.insertRecord(variable({ inputFields: { born: 1700000000000, tags: ['a', 'b'] } }), {}, jest.fn(), jest.fn());
            expect(call().operations.data).toEqual({ born: 'fmt-1700000000000', tags: 'a,b' });
        });

        it('clears the blob fields of related entities', async () => {
            stubUtils({ types: { address: 'string' } });
            jest.spyOn(LiveVariableUtils, 'getFieldType').mockImplementation((name: string, _v: any, related?: string) => (related === 'photo' ? 'blob' : 'string'));
            const address = { photo: 'data', empty: null, name: 'x' };
            await manager.insertRecord(variable({ inputFields: { address } }), {}, jest.fn(), jest.fn());
            expect(call().operations.data.address.photo).toBe('');
            expect(address.photo).toBe('data');
        });

        it('uses the given row and merges the missing input fields into it', async () => {
            stubUtils({ types: { born: 'date', tags: 'string' } });
            const row: any = { name: 'row', born: 1700000000000, tags: ['x', 'y'], keep: '' };
            await manager.insertRecord(variable({ inputFields: { name: 'ignored', keep: 'filled', extra: 'e' } }), { row }, jest.fn(), jest.fn());
            expect(call().operations.data).toEqual({ name: 'row', born: 'fmt-1700000000000', tags: 'x,y', keep: 'filled', extra: 'e' });
        });

        it('sends multipart data for tables with blob columns', async () => {
            stubUtils({ blob: true });
            const originalFormData = (window as any).FormData;
            await manager.insertRecord(variable({ inputFields: { name: 'wm' } }), {}, jest.fn(), jest.fn());
            expect(call().action).toBe('insertMultiPartTableData');
            expect(call().operations.data).toBe('form-data');
            expect((window as any).FormData).toBe(originalFormData);
        });

        it('uses the prefab url for prefab variables', async () => {
            stubUtils();
            await manager.insertRecord(variable({ _prefabName: 'lib', inputFields: { a: 1 } }), {}, jest.fn(), jest.fn());
            expect(call().operations).toMatchObject({ service: '', url: 'http://host/prefabs/lib' });
        });

        it('uses the project name when the project has no id', async () => {
            stubUtils();
            ($rootScope as any).project = { deployedUrl: 'http://host' };
            ($rootScope as any).projectName = 'named';
            await manager.insertRecord(variable({ inputFields: { a: 1 } }), {}, jest.fn(), jest.fn());
            expect(call().operations.projectID).toBe('named');
            delete ($rootScope as any).projectName;
        });
    });

    describe('updating', () => {
        it('takes the id from the previous data', async () => {
            stubUtils();
            await manager.updateRecord(variable({ operation: 'update' }), { row: { id: 2, name: 'n' }, prevData: { id: 1 } }, jest.fn(), jest.fn());
            const { action, operations } = call();
            expect(action).toBe('updateTableData');
            expect(operations.id).toBe('1');
            expect(operations.data).toEqual({ id: 2, name: 'n' });
        });

        it('falls back to the row data and then the row for the id', async () => {
            stubUtils();
            await manager.updateRecord(variable({ operation: 'update' }), { row: { id: 3 }, rowData: { id: 2 } }, jest.fn(), jest.fn());
            expect(call().operations.id).toBe('2');
            makeCall.mockClear();
            await manager.updateRecord(variable({ operation: 'update' }), { row: { id: 3 } }, jest.fn(), jest.fn());
            expect(call().operations.id).toBe('3');
        });

        it('resolves nested primary keys through the previous data', async () => {
            stubUtils({ primaryKey: ['parent.id'] });
            await manager.updateRecord(variable({ operation: 'update' }), { row: { name: 'n' }, prevData: { parent: { id: 9 } } }, jest.fn(), jest.fn());
            expect(call().operations.id).toBe('9');
        });

        it('reads the id from the input fields when no row is given', async () => {
            stubUtils();
            await manager.updateRecord(variable({ operation: 'update', inputFields: { id: 4, name: 'n' } }), { prevData: { id: 4 } }, jest.fn(), jest.fn());
            expect(call().operations.data).toEqual({ id: 4, name: 'n' });
        });

        it('uses the composite key url for composite primary keys', async () => {
            stubUtils({ primaryKey: ['a', 'b'] });
            await manager.updateRecord(variable({ operation: 'update' }), { row: { a: 1, b: 2, c: 'x' }, prevData: { a: 10, b: 20 } }, jest.fn(), jest.fn());
            const { action, operations } = call();
            expect(action).toBe('updateCompositeTableData');
            expect(operations.id).toBe('10/20');
            expect(operations.data).toEqual({ a: 1, b: 2, c: 'x' });
        });

        it('keeps the updated keys for periodic updates', async () => {
            stubUtils({ primaryKey: ['a', 'b'] });
            await manager.updateRecord(variable({ operation: 'update' }), { row: { a: 1, b: 2 }, prevData: { a: 10, b: 20 }, period: true }, jest.fn(), jest.fn());
            expect(call().action).toBe('periodUpdateCompositeTableData');
            expect(call().operations.id).toBe('1/2');
        });

        it('treats tables without a primary key as composite using the whole row', async () => {
            stubUtils({ primaryKey: [], composite: true, noPrimaryKey: true });
            await manager.updateRecord(variable({ operation: 'update' }), { row: { name: 'n' }, prevData: { name: 'old' } }, jest.fn(), jest.fn());
            expect(call().action).toBe('updateCompositeTableData');
            expect(call().operations.id).toBe('old');
        });

        it('sends multipart updates for tables with blob columns', async () => {
            stubUtils({ blob: true });
            await manager.updateRecord(variable({ operation: 'update' }), { row: { id: 1 }, prevData: { id: 1 } }, jest.fn(), jest.fn());
            expect(call().action).toBe('updateMultiPartTableData');
        });

        it('sends multipart composite updates for blobs and composite keys', async () => {
            stubUtils({ blob: true, primaryKey: ['a', 'b'] });
            await manager.updateRecord(variable({ operation: 'update' }), { row: { a: 1, b: 2 }, prevData: { a: 1, b: 2 } }, jest.fn(), jest.fn());
            expect(call().action).toBe('updateMultiPartCompositeTableData');
        });

        it('collects the key from the input fields when updating without a row', async () => {
            stubUtils();
            const v = variable({ operation: 'update', inputFields: { id: 5 }, propertiesMap: { primaryFields: ['id'] } });
            await manager.updateRecord(v, { prevData: {} }, jest.fn(), jest.fn());
            expect(call().operations.id).toBe('5');
        });
    });

    describe('deleting', () => {
        it('uses the id of the given row and sends no body', async () => {
            stubUtils();
            await manager.deleteRecord(variable({ operation: 'delete' }), { row: { id: 7, name: 'n' } }, jest.fn(), jest.fn());
            const { action, operations } = call();
            expect(action).toBe('deleteTableData');
            expect(operations.id).toBe('7');
        });

        it('reads nested ids of the row', async () => {
            stubUtils({ primaryKey: ['parent.id'] });
            await manager.deleteRecord(variable({ operation: 'delete' }), { row: { parent: { id: 8 } } }, jest.fn(), jest.fn());
            expect(call().operations.id).toBe('8');
        });

        it('uses the single input field as the id when no row is given', async () => {
            stubUtils();
            await manager.deleteRecord(variable({ operation: 'delete', inputFields: { id: 11 } }), {}, jest.fn(), jest.fn());
            const { operations } = call();
            expect(operations.id).toBe(11);
            expect(operations.data).toBeUndefined();
        });

        it('deletes composite keys through the composite url', async () => {
            stubUtils({ primaryKey: ['a', 'b'] });
            await manager.deleteRecord(variable({ operation: 'delete' }), { row: { a: 1, b: 2, c: 3 } }, jest.fn(), jest.fn());
            expect(call().action).toBe('deleteCompositeTableData');
            expect(call().operations.id).toBe('1/2');
        });

        it('uses the whole row for tables without a primary key', async () => {
            stubUtils({ primaryKey: [], composite: true, noPrimaryKey: true });
            await manager.deleteRecord(variable({ operation: 'delete' }), { row: { name: 'n' } }, jest.fn(), jest.fn());
            expect(call().action).toBe('deleteCompositeTableData');
        });

        it('prefixes period deletes of composite keys', async () => {
            stubUtils({ primaryKey: ['a', 'b'] });
            await manager.deleteRecord(variable({ operation: 'delete' }), { row: { a: 1, b: 2 }, period: true }, jest.fn(), jest.fn());
            expect(call().action).toBe('periodDeleteCompositeTableData');
        });
    });

    describe('results', () => {
        it('reports the error of a failed call through the error events', async () => {
            stubUtils();
            makeCall.mockRejectedValue({ error: 'db down', details: { status: 500 } });
            const error = jest.fn();
            const v = variable({ onResult: jest.fn(), onCanUpdate: jest.fn() });
            await expect(manager.insertRecord(v, {}, jest.fn(), error)).rejects.toBe('db down');
            expect(v.onResult).toHaveBeenCalled();
            expect(v.onError).toHaveBeenCalled();
            expect(v.onCanUpdate).toHaveBeenCalled();
            expect(error).toHaveBeenCalledWith('db down');
            expect(v.canUpdate).toBe(true);
        });

        it('does not raise onError when notifications are skipped', async () => {
            stubUtils();
            makeCall.mockRejectedValue({ error: 'db down' });
            const v = variable();
            await expect(manager.insertRecord(v, { skipNotification: true }, jest.fn(), jest.fn())).rejects.toBeDefined();
            expect(v.onError).not.toHaveBeenCalled();
        });

        it('reports an error payload of a successful response', async () => {
            stubUtils();
            makeCall.mockResolvedValue({ type: 'ok', body: { error: 'constraint' } });
            const v = variable({ onResult: jest.fn(), onCanUpdate: jest.fn() });
            await expect(manager.insertRecord(v, {}, jest.fn(), jest.fn())).rejects.toBe('constraint');
            expect(v.onError).toHaveBeenCalled();
        });

        it('uses the prepared data set of write operations', async () => {
            stubUtils();
            jest.useFakeTimers();
            const v = variable({ onBeforeDatasetReady: jest.fn().mockReturnValue({ prepared: true }), onSuccess: jest.fn(), onCanUpdate: jest.fn() });
            const success = jest.fn();
            await manager.insertRecord(v, {}, success, jest.fn());
            jest.runAllTimers();
            expect(v.dataSet).toEqual({ prepared: true });
            expect(success).toHaveBeenCalledWith({ prepared: true });
            expect(v.onSuccess).toHaveBeenCalled();
        });

        it('does not replace the data set of read variables', async () => {
            stubUtils();
            const v = variable({ operation: 'read', dataSet: 'unchanged' });
            await manager.insertRecord(v, {}, jest.fn(), jest.fn());
            expect(v.dataSet).toBe('unchanged');
        });

        it('stops when onBeforeUpdate returns false and accepts replacement input', async () => {
            stubUtils();
            const stopped = variable({ onBeforeUpdate: () => false });
            await expect(manager.insertRecord(stopped, {}, jest.fn(), jest.fn())).rejects.toContain('onBeforeUpdate');
            const replaced = variable({ onBeforeUpdate: () => ({ replaced: 1 }), inputFields: { orig: 1 } });
            await manager.insertRecord(replaced, {}, jest.fn(), jest.fn());
            expect(call().operations.data).toEqual({ replaced: 1 });
        });
    });
});
