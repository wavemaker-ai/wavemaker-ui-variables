import { PaginationUtils } from './pagination.utils';

describe('PaginationUtils', () => {

    describe('setPaginationQueryParams', () => {
        it('sets page sample value on the matching page/offset param', () => {
            const variable: any = { pagination: { page: 2, size: 10 } };
            const operationInfo: any = {
                parameters: [
                    { name: 'pageNo' },
                    { name: 'pageSize' }
                ]
            };
            const paginationInfo: any = {
                type: 'page',
                input: { page: 'pageNo.value', size: 'pageSize.value' }
            };
            PaginationUtils.setPaginationQueryParams(variable, operationInfo, paginationInfo);
            expect(operationInfo.parameters[0].sampleValue).toBe(2);
            expect(operationInfo.parameters[1].sampleValue).toBe(10);
        });

        it('uses offset as the input param when type is offset', () => {
            const variable: any = { pagination: { page: 5, size: 20 } };
            const operationInfo: any = { parameters: [{ name: 'off' }, { name: 'sz' }] };
            const paginationInfo: any = {
                type: 'offset',
                input: { offset: 'off.value', size: 'sz.value' }
            };
            PaginationUtils.setPaginationQueryParams(variable, operationInfo, paginationInfo);
            expect(operationInfo.parameters[0].sampleValue).toBe(5);
            expect(operationInfo.parameters[1].sampleValue).toBe(20);
        });
    });

    describe('setVariablePagination', () => {
        it('computes totalPages evenly divisible by size', () => {
            const variable: any = {};
            PaginationUtils.setVariablePagination(variable, { size: 10, page: 1, totalElements: 30 }, { page: 2 });
            expect(variable.pagination.totalPages).toBe(3);
            expect(variable.pagination.size).toBe(10);
            expect(variable.pagination.page).toBe(1);
            expect(variable.pagination.number).toBe(1);
        });

        it('rounds totalPages up when not evenly divisible', () => {
            const variable: any = {};
            PaginationUtils.setVariablePagination(variable, { size: 10, page: 0, totalElements: 25 }, {});
            expect(variable.pagination.totalPages).toBe(3);
            expect(variable.pagination.number).toBe(0);
        });

        it('sets next/prev/first/last for cursor pagination', () => {
            const variable: any = {};
            PaginationUtils.setVariablePagination(variable, {
                size: 10, page: 0, totalElements: 10, next: 'next-url', prev: undefined
            }, {});
            expect(variable.pagination.next).toBe('next-url');
            expect(variable.pagination.last).toBe(false);
            expect(variable.pagination.first).toBe(true);
        });

        it('computes first/last for non-cursor pagination based on page vs totalPages', () => {
            const variable: any = {};
            PaginationUtils.setVariablePagination(variable, {
                size: 10, page: 2, totalElements: 30, hasMoreItems: ''
            }, {});
            expect(variable.pagination.first).toBe(false);
            expect(variable.pagination.last).toBe(false);
        });
    });

    describe('setPaginationItems', () => {
        it('resolves a $body expression via jmespath', () => {
            const res: any = {};
            PaginationUtils.setPaginationItems('$body.totalElements', { totalElements: 42 }, res, 'totalElements', {});
            expect(res.totalElements).toBe(42);
        });

        it('warns and skips when $body expression is invalid', () => {
            const warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
            const res: any = {};
            PaginationUtils.setPaginationItems('$body.[invalid(', { a: 1 }, res, 'x', {});
            expect(res.x).toBeUndefined();
            expect(warnSpy).toHaveBeenCalled();
            warnSpy.mockRestore();
        });

        it('resolves a simple $header expression', () => {
            const res: any = {};
            const resHeaders = { headers: [['x-total-count', '99']] };
            PaginationUtils.setPaginationItems('$header.X-Total-Count', {}, res, 'totalElements', resHeaders);
            expect(res.totalElements).toBe('99');
        });

        it('falls back to the cloaked header key when the plain header is missing', () => {
            const res: any = {};
            const resHeaders = { headers: [['x-wm-x-total-count', '7']] };
            PaginationUtils.setPaginationItems('$header.X-Total-Count', {}, res, 'totalElements', resHeaders);
            expect(res.totalElements).toBe('7');
        });

        it('resolves a nested $header expression with multiple parts', () => {
            const res: any = {};
            const resHeaders = { headers: [['x-page-info', JSON.stringify({ total: 15 })]] };
            PaginationUtils.setPaginationItems('$header.X-Page-Info.total', {}, res, 'totalElements', resHeaders);
            expect(res.totalElements).toBe(15);
        });

        it('is a no-op when item does not start with $body or $header', () => {
            const res: any = {};
            PaginationUtils.setPaginationItems('plain', {}, res, 'x', {});
            expect(res.x).toBeUndefined();
        });
    });

    describe('getPaginationInfo', () => {
        it('returns operationInfo.paginationInfo when present', () => {
            const info = { type: 'page' };
            expect(PaginationUtils.getPaginationInfo({ paginationInfo: info }, {})).toBe(info);
        });

        it('falls back to variable._paginationConfig', () => {
            const config = { type: 'offset' };
            expect(PaginationUtils.getPaginationInfo({}, { _paginationConfig: config })).toBe(config);
        });
    });

    describe('getOffsetInfo', () => {
        it('computes offset from size and page', () => {
            const variable: any = { pagination: { size: 10 } };
            expect(PaginationUtils.getOffsetInfo(variable, { page: 3 })).toBe(20);
        });

        it('defaults to page 0 offset when page is not provided', () => {
            const variable: any = { pagination: { size: 10 } };
            expect(PaginationUtils.getOffsetInfo(variable, {})).toBe(0);
        });
    });

    describe('checkPaginationAtQuery', () => {
        it('does nothing when options has no page', () => {
            const variable: any = { pagination: { size: 10 } };
            const operationInfo: any = { paginationInfo: { input: { size: 's.v' } }, parameters: [] };
            PaginationUtils.checkPaginationAtQuery(operationInfo, variable, {});
            expect(variable.pagination.page).toBeUndefined();
        });

        it('sets page in query params when the size param is a query param', () => {
            const variable: any = { pagination: { size: 10 } };
            const operationInfo: any = {
                paginationInfo: {
                    type: 'page',
                    input: { page: 'pageNo.value', size: 'pageSize.value' },
                    output: {}
                },
                parameters: [
                    { name: 'pageNo', parameterType: 'query' },
                    { name: 'pageSize', parameterType: 'query' }
                ]
            };
            PaginationUtils.checkPaginationAtQuery(operationInfo, variable, { page: 4, size: 25 });
            expect(variable.pagination.size).toBe(25);
            expect(variable.pagination.page).toBe(4);
            expect(operationInfo.parameters[0].sampleValue).toBe(4);
        });

        it('computes offset-based page when pagination type is offset', () => {
            const variable: any = { pagination: { size: 10 } };
            const operationInfo: any = {
                paginationInfo: {
                    type: 'offset',
                    input: { offset: 'off.value', size: 'sz.value' },
                    output: {}
                },
                parameters: [
                    { name: 'off', parameterType: 'query' },
                    { name: 'sz', parameterType: 'query' }
                ]
            };
            PaginationUtils.checkPaginationAtQuery(operationInfo, variable, { page: 3 });
            expect(variable.pagination.page).toBe(20);
        });

        it('sets sampleValue for cursor pagination path param', () => {
            const variable: any = { pagination: { size: 10 } };
            const operationInfo: any = {
                paginationInfo: {
                    type: 'cursor',
                    input: { page: 'cur.value', size: 'sz.value' }
                },
                parameters: [
                    { name: 'sz', parameterType: 'path', sampleValue: 5 }
                ]
            };
            PaginationUtils.checkPaginationAtQuery(operationInfo, variable, { page: 1, size: 50 });
            expect(operationInfo.parameters[0].sampleValue).toBe(50);
        });
    });

    describe('setTotalElements', () => {
        it('uses $minValue fallback when rendered elements are below the min', () => {
            const res: any = { size: 10, page: 1 };
            const variable: any = { pagination: { totalElements: 100 } };
            PaginationUtils.setTotalElements({ totalElements: '$minValue=5' }, {}, res, variable, {}, {}, {});
            expect(res.totalElements).toBe(5);
        });

        it('uses rendered+1 when rendered elements exceed variable totalElements', () => {
            const res: any = { size: 10, page: 1 };
            const variable: any = { pagination: { totalElements: 5 } };
            PaginationUtils.setTotalElements({ totalElements: '$minValue=5' }, {}, res, variable, {}, {}, {});
            expect(res.totalElements).toBe(11);
        });

        it('resolves totalElements from response output when configured', () => {
            const res: any = { size: 10 };
            PaginationUtils.setTotalElements(
                { totalElements: '$body.total' }, {}, res, {}, { total: 77 }, {}, {}
            );
            expect(res.totalElements).toBe(77);
        });

        it('computes totalElements from size*page+1 for offset pagination without metadata', () => {
            const res: any = { size: 10 };
            PaginationUtils.setTotalElements({}, { page: 2 }, res, {}, {}, { type: 'offset', input: {} }, {});
            expect(res.totalElements).toBe(21);
        });

        it('computes totalElements from size*res.page+1 for page pagination without metadata', () => {
            const res: any = { size: 10, page: 3 };
            PaginationUtils.setTotalElements({}, {}, res, {}, {}, { type: 'page', input: {} }, {});
            expect(res.totalElements).toBe(31);
        });
    });

    describe('generatePaginationRes', () => {
        it('builds res object for non-cursor pagination using output metadata', () => {
            const operationInfo: any = { parameters: [] };
            const paginationInfo: any = {
                type: 'page',
                input: { size: 'sz.value', page: 'pg.value' },
                output: { size: '$body.size', page: '$body.page', totalElements: '$body.totalElements' }
            };
            const response = { size: 10, page: 2, totalElements: 30 };
            const res = PaginationUtils.generatePaginationRes(operationInfo, paginationInfo, response, {}, {}, {});
            expect(res).toEqual({ size: 10, page: 2, totalElements: 30, hasMoreItems: '' });
        });

        it('builds res object for cursor pagination', () => {
            const paginationInfo: any = {
                type: 'cursor',
                input: { page: 'p.value', size: 'sz.value' },
                output: { next: '$body.next', prev: '$body.prev', size: '$body.size', totalElements: '$body.total' }
            };
            const operationInfo: any = { parameters: [], paginationInfo };
            const response = { next: 'n', prev: 'p', size: 10, total: 100 };
            const res: any = PaginationUtils.generatePaginationRes(operationInfo, paginationInfo, response, {}, {}, {});
            expect(res.next).toBe('n');
            expect(res.prev).toBe('p');
            expect(res.size).toBe(10);
            expect(res.totalElements).toBe(100);
        });
    });

    describe('setPaginationAtReq', () => {
        it('sets header pagination info for non-offset input', () => {
            const paginationInfo: any = {
                type: 'page',
                input: { page: 'pg.value', size: 'sz.value' }
            };
            const operationInfo: any = {
                parameters: [{ name: 'pg', parameterType: 'header' }]
            };
            const variable: any = { pagination: { page: 2, size: 10 } };
            const headers: any = {};
            const result: any = PaginationUtils.setPaginationAtReq(paginationInfo, operationInfo, variable, headers, '{}', 'http://x', {});
            expect(result.headers).toBeDefined();
            expect(JSON.parse(headers['X-WM-pg'])).toEqual({ value: 2 });
        });

        it('sets body pagination info when matched param type is body', () => {
            const paginationInfo: any = {
                type: 'page',
                input: { page: 'page', size: 'root.size' }
            };
            const operationInfo: any = {
                parameters: [{
                    name: 'root',
                    parameterType: 'body',
                    sampleValue: { page: 1, size: 10 }
                }]
            };
            const variable: any = { pagination: { page: 2, size: 20 } };
            const result: any = PaginationUtils.setPaginationAtReq(paginationInfo, operationInfo, variable, {}, '', 'http://x', { page: 3 });
            expect(result.requestBody).toBeDefined();
            const parsedBody = JSON.parse(result.requestBody);
            expect(parsedBody.page).toBe(3);
        });

        it('returns empty object when no param matches', () => {
            const paginationInfo: any = { type: 'page', input: { page: 'pg.value', size: 'sz.value' } };
            const operationInfo: any = { parameters: [] };
            const variable: any = { pagination: { page: 1, size: 10 } };
            const result = PaginationUtils.setPaginationAtReq(paginationInfo, operationInfo, variable, {}, '', 'http://x', {});
            expect(result).toEqual({});
        });

        it('updates the url path param for cursor pagination', () => {
            const paginationInfo: any = { type: 'cursor', input: { page: 'cur.value', size: 'sz.value' } };
            const operationInfo: any = {
                relativePath: '/items/{cur}',
                parameters: [{ name: 'cur', parameterType: 'path' }]
            };
            const variable: any = {
                pagination: { size: 10, next: '/items/next-cursor', isNext: true }
            };
            const result: any = PaginationUtils.setPaginationAtReq(
                paginationInfo, operationInfo, variable, {}, '', '/items/old-cursor', {}
            );
            expect(result.url).toContain('next-cursor');
        });
    });

    describe('setParameterVal', () => {
        it('reads sampleValue from the matching operation parameter', () => {
            const res: any = {};
            const operationInfo: any = { parameters: [{ name: 'pg', sampleValue: { value: 4 } }] };
            PaginationUtils.setParameterVal('page', res, operationInfo, { _paginationConfig: { input: { page: 'pg.value' } } });
            expect(res.page).toBe(4);
        });

        it('resolves a nested path when input has multiple parts', () => {
            const res: any = {};
            const operationInfo: any = {
                parameters: [{ name: 'meta', sampleValue: JSON.stringify({ pageInfo: { page: 9 } }) }]
            };
            PaginationUtils.setParameterVal('page', res, operationInfo, {
                _paginationConfig: { input: { page: 'meta.pageInfo.page' } }
            });
            expect(res.page).toBe(9);
        });
    });
});
