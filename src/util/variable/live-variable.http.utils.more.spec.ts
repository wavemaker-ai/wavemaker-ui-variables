import { LVService } from './live-variable.http.utils';
import { wmSetDependency } from './variables.utils';

describe('LVService - every action', () => {
    const actions = [
        'searchTableDataWithQuery', 'executeAggregateQuery', 'searchTableData', 'readTableData', 'insertTableData',
        'insertMultiPartTableData', 'updateTableData', 'updateCompositeTableData', 'periodUpdateCompositeTableData',
        'updateMultiPartTableData', 'updateMultiPartCompositeTableData', 'deleteTableData', 'deleteCompositeTableData',
        'periodDeleteCompositeTableData', 'exportTableData', 'getDistinctDataByFields', 'countTableDataWithQuery',
    ] as const;

    let sendCallAsObservable: jest.Mock;

    beforeEach(() => {
        sendCallAsObservable = jest.fn().mockReturnValue('observable');
        wmSetDependency('http', { sendCallAsObservable });
    });

    it.each(actions)('%s sends the request through the http service and remembers the operation', (action) => {
        const params: any = { url: 'http://host', entityName: 'Employee', dataModelName: 'db1', id: 1, data: {} };
        const result = (LVService as any)[action](params, jest.fn(), jest.fn());
        expect(result).toBe('observable');
        expect(params.operation).toBe(action);
        const [request, passedParams] = sendCallAsObservable.mock.calls[0];
        expect(request).toEqual(expect.objectContaining({ url: expect.any(String), method: expect.any(String) }));
        expect(passedParams).toBe(params);
    });
});
