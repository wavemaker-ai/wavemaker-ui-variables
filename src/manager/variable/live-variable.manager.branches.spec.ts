import { LiveVariableManager } from './live-variable.manager';
import { LiveVariableUtils } from '../../util/variable/live-variable.utils';
import * as variablesUtils from '../../util/variable/variables.utils';
import { wmSetDependency } from '../../util/variable/variables.utils';
import { $rootScope } from '../../constants/variables.constants';
import { $queue } from '../../util/inflight-queue';

describe('LiveVariableManager - branches', () => {
    let manager: any;

    beforeEach(() => {
        jest.restoreAllMocks();
        manager = new LiveVariableManager();
        ($queue as any).requestsQueue = new Map();
        ($rootScope as any).project = { id: 'proj', deployedUrl: 'http://app' };
        wmSetDependency('appManager', { notify: jest.fn() });
    });

    describe('makeCall', () => {
        const variable = () => ({ httpService: { getLocale: jest.fn() } } as any);

        it('resolves responses that have a type or only a status and ignores others', async () => {
            jest.spyOn(manager, 'httpCall').mockResolvedValueOnce({ status: 200 });
            await expect(manager.makeCall(variable(), 'readTableData', { projectID: 'p', dataModelName: 'd', entityName: 'e', page: 1, size: 1, sort: '' }))
                .resolves.toEqual({ status: 200 });
            jest.spyOn(manager, 'httpCall').mockResolvedValueOnce({});
            let settled = false;
            manager.makeCall(variable(), 'readTableData', { projectID: 'p', dataModelName: 'd', entityName: 'e', page: 1, size: 1, sort: '' }).then(() => (settled = true));
            await new Promise(r => setTimeout(r));
            expect(settled).toBe(false);
        });
    });

    describe('getRelatedTablePrimaryKeys', () => {
        const variable = (columns?: any[]) => ({ propertiesMap: columns === undefined ? {} : { columns } } as any);

        it('returns nothing without properties or a matching related field', () => {
            expect(manager.getRelatedTablePrimaryKeys({}, 'dept')).toBeUndefined();
            expect(manager.getRelatedTablePrimaryKeys(variable(), 'dept')).toBeUndefined();
            expect(manager.getRelatedTablePrimaryKeys(variable([{ fieldName: 'other' }]), 'dept')).toBeUndefined();
        });

        it('returns primary keys, or the first non related column, or nothing', () => {
            expect(manager.getRelatedTablePrimaryKeys(variable([{ fieldName: 'dept', columns: [{ fieldName: 'id', isPrimaryKey: true }, { fieldName: 'n' }] }]), 'dept')).toEqual(['id']);
            expect(manager.getRelatedTablePrimaryKeys(variable([{ fieldName: 'dept', columns: [{ fieldName: 'a', isRelated: true }, { fieldName: 'b', isRelated: false }] }]), 'dept')).toBe('b');
            expect(manager.getRelatedTablePrimaryKeys(variable([{ fieldName: 'dept', columns: [{ fieldName: 'a', isRelated: true }] }]), 'dept')).toBeUndefined();
            expect(manager.getRelatedTablePrimaryKeys(variable([{ fieldName: 'dept', columns: [] }]), 'dept')).toBeUndefined();
            expect(manager.getRelatedTablePrimaryKeys(variable([{ fieldName: 'dept' }]), 'dept')).toBeUndefined();
        });
    });

    describe('filter expression conversions', () => {
        it('upgrades input data to filter expression rules', () => {
            const variable: any = {};
            const input: any = { condition: 'AND', rules: [{ target: 'a', value: 'old', matchMode: 'start' }], a: { value: 'new' }, b: { value: 'x', filterCondition: 'end' }, c: { value: 'y', matchMode: 'exact' }, d: { value: 'z' } };
            const result = manager.upgradeInputDataToFilterExpressions(variable, undefined, input);
            const byTarget = (t: string) => result.rules.find((r: any) => r.target === t);
            expect(byTarget('a')).toEqual(expect.objectContaining({ value: 'new', matchMode: 'start' }));
            expect(byTarget('b')).toEqual(expect.objectContaining({ value: 'x', matchMode: 'end' }));
            expect(byTarget('c').matchMode).toBe('exact');
            expect(byTarget('d').matchMode).toBe('');
            expect(result.b).toBeUndefined();
        });

        it('updates existing rules using each match mode source in turn', () => {
            const input: any = {
                condition: 'AND',
                rules: [{ target: 'a', matchMode: 'keep' }, { target: 'b', matchMode: '' }, { target: 'c', matchMode: 'keep' }],
                a: { value: 1 },
                b: { value: 2 },
                c: { value: 3, matchMode: 'own' }
            };
            const result = manager.upgradeInputDataToFilterExpressions({}, undefined, input);
            expect(result.rules.map((r: any) => r.matchMode).sort()).toEqual(['', 'keep', 'own']);
        });

        it('starts from the response object when one is given', () => {
            const result = manager.upgradeInputDataToFilterExpressions({}, { a: { value: 1 } }, { ignored: true });
            expect(result.condition).toBe('AND');
            expect(result.rules[0].target).toBe('a');
        });

        it('downgrades rules to flat input data, from objects with getFilterFields too', () => {
            const data: any = { rules: [{ target: 'a', value: 1, matchMode: 'exact' }, { target: '', value: 2 }, { target: null, value: 3 }] };
            const result = manager.downgradeFilterExpressionsToInputData({}, data);
            expect(result.a).toEqual({ value: 1, matchMode: 'exact' });
            expect(Object.keys(result).filter(k => k !== 'rules')).toEqual(['a']);
            const wrapped = { getFilterFields: () => ({ rules: [{ target: 'z', value: 9, matchMode: 'x' }] }), hasOwnProperty: () => true };
            expect(manager.downgradeFilterExpressionsToInputData({}, wrapped as any).z).toEqual({ value: 9, matchMode: 'x' });
        });
    });

    describe('doCUD request preparation', () => {
        const variable = (extra: any = {}) => ({
            name: 'lv', liveSource: 'db', type: 'Employee', filterFields: {}, inputFields: {},
            propertiesMap: { columns: [], primaryFields: ['id'] },
            getPrefabName: jest.fn(() => ''), notify: jest.fn(), httpService: { getLocale: jest.fn() },
            dateFormatter: { format: (v: any) => v },
            ...extra
        } as any);

        beforeEach(() => {
            jest.spyOn(variablesUtils, 'initiateCallback').mockImplementation(() => undefined);
            jest.spyOn(manager, 'makeCall').mockResolvedValue({ type: 4, body: {} });
            jest.spyOn(LiveVariableUtils, 'getFieldType').mockReturnValue('string' as any);
            jest.spyOn(LiveVariableUtils, 'prepareFormData').mockImplementation(((_v: any, row: any) => row) as any);
        });

        it('uses the previous data of rows without a primary key', () => {
            jest.spyOn(LiveVariableUtils, 'getPrimaryKey').mockReturnValue([] as any);
            jest.spyOn(LiveVariableUtils, 'isCompositeKey').mockReturnValue(true as any);
            jest.spyOn(LiveVariableUtils, 'isNoPrimaryKey').mockReturnValue(true as any);
            const options: any = { row: { a: 1 }, prevData: { a: 0 } };
            manager.doCUD('updateTableData', variable(), options, jest.fn(), jest.fn());
            expect(options.compositeKeysData).toEqual({ a: 0 });
            const second: any = { row: { a: 1 }, prevData: undefined, rowData: { a: 5 } };
            manager.doCUD('updateTableData', variable(), second, jest.fn(), jest.fn());
            expect(second.compositeKeysData).toBeDefined();
        });

        it('builds composite keys from the previous data, row data, period updates and the row', () => {
            jest.spyOn(LiveVariableUtils, 'getPrimaryKey').mockReturnValue(['a', 'b', 'c'] as any);
            jest.spyOn(LiveVariableUtils, 'isCompositeKey').mockReturnValue(true as any);
            jest.spyOn(LiveVariableUtils, 'isNoPrimaryKey').mockReturnValue(false as any);
            const options: any = { row: { a: 1, b: 2, c: 3 }, prevData: { a: 10 }, rowData: { b: 20 } };
            manager.doCUD('updateTableData', variable(), options, jest.fn(), jest.fn());
            expect(options.compositeKeysData).toEqual({ a: 10, b: 20, c: 3 });
            expect(options.row).toEqual({ a: 1, b: 2, c: 3 });
            const period: any = { row: { a: 1, b: 2, c: 3 }, period: true };
            manager.doCUD('updateTableData', variable(), period, jest.fn(), jest.fn());
            expect(period.compositeKeysData).toEqual({ a: 1, b: 2, c: 3 });
        });

        it('finds the id of simple and related primary keys', () => {
            jest.spyOn(LiveVariableUtils, 'isCompositeKey').mockReturnValue(false as any);
            jest.spyOn(LiveVariableUtils, 'getPrimaryKey').mockReturnValue(['id'] as any);
            const simple: any = { row: { id: 1 }, prevData: { id: 7 } };
            manager.doCUD('updateTableData', variable(), simple, jest.fn(), jest.fn());
            expect(simple.id).toBe(7);
            const fromRow: any = { row: { id: 3 } };
            manager.doCUD('updateTableData', variable(), fromRow, jest.fn(), jest.fn());
            expect(fromRow.id).toBe(3);
            jest.spyOn(LiveVariableUtils, 'getPrimaryKey').mockReturnValue(['dept.id'] as any);
            const related: any = { row: { x: 1 }, prevData: { dept: { id: 9 } } };
            manager.doCUD('updateTableData', variable(), related, jest.fn(), jest.fn());
            expect(related.id).toBe(9);
        });

        it('clears blob fields of related entities that are written from the input fields', () => {
            jest.spyOn(LiveVariableUtils, 'getPrimaryKey').mockReturnValue(['id'] as any);
            jest.spyOn(LiveVariableUtils, 'isCompositeKey').mockReturnValue(false as any);
            (LiveVariableUtils.getFieldType as jest.Mock).mockImplementation(((_n: string, _v: any, related?: string) => (related === 'photo' ? 'blob' : 'string')) as any);
            const inputFields: any = { dept: { photo: 'data', other: 'x', empty: null }, name: 'n' };
            manager.doCUD('insertTableData', variable({ inputFields }), {}, jest.fn(), jest.fn());
            const sent = JSON.stringify((manager.makeCall as jest.Mock).mock.calls[0][2]);
            expect(sent).toContain('"photo":""');
            expect(sent).toContain('"other":"x"');
        });
    });
});
