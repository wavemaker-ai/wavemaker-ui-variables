import { PaginationUtils } from './pagination.utils';

describe('PaginationUtils - branches', () => {
    describe('setPaginationQueryParams', () => {
        const params = () => [{ name: 'pg' }, { name: 'sz' }, { name: 'other' }] as any[];

        it('maps page and size to the matching query parameters', () => {
            const parameters = params();
            PaginationUtils.setPaginationQueryParams({ pagination: { page: 3, size: 25 } }, { parameters }, { type: 'page', input: { page: 'pg', size: 'sz' } });
            expect(parameters.map(p => p.sampleValue)).toEqual([3, 25, undefined]);
        });

        it('uses the offset key when the type is offset or an offset input exists', () => {
            const parameters = params();
            PaginationUtils.setPaginationQueryParams({ pagination: { page: 40, size: 10 } }, { parameters }, { type: 'offset', input: { offset: 'pg.x', size: 'sz' } });
            expect(parameters[0].sampleValue).toBe(40);
            const second = params();
            PaginationUtils.setPaginationQueryParams({ pagination: { page: 5, size: 10 } }, { parameters: second }, { type: 'page', input: { offset: 'pg', page: 'x', size: 'sz' } });
            expect(second[0].sampleValue).toBe(5);
        });
    });

    describe('setVariablePagination', () => {
        it('creates the pagination object and derives page counts (even split)', () => {
            const variable: any = {};
            PaginationUtils.setVariablePagination(variable, { size: 10, totalElements: 30, page: 2 }, { page: 2 });
            expect(variable.pagination).toEqual(expect.objectContaining({ empty: false, size: 10, totalPages: 3, number: 1, first: false }));
            expect(variable.pagination.last).toBe(true);
        });

        it('rounds the page count up for an uneven split and defaults page and number', () => {
            const variable: any = { pagination: {} };
            PaginationUtils.setVariablePagination(variable, { size: 10, totalElements: 25, hasMoreItems: '' }, {});
            expect(variable.pagination.totalPages).toBe(3);
            expect(variable.pagination.page).toBe(0);
            expect(variable.pagination.number).toBe(0);
            expect(variable.pagination.first).toBe(true);
            expect(variable.pagination.last).toBe(false);
        });

        it('uses the hasMoreItems flag of the response when it is present', () => {
            const more: any = {};
            PaginationUtils.setVariablePagination(more, { size: 5, totalElements: 50, page: 1, hasMoreItems: true }, {});
            expect(more.pagination.last).toBe(false);
            const done: any = {};
            PaginationUtils.setVariablePagination(done, { size: 5, totalElements: 50, page: 1, hasMoreItems: false }, {});
            expect(done.pagination.last).toBe(true);
        });

        it('fills cursor information for next/prev style pagination', () => {
            const variable: any = {};
            PaginationUtils.setVariablePagination(variable, { size: 5, totalElements: 5, next: 'n', prev: 'p' }, {});
            expect(variable.pagination).toEqual(expect.objectContaining({ next: 'n', prev: 'p', last: false, first: false }));
            const first: any = {};
            PaginationUtils.setVariablePagination(first, { size: 5, totalElements: 5, next: 'n' }, {});
            expect(first.pagination.first).toBe(true);
        });
    });

    describe('getPaginationInfo / getOffsetInfo', () => {
        it('prefers the operation metadata and falls back to the variable configuration', () => {
            expect(PaginationUtils.getPaginationInfo({ paginationInfo: { a: 1 } }, { _paginationConfig: { b: 2 } })).toEqual({ a: 1 });
            expect(PaginationUtils.getPaginationInfo({}, { _paginationConfig: { b: 2 } })).toEqual({ b: 2 });
            expect(PaginationUtils.getPaginationInfo(undefined, { _paginationConfig: { b: 2 } })).toEqual({ b: 2 });
        });

        it('computes the offset from the page and size', () => {
            expect(PaginationUtils.getOffsetInfo({ pagination: { size: 10 } }, { page: 3 })).toBe(20);
            expect(PaginationUtils.getOffsetInfo({ pagination: { size: 10 } }, {})).toBe(0);
        });
    });

    describe('checkPaginationAtQuery', () => {
        const variable = (extra: any = {}) => ({ pagination: { page: 1, size: 10 }, ...extra });
        const op = (parameters: any[], extra: any = {}) => ({ parameters, ...extra });

        it('does nothing without a page option, input size or pagination', () => {
            const parameters = [{ name: 'pg', parameterType: 'query' }];
            const info = { type: 'page', input: { page: 'pg', size: 'sz' } };
            PaginationUtils.checkPaginationAtQuery(op(parameters, { paginationInfo: info }), variable(), undefined);
            PaginationUtils.checkPaginationAtQuery(op(parameters, { paginationInfo: info }), variable(), {});
            PaginationUtils.checkPaginationAtQuery(op(parameters, { paginationInfo: { type: 'page', input: {} } }), variable(), { page: 1 });
            PaginationUtils.checkPaginationAtQuery(op(parameters, { paginationInfo: info }), { pagination: undefined }, { page: 1 });
            expect((parameters[0] as any).sampleValue).toBeUndefined();
        });

        it('sets page and size from the options for page based query pagination', () => {
            const parameters: any[] = [{ name: 'pg', parameterType: 'query' }, { name: 'sz', parameterType: 'query' }];
            const v: any = variable();
            PaginationUtils.checkPaginationAtQuery(op(parameters, { paginationInfo: { type: 'page', input: { page: 'pg', size: 'sz' } } }), v, { page: 4, size: 50 });
            expect(v.pagination.page).toBe(4);
            expect(v.pagination.size).toBe(50);
            expect(parameters[0].sampleValue).toBe(4);
            expect(parameters[1].sampleValue).toBe(50);
        });

        it('keeps the size when no size option is given', () => {
            const parameters: any[] = [{ name: 'pg', parameterType: 'query' }, { name: 'sz', parameterType: 'query' }];
            const v: any = variable();
            PaginationUtils.checkPaginationAtQuery(op(parameters, { paginationInfo: { type: 'page', input: { page: 'pg', size: 'sz' } } }), v, { page: 2 });
            expect(v.pagination.size).toBe(10);
        });

        it('derives the page from the offset for offset pagination or output metadata', () => {
            const parameters: any[] = [{ name: 'off', parameterType: 'query' }, { name: 'sz', parameterType: 'query' }];
            const v: any = variable();
            PaginationUtils.checkPaginationAtQuery(op(parameters, { paginationInfo: { type: 'offset', input: { offset: 'off', size: 'sz' } } }), v, { page: 3 });
            expect(v.pagination.page).toBe(20);
            const w: any = variable();
            PaginationUtils.checkPaginationAtQuery(op(parameters, { paginationInfo: { type: 'page', input: { page: 'off', size: 'sz' }, output: { page: '$body.p' } } }), w, { page: 3 });
            expect(w.pagination.page).toBe(20);
        });

        it('updates the size path parameter of cursor pagination', () => {
            const parameters: any[] = [{ name: 'limit', parameterType: 'path', sampleValue: 1 }, { name: 'cursor', parameterType: 'header' }];
            const v: any = variable();
            PaginationUtils.checkPaginationAtQuery(op(parameters, { paginationInfo: { type: 'cursor', input: { page: 'cursor', size: 'limit' } } }), v, { page: 1, size: 7 });
            expect(parameters[0].sampleValue).toBe(7);
            const fallback: any = variable();
            PaginationUtils.checkPaginationAtQuery(op(parameters, { paginationInfo: { type: 'cursor', input: { page: 'cursor', size: 'limit' } } }), fallback, { page: 1 });
            expect(parameters[0].sampleValue).toBe(10);
        });

        it('ignores cursor pagination whose size is not a path parameter', () => {
            const parameters: any[] = [{ name: 'limit', parameterType: 'query' }, { name: 'cursor', parameterType: 'header' }];
            expect(() => PaginationUtils.checkPaginationAtQuery(op(parameters, { paginationInfo: { type: 'cursor', input: { page: 'cursor', size: 'limit' } } }), variable(), { page: 1 })).not.toThrow();
        });
    });
});
