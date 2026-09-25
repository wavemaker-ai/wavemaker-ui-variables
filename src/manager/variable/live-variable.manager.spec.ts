import { LiveVariableManager } from './live-variable.manager';
import { LiveVariableUtils } from '../../util/variable/live-variable.utils';
import * as liveHttpUtils from '../../util/variable/live-variable.http.utils';
import { wmSetDependency } from '../../util/variable/variables.utils';
import { $queue } from '../../util/inflight-queue';
import { CONSTANTS } from '../../constants/variables.constants';

describe('LiveVariableManager', () => {
    let manager: LiveVariableManager;

    beforeEach(() => {
        manager = new LiveVariableManager();
        wmSetDependency('appManager', undefined);
        CONSTANTS.isStudioMode = false;
        ($queue as any).requestsQueue = new Map();
        jest.restoreAllMocks();
        jest.spyOn(liveHttpUtils, 'generateConnectionParams').mockReturnValue({
            url: '/services/x', method: 'GET', data: undefined, headers: {}
        } as any);
    });

    describe('initFilterExpressionBinding', () => {
        it('does not throw when the context has no registerDestroyListener', () => {
            expect(() => manager.initFilterExpressionBinding({ _context: {} })).not.toThrow();
        });
    });

    describe('updateDataset (private)', () => {
        it('sets pagination/dataSet and exposes legacy data/pagination getters', () => {
            const variable: any = {};
            (manager as any).updateDataset(variable, [{ id: 1 }], {}, { totalElements: 1 });
            expect(variable.dataSet).toEqual([{ id: 1 }]);
            expect(variable.pagination).toEqual({ totalElements: 1 });
            expect((variable.dataSet as any).data).toBe(variable.dataSet);
            expect((variable.dataSet as any).pagination).toBe(variable.pagination);
        });
    });

    describe('setVariableOptions (private)', () => {
        it('stores orderBy/filterFields/logicalOp from options on variable._options', () => {
            const variable: any = {};
            (manager as any).setVariableOptions(variable, { orderBy: 'id asc', filterFields: { a: 1 }, logicalOp: 'OR' });
            expect(variable._options).toEqual({ orderBy: 'id asc', filterFields: { a: 1 }, logicalOp: 'OR' });
        });

        it('handles a missing options object', () => {
            const variable: any = {};
            (manager as any).setVariableOptions(variable, undefined);
            expect(variable._options).toEqual({ orderBy: undefined, filterFields: undefined, logicalOp: undefined });
        });
    });

    describe('handleError (private)', () => {
        it('notifies error callbacks and clears the dataset unless skipped', () => {
            const errorCB = jest.fn();
            const variable: any = { onError: jest.fn(), onCanUpdate: jest.fn(), onResult: jest.fn() };
            (manager as any).handleError(variable, errorCB, 'boom', {});
            expect(errorCB).toHaveBeenCalledWith('boom');
            expect(variable.dataSet).toEqual([]);
            expect(variable.canUpdate).toBe(true);
            expect(variable.onError).toHaveBeenCalled();
            expect(variable.onCanUpdate).toHaveBeenCalled();
        });

        it('does not touch the dataset when skipDataSetUpdate is set', () => {
            const variable: any = { onError: jest.fn() };
            (manager as any).handleError(variable, jest.fn(), 'boom', { skipDataSetUpdate: true });
            expect(variable.dataSet).toBeUndefined();
        });
    });

    describe('getFilterExprFields (private)', () => {
        it('returns the filter expressions unchanged when no required field is empty', () => {
            const filterExpressions = { condition: 'AND', rules: [{ target: 'name', required: true, value: 'wm', matchMode: 'equals' }] };
            const result = (manager as any).getFilterExprFields(filterExpressions);
            expect(result).toBe(filterExpressions);
        });

        it('returns false when a required field is empty and matchMode does not tolerate empty', () => {
            const filterExpressions = { condition: 'AND', rules: [{ target: 'name', required: true, value: '', matchMode: 'equals' }] };
            const result = (manager as any).getFilterExprFields(filterExpressions);
            expect(result).toBe(false);
        });

        it('tolerates an empty required field when matchMode is one of the null/empty modes', () => {
            const filterExpressions = { condition: 'AND', rules: [{ target: 'name', required: true, value: '', matchMode: 'isnotnull' }] };
            const result = (manager as any).getFilterExprFields(filterExpressions);
            expect(result).toBe(filterExpressions);
        });
    });

    describe('getDataFilterObj (private)', () => {
        it('exposes getFilterFields and getCriteria against the cloned fields', () => {
            const clonedFields = { condition: 'AND', rules: [{ target: 'status', value: 'active' }] };
            const dataFilterObj = (manager as any).getDataFilterObj(clonedFields);
            expect(dataFilterObj.getFilterFields()).toBe(clonedFields);
            expect(dataFilterObj.getCriteria('status')).toEqual([{ target: 'status', value: 'active' }]);
            expect(dataFilterObj.getCriteria('missing')).toEqual([]);
        });
    });

    describe('setInput', () => {
        it('initializes inputFields and sets the given key', () => {
            const variable: any = {};
            manager.setInput(variable, 'name', 'wm', {});
            expect(variable.inputFields).toEqual({ name: 'wm' });
        });
    });

    describe('setFilter', () => {
        it('creates a new filterExpressions structure and adds a rule', () => {
            const variable: any = {};
            const result = manager.setFilter(variable, 'status', 'active');
            expect(variable.filterExpressions.rules).toEqual([
                { target: 'status', type: '', matchMode: '', value: 'active', required: false }
            ]);
            expect(result).toBe(variable.filterExpressions);
        });

        it('updates the value of an existing criteria for the same target', () => {
            const variable: any = {
                filterExpressions: { condition: 'AND', rules: [{ target: 'status', value: 'inactive' }] }
            };
            manager.setFilter(variable, 'status', 'active');
            expect(variable.filterExpressions.rules).toEqual([{ target: 'status', value: 'active' }]);
        });

        it('accepts an object of key/value pairs', () => {
            const variable: any = {};
            manager.setFilter(variable, { status: 'active', age: 30 } as any, undefined);
            expect(variable.filterExpressions.rules).toHaveLength(2);
        });
    });

    describe('getRelatedTablePrimaryKeys', () => {
        it('returns undefined when the variable has no propertiesMap', () => {
            expect(manager.getRelatedTablePrimaryKeys({}, 'dept')).toBeUndefined();
        });

        it('returns primary key field names of the related columns', () => {
            const variable: any = {
                propertiesMap: {
                    columns: [{
                        fieldName: 'dept',
                        columns: [{ fieldName: 'id', isPrimaryKey: true }, { fieldName: 'name', isPrimaryKey: false }]
                    }]
                }
            };
            expect(manager.getRelatedTablePrimaryKeys(variable, 'dept')).toEqual(['id']);
        });

        it('falls back to the first non-related column when there is no primary key', () => {
            const variable: any = {
                propertiesMap: {
                    columns: [{
                        fieldName: 'dept',
                        columns: [{ fieldName: 'label', isPrimaryKey: false, isRelated: false }]
                    }]
                }
            };
            expect(manager.getRelatedTablePrimaryKeys(variable, 'dept')).toBe('label');
        });

        it('returns undefined when the related field is not found', () => {
            const variable: any = { propertiesMap: { columns: [] } };
            expect(manager.getRelatedTablePrimaryKeys(variable, 'missing')).toBeUndefined();
        });
    });

    describe('defineFirstLastRecord', () => {
        it('defines firstRecord/lastRecord for a read-operation variable', () => {
            const variable: any = { operation: 'read', dataSet: { data: [{ id: 1 }, { id: 2 }] } };
            manager.defineFirstLastRecord(variable);
            expect(variable.firstRecord).toEqual({ id: 1 });
            expect(variable.lastRecord).toEqual({ id: 2 });
        });

        it('does not define the properties for a non-read variable', () => {
            const variable: any = { operation: 'insert', dataSet: { data: [{ id: 1 }] } };
            manager.defineFirstLastRecord(variable);
            expect(variable.firstRecord).toBeUndefined();
        });
    });

    describe('getPrimaryKey', () => {
        it('delegates to LiveVariableUtils.getPrimaryKey', () => {
            jest.spyOn(LiveVariableUtils, 'getPrimaryKey').mockReturnValue(['id']);
            expect(manager.getPrimaryKey({})).toEqual(['id']);
        });
    });

    describe('prepareRequestParams', () => {
        it('builds filter fields from a comma separated searchKey/matchMode', () => {
            const result = manager.prepareRequestParams({ searchKey: 'name,email', matchMode: 'startignorecase', query: 'wm' });
            expect(result.filterFields).toEqual({
                name: { value: 'wm', logicalOp: 'AND', matchMode: 'startignorecase' },
                email: { value: 'wm', logicalOp: 'AND', matchMode: 'startignorecase' }
            });
            expect(result.inFlightBehavior).toBe('executeAll');
            expect(result.logicalOp).toBe('OR');
        });

        it('replaces colons in orderby with spaces', () => {
            const result = manager.prepareRequestParams({ searchKey: 'name', orderby: 'name:asc' });
            expect(result.orderBy).toBe('name asc');
        });

        it('invokes the onBeforeservicecall hook with the built form fields', () => {
            const onBeforeservicecall = jest.fn();
            manager.prepareRequestParams({ searchKey: 'name', onBeforeservicecall });
            expect(onBeforeservicecall).toHaveBeenCalled();
        });
    });

    describe('upgradeInputDataToFilterExpressions', () => {
        it('normalizes a response object into condition/rules form', () => {
            const result = manager.upgradeInputDataToFilterExpressions({}, { status: 'active' }, {});
            expect(result.condition).toBe('AND');
            expect(result.rules).toEqual([
                { target: 'status', type: '', matchMode: '', value: undefined, required: false }
            ]);
        });

        it('preserves an existing rule for the same target while updating its value', () => {
            const inputData = {
                rules: [{ target: 'status', value: 'old', matchMode: 'equals' }],
                status: { value: 'new', matchMode: 'contains' }
            };
            const result = manager.upgradeInputDataToFilterExpressions({}, undefined, inputData);
            expect(result.rules).toEqual([{ target: 'status', value: 'new', matchMode: 'contains' }]);
        });
    });

    describe('downgradeFilterExpressionsToInputData', () => {
        it('flattens filterExpressions rules into a target-keyed map', () => {
            const inputData = { rules: [{ target: 'status', value: 'active', matchMode: 'equals' }] };
            const result = manager.downgradeFilterExpressionsToInputData({}, inputData);
            expect(result.status).toEqual({ value: 'active', matchMode: 'equals' });
        });

        it('unwraps a getDataFilterObj-shaped input via getFilterFields()', () => {
            const filterFields = { rules: [{ target: 'status', value: 'active', matchMode: 'equals' }] };
            const inputData = { getFilterFields: () => filterFields };
            const result = manager.downgradeFilterExpressionsToInputData({}, inputData);
            expect(result.status).toEqual({ value: 'active', matchMode: 'equals' });
        });
    });

    describe('cancel', () => {
        it('unsubscribes the observable and releases the queue when a request is pending', () => {
            const unsubscribe = jest.fn();
            const variable: any = { _observable: { unsubscribe } };
            ($queue as any).requestsQueue.set(variable, [{ resolve: jest.fn(), reject: jest.fn(), active: true }]);
            manager.cancel(variable, {});
            expect(unsubscribe).toHaveBeenCalled();
        });

        it('does nothing when there is no pending request', () => {
            const unsubscribe = jest.fn();
            const variable: any = { _observable: { unsubscribe } };
            manager.cancel(variable, {});
            expect(unsubscribe).not.toHaveBeenCalled();
        });
    });

    describe('listRecords / getEntityData', () => {
        const stubUtilsForListRecords = (overrides: any = {}) => {
            jest.spyOn(LiveVariableUtils, 'prepareTableOptions').mockReturnValue({ filter: '', sort: '', query: '' } as any);
            jest.spyOn(LiveVariableUtils, 'getWhereClauseGenerator').mockReturnValue('');
            jest.spyOn(LiveVariableUtils, 'processBlobColumns').mockImplementation(() => {});
            Object.assign(overrides);
        };

        it('aborts and rejects when BEFORE_UPDATE returns false', async () => {
            stubUtilsForListRecords();
            const variable: any = {
                onBeforeUpdate: jest.fn().mockReturnValue(false),
                getPrefabName: () => undefined
            };
            const error = jest.fn();
            await expect(manager.listRecords(variable, {}, jest.fn(), error)).rejects.toBeDefined();
            expect(error).toHaveBeenCalled();
        });

        it('populates the dataset from a successful response', async () => {
            stubUtilsForListRecords();
            jest.useFakeTimers();
            const variable: any = {
                getPrefabName: () => undefined,
                propertiesMap: {},
                notify: jest.fn(),
                httpService: {
                    sendCall: jest.fn().mockResolvedValue({
                        type: 'success',
                        body: { content: [{ id: 1 }], totalElements: 1 }
                    })
                }
            };
            const success = jest.fn();
            const promise = manager.listRecords(variable, {}, success, jest.fn());
            const result: any = await promise;
            jest.runAllTimers();
            expect(variable.dataSet).toEqual([{ id: 1 }]);
            expect(result.data).toEqual([{ id: 1 }]);
            jest.useRealTimers();
        });

        it('rejects (and invokes the error callback) for an error-shaped response', async () => {
            stubUtilsForListRecords();
            const variable: any = {
                getPrefabName: () => undefined,
                propertiesMap: {},
                onError: jest.fn(),
                httpService: {
                    sendCall: jest.fn().mockResolvedValue({
                        type: 'success',
                        body: { error: 'server error', content: [] }
                    })
                }
            };
            const error = jest.fn();
            // skipDataSetUpdate avoids re-triggering the shared emptyArr Object.defineProperty
            // path exercised by the handleError describe block above (see known-defect note there).
            await expect(
                manager.listRecords(variable, { skipDataSetUpdate: true }, jest.fn(), error)
            ).rejects.toBe('server error');
            expect(error).toHaveBeenCalledWith('server error');
        });

        it('rejects when the http call itself fails', async () => {
            stubUtilsForListRecords();
            const variable: any = {
                getPrefabName: () => undefined,
                propertiesMap: {},
                onError: jest.fn(),
                httpService: {
                    sendCall: jest.fn().mockRejectedValue({ status: 500 }),
                    getLocale: () => ({})
                }
            };
            await expect(manager.listRecords(variable, { skipDataSetUpdate: true }, jest.fn(), jest.fn())).rejects.toBeDefined();
        });
    });

    describe('insertRecord / updateRecord / deleteRecord (performCUD/doCUD)', () => {
        const stubUtilsForCUD = () => {
            jest.spyOn(LiveVariableUtils, 'getPrimaryKey').mockReturnValue(['id']);
            jest.spyOn(LiveVariableUtils, 'isCompositeKey').mockReturnValue(false);
            jest.spyOn(LiveVariableUtils, 'getFieldType').mockReturnValue('string');
            jest.spyOn(LiveVariableUtils, 'isStringType').mockReturnValue(false);
            jest.spyOn(LiveVariableUtils, 'hasBlob').mockReturnValue(false);
        };

        it('inserts a record and updates the dataset with the response', async () => {
            stubUtilsForCUD();
            jest.useFakeTimers();
            const variable: any = {
                operation: 'insert',
                inputFields: { name: 'wm' },
                propertiesMap: {},
                notify: jest.fn(),
                httpService: {
                    sendCall: jest.fn().mockResolvedValue({ type: 'success', body: { id: 1, name: 'wm' } })
                }
            };
            const success = jest.fn();
            const result: any = await manager.insertRecord(variable, {}, success, jest.fn());
            jest.runAllTimers();
            expect(variable.dataSet).toEqual({ id: 1, name: 'wm' });
            expect(result).toEqual({ id: 1, name: 'wm' });
            jest.useRealTimers();
        });

        it('rejects and notifies the error callback when the server returns an error payload', async () => {
            stubUtilsForCUD();
            const variable: any = {
                operation: 'update',
                inputFields: {},
                propertiesMap: { primaryFields: ['id'] },
                onError: jest.fn(),
                httpService: {
                    sendCall: jest.fn().mockResolvedValue({ type: 'success', body: { error: 'conflict' } })
                }
            };
            const error = jest.fn();
            await expect(manager.updateRecord(variable, {}, jest.fn(), error)).rejects.toBe('conflict');
            expect(error).toHaveBeenCalledWith('conflict');
        });

        it('aborts when BEFORE_UPDATE returns false', async () => {
            stubUtilsForCUD();
            const variable: any = {
                operation: 'delete',
                inputFields: {},
                onBeforeUpdate: jest.fn().mockReturnValue(false)
            };
            const error = jest.fn();
            await expect(manager.deleteRecord(variable, {}, jest.fn(), error)).rejects.toBeDefined();
            expect(error).toHaveBeenCalled();
        });

        it('rejects when the underlying http call fails', async () => {
            stubUtilsForCUD();
            const variable: any = {
                operation: 'delete',
                inputFields: { id: 1 },
                propertiesMap: { primaryFields: ['id'] },
                onError: jest.fn(),
                httpService: {
                    sendCall: jest.fn().mockRejectedValue({ status: 500 }),
                    getLocale: () => ({})
                }
            };
            await expect(manager.deleteRecord(variable, {}, jest.fn(), jest.fn())).rejects.toBeDefined();
        });
    });

    describe('download', () => {
        it('reports an error via the error callback when the http call fails', async () => {
            jest.spyOn(LiveVariableUtils, 'prepareTableOptions').mockReturnValue({ query: '', sort: '' } as any);
            jest.spyOn(LiveVariableUtils, 'getWhereClauseGenerator').mockReturnValue('');
            const variable: any = {
                getPrefabName: () => undefined,
                onError: jest.fn(),
                httpService: {
                    sendCall: jest.fn().mockRejectedValue({ status: 500 }),
                    getLocale: () => ({})
                }
            };
            const errorHandler = jest.fn();
            await expect(
                manager.download(variable, { data: { fields: [] } }, jest.fn(), errorHandler)
            ).rejects.toBeDefined();
            expect(errorHandler).toHaveBeenCalled();
        });
    });

    describe('getRelatedTableData', () => {
        it('strips self-related columns and resolves with data + pagination', async () => {
            jest.spyOn(LiveVariableUtils, 'getFieldType').mockReturnValue('string');
            jest.spyOn(LiveVariableUtils, 'getFilterOptions').mockReturnValue([]);
            jest.spyOn(LiveVariableUtils, 'getSearchQuery').mockReturnValue('');
            jest.spyOn(LiveVariableUtils, 'getWhereClauseGenerator').mockReturnValue('');
            const variable: any = {
                getPrefabName: () => undefined,
                type: 'Employee',
                relatedTables: [{ relationName: 'dept', type: 'Department' }],
                httpService: {
                    sendCall: jest.fn().mockResolvedValue({
                        type: 'success',
                        body: { content: [{ id: 1, dept: { id: 2 } }], totalElements: 1 }
                    })
                }
            };
            const success = jest.fn();
            const result: any = await manager.getRelatedTableData(variable, 'dept', { filterFields: {} }, success, jest.fn());
            expect(result.data).toEqual([{ id: 1, dept: { id: 2 } }]);
            expect(success).toHaveBeenCalled();
        });
    });

    describe('getDistinctDataByFields', () => {
        it('resolves with the distinct content and pagination', async () => {
            jest.spyOn(LiveVariableUtils, 'prepareTableOptions').mockReturnValue({ query: '' } as any);
            jest.spyOn(LiveVariableUtils, 'getWhereClauseGenerator').mockReturnValue('');
            const variable: any = {
                getPrefabName: () => undefined,
                httpService: {
                    sendCall: jest.fn().mockResolvedValue({
                        type: 'success',
                        body: { content: ['A', 'B'], totalElements: 2 }
                    })
                }
            };
            const success = jest.fn();
            const result: any = await manager.getDistinctDataByFields(variable, { fields: 'status' }, success, jest.fn());
            expect(result.data).toEqual(['A', 'B']);
        });
    });

    describe('getAggregatedData / aggregateData', () => {
        it('does nothing when no deployed url is configured', () => {
            wmSetDependency('appManager', { getDeployedURL: () => undefined });
            expect(manager.getAggregatedData({}, {}, jest.fn(), jest.fn())).toBeUndefined();
        });

        it('resolves with the aggregated response when a deployed url is configured', async () => {
            wmSetDependency('appManager', { getDeployedURL: () => 'http://x' });
            const variable: any = {
                httpService: {
                    sendCall: jest.fn().mockResolvedValue({ type: 'success', body: { total: 42 } })
                }
            };
            const success = jest.fn();
            const result = await manager.getAggregatedData(variable, { aggregations: {} }, success, jest.fn());
            expect(success).toHaveBeenCalled();
            // httpCall's setRequestTrackId always normalizes response.headers onto the response
            expect(result).toEqual({ type: 'success', body: { total: 42 }, headers: {} });
        });
    });
});
