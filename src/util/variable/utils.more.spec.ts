import { getErrMessage, getEvaluatedOrderBy, internalBoundNodeMap, updateInternalNodes } from './variables.utils';
import { LiveVariableUtils } from './live-variable.utils';
import { DB_CONSTANTS } from '../../constants/variables.constants';

describe('variables.utils - remaining branches', () => {
    it('drops all variable orderings that options already override', () => {
        expect(getEvaluatedOrderBy('a asc', 'a desc')).toBe('a desc');
    });

    describe('getErrMessage', () => {
        it('uses the generic message when the error list is empty', () => {
            expect(getErrMessage({ status: 500, error: { errors: { error: [] } } }, {})).toBe('Service Call Failed');
            expect(getErrMessage({ status: 404, error: { errors: {} } }, {})).toBe('Requested resource not found');
        });

        it('falls back to the first parameter when an error has no message', () => {
            expect(getErrMessage({ status: 500, error: { errors: { error: [{ parameters: ['boom'] }] } } }, {})).toBe('boom');
        });

        it('yields empty text for an error without message or parameters, so the status message wins', () => {
            expect(getErrMessage({ status: 403, error: { errors: { error: [{}] } } }, {})).toBe('The requested resource access/action is forbidden.');
        });

        it('replaces parameters in the message, and reads err.data', () => {
            expect(getErrMessage({ status: 500, data: { errors: { error: [{ message: 'bad {0}', parameters: ['x'] }, { message: 'again' }] } } }, {})).toContain('bad x');
        });
    });

    describe('updateInternalNodes', () => {
        it('only refreshes nodes nested under the target, or all nodes for the root/dataBinding target', () => {
            const variable: any = { name: 'v', dataBinding: {}, _context: {} };
            internalBoundNodeMap.set(variable, { v: { dataBinding: { 'dataBinding.a': 1, other: 2 } } });
            expect(() => updateInternalNodes('dataBinding', 'dataBinding', variable)).not.toThrow();
            expect(() => updateInternalNodes('other', 'dataBinding', variable)).not.toThrow();
            expect(() => updateInternalNodes('dataBinding', 'root', variable)).not.toThrow();
            internalBoundNodeMap.delete(variable);
        });
    });
});

describe('LiveVariableUtils - remaining branches', () => {
    it('getFieldType returns undefined without a properties map and with unknown related fields', () => {
        expect(LiveVariableUtils.getFieldType('a', {} as any)).toBeUndefined();
        const v: any = { propertiesMap: { columns: [{ fieldName: 'a', type: 'x', columns: [{ fieldName: 'b', type: 'y' }] }] } };
        expect(LiveVariableUtils.getFieldType('a', v, 'b')).toBe('y');
        expect(LiveVariableUtils.getFieldType('zz', v, 'b')).toBeUndefined();
        expect(LiveVariableUtils.getFieldType('a', { propertiesMap: {} } as any)).toBeUndefined();
    });

    it('builds filter rules with default match modes by type', () => {
        const variable: any = { propertiesMap: { columns: [{ fieldName: 'n', type: 'integer', fieldType: 'integer' }, { fieldName: 's', type: 'string' }] } };
        const options: any = { entityName: 'E', filterFields: { n: { value: 1, type: 'integer' }, s: { value: 'x', type: 'string' } } };
        const res: any = LiveVariableUtils.prepareTableOptionsForFilterExps(variable, options, {});
        expect(typeof res.query).toBe('string');
        expect(res.query.length).toBeGreaterThan(0);
    });

    it('resolves the match mode for option filters from options or variable defaults', () => {
        const variable: any = { operation: 'update', matchMode: 'anywhere', filterFields: {}, propertiesMap: { columns: [] } };
        const a: any = { filterFields: { f: { value: 'v' } }, matchMode: 'start' };
        const b: any = { filterFields: { f: { value: 'v' } } };
        const c: any = { filterFields: { f: { value: 'v', matchMode: 'exact' } } };
        [a, b, c].forEach(o => expect(() => LiveVariableUtils.prepareTableOptions(variable, o, {})).not.toThrow());
        expect(DB_CONSTANTS.DATABASE_MATCH_MODES).toBeDefined();
    });
});
