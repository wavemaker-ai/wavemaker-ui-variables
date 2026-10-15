import { PaginationUtils } from './pagination.utils';

describe('PaginationUtils - building the pagination result', () => {
    beforeEach(() => jest.restoreAllMocks());

    describe('setTotalElements', () => {
        const run = (resOutput: any, options: any, res: any, variable: any, paginationInfo: any, response: any = {}) => {
            PaginationUtils.setTotalElements(resOutput, options, res, variable, response, paginationInfo, undefined);
            return res;
        };

        it('uses the minimum value when more elements are expected than rendered', () => {
            const res: any = run({ totalElements: '$minValue=100' }, { page: 2 }, { size: 10, page: 1 }, { pagination: { totalElements: 500 } }, { type: 'page', input: {} });
            expect(res.totalElements).toBe(100);
            const noPagination: any = run({ totalElements: '$minValue=50' }, { page: 1 }, { size: 10 }, {}, { type: 'page', input: {} });
            expect(noPagination.totalElements).toBe(50);
        });

        it('adds one to the rendered count when the minimum value has been reached', () => {
            const res: any = run({ totalElements: '$minValue=100' }, { page: 3 }, { size: 10 }, { pagination: { totalElements: 20 } }, { type: 'page', input: {} });
            expect(res.totalElements).toBe(31);
        });

        it('resolves the total from the response expression', () => {
            const res: any = run({ totalElements: '$body.total' }, {}, {}, {}, { type: 'page', input: {} }, { total: 42 });
            expect(res.totalElements).toBe(42);
        });

        it('estimates the total for offset and page pagination without metadata', () => {
            expect(run({}, { page: 3 }, { size: 10 }, {}, { type: 'offset', input: {} }).totalElements).toBe(31);
            expect(run(undefined, {}, { size: 10 }, {}, { type: 'page', input: { offset: 'o' } }).totalElements).toBe(11);
            expect(run({}, {}, { size: 10, page: 2 }, {}, { type: 'page', input: {} }).totalElements).toBe(21);
        });
    });

    describe('generatePaginationRes', () => {
        const generate = (info: any, response: any = {}, options: any = {}, headers?: any) =>
            PaginationUtils.generatePaginationRes({ parameters: [] }, info, response, headers, options, {});

        beforeEach(() => {
            jest.spyOn(PaginationUtils, 'setParameterVal').mockImplementation(((name: string, res: any) => { res[name] = res[name] ?? 1; }) as any);
        });

        it('resolves size, page, total and more-items from the response when output metadata exists', () => {
            const info = { type: 'page', input: { page: 'p', size: 's' }, output: { size: '$body.size', page: '$body.page', totalElements: '$body.total', hasMoreItems: '$body.more' } };
            const res: any = generate(info, { size: 5, page: 2, total: 50, more: true });
            expect(res).toEqual({ size: 5, page: 2, totalElements: 50, hasMoreItems: true });
        });

        it('falls back to the input metadata for page and offset pagination', () => {
            const page: any = generate({ type: 'page', input: { page: 'p', size: 's' }, output: {} });
            expect(page.page).toBe(1);
            expect(page.hasMoreItems).toBe('');
            const offset: any = generate({ type: 'offset', input: { offset: 'o', size: 's' }, output: {} }, {}, { page: 2 });
            expect(offset.page).toBeUndefined();
        });

        it('reads cursor pagination keys from the response', () => {
            const info = { type: 'cursor', input: { page: 'c', size: 's' }, output: { next: '$body.next', prev: '$body.prev', size: '$body.size', totalElements: '$body.total' } };
            const res: any = generate(info, { next: 'n', prev: 'p', size: 3, total: 9 });
            expect(res).toEqual(expect.objectContaining({ next: 'n', prev: 'p', size: 3, totalElements: 9 }));
        });

        it('handles missing output metadata for cursor pagination', () => {
            expect(() => generate({ type: 'cursor', input: { size: 's' } })).not.toThrow();
        });

        it('rejects non-numeric configured sizes without response values', () => {
            const info = { type: 'page', input: { size: 'missing', page: 'p' }, output: {} };
            const res: any = generate(info, {});
            expect(res.size).toBe(1);
        });
    });

    describe('setPaginationItems with response headers', () => {
        it('reads plain and cloaked headers and joins array values', () => {
            const headers = new Map([['x-total', '25'], ['x-wm-x-cloaked', '7'], ['x-list', 'a']]);
            const res: any = {};
            PaginationUtils.setPaginationItems('$header.x-total', {}, res, 'total', headers);
            expect(res.total).toBe('25');
            PaginationUtils.setPaginationItems('$header.x-cloaked', {}, res, 'cloaked', headers);
            expect(res.cloaked).toBeDefined();
            PaginationUtils.setPaginationItems('$header.x-missing', {}, res, 'missing', headers);
            expect(res.missing).toBeFalsy();
        });

        it('supports header collections that wrap their entries', () => {
            const res: any = {};
            PaginationUtils.setPaginationItems('$header.x-total', {}, res, 'total', { headers: new Map([['x-total', '9']]) });
            expect(res.total).toBe('9');
        });

        it('ignores items that are neither body nor header expressions', () => {
            const res: any = {};
            PaginationUtils.setPaginationItems('literal', {}, res, 'k', undefined);
            expect(res).toEqual({});
        });
    });

    describe('setVariablePagination for cursor responses', () => {
        it('marks the last page when only a previous cursor exists', () => {
            const variable: any = {};
            PaginationUtils.setVariablePagination(variable, { size: 5, totalElements: 5, next: 'n', prev: undefined }, {});
            expect(variable.pagination.last).toBe(false);
            expect(variable.pagination.first).toBe(true);
        });
    });
});
