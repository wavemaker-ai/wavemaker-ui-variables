const mockManager = {
    removeFirstEmptyObject: jest.fn(),
    initBinding: jest.fn()
};

jest.mock('../../factory/variable-manager.factory', () => ({
    VariableManagerFactory: { get: jest.fn(() => mockManager) }
}));

import { VariableManagerFactory } from '../../factory/variable-manager.factory';
import { VARIABLE_CONSTANTS } from '../../constants/variables.constants';
import { DataSource } from '../../types/types';
import { wmSetDependency } from '../../util/variable/variables.utils';
import { ModelVariable } from './model-variable';

describe('ModelVariable', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        wmSetDependency('appManager', { getSelectedLocale: jest.fn(() => 'fr') });
    });

    it('copies the configuration onto the variable', () => {
        const v = new ModelVariable({ name: 'm', isList: true, dataSet: [1] });
        expect(v.name).toBe('m');
        expect(v.dataSet).toEqual([1]);
    });

    describe('init', () => {
        it('initialises the data binding', () => {
            const v = new ModelVariable({ name: 'm', isList: false });
            v.init();
            expect(VariableManagerFactory.get).toHaveBeenCalledWith(VARIABLE_CONSTANTS.CATEGORY.MODEL);
            expect(mockManager.removeFirstEmptyObject).not.toHaveBeenCalled();
            expect(mockManager.initBinding).toHaveBeenCalledWith(v, 'dataBinding', 'dataSet');
        });

        it('removes the empty first object for list variables', () => {
            const v = new ModelVariable({ name: 'm', isList: true });
            v.init();
            expect(mockManager.removeFirstEmptyObject).toHaveBeenCalledWith(v);
        });
    });

    describe('execute', () => {
        const make = (name = 'm') => new ModelVariable({ name, _id: 'id1' });

        it('answers the common operations from the base class first', () => {
            const v = make();
            expect(v.execute(DataSource.Operation.GET_NAME, {})).toBe('m');
            expect(v.execute(DataSource.Operation.GET_UNIQUE_IDENTIFIER, {})).toBe('id1');
        });

        it.each([
            DataSource.Operation.IS_API_AWARE,
            DataSource.Operation.SUPPORTS_CRUD,
            DataSource.Operation.SUPPORTS_DISTINCT_API,
            DataSource.Operation.IS_PAGEABLE,
            DataSource.Operation.IS_SORTABLE,
            DataSource.Operation.SUPPORTS_SERVER_FILTER
        ])('reports %s as unsupported', op => {
            expect(make().execute(op, {})).toBe(false);
        });

        it('detects variables bound to the locale', () => {
            expect(make('supportedLocale').execute(DataSource.Operation.IS_BOUND_TO_LOCALE, {})).toBe(true);
            expect(make('other').execute(DataSource.Operation.IS_BOUND_TO_LOCALE, {})).toBe(false);
        });

        it('returns the selected locale as the default locale', () => {
            expect(make().execute(DataSource.Operation.GET_DEFAULT_LOCALE, {})).toBe('fr');
        });

        it('returns an empty object for unknown operations', () => {
            expect(make().execute('unknown' as any, {})).toEqual({});
        });
    });
});
