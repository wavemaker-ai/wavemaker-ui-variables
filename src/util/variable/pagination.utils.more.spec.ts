import { PaginationUtils } from './pagination.utils';

describe('PaginationUtils - additional paths', () => {
    let warn: jest.SpyInstance;

    beforeEach(() => {
        warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    });

    afterEach(() => {
        warn.mockRestore();
    });

    describe('setVariablePagination', () => {
        it('derives first and last from the page and the total pages without cursors', () => {
            const variable: any = {};
            PaginationUtils.setVariablePagination(variable, { size: 10, page: 1, totalElements: 30, hasMoreItems: '' }, {});
            expect(variable.pagination.first).toBe(true);
            expect(variable.pagination.last).toBe(false);
        });

        it('marks the last page when the page reaches the total pages', () => {
            const variable: any = {};
            PaginationUtils.setVariablePagination(variable, { size: 10, page: 3, totalElements: 30, hasMoreItems: '' }, { page: 3 });
            expect(variable.pagination.last).toBe(true);
            expect(variable.pagination.first).toBe(false);
            expect(variable.pagination.number).toBe(2);
        });

        it('trusts hasMoreItems from the response when it is given', () => {
            const variable: any = {};
            PaginationUtils.setVariablePagination(variable, { size: 10, page: 1, totalElements: 30, hasMoreItems: false }, {});
            expect(variable.pagination.last).toBe(true);
        });

        it('marks the first and last flags for cursor responses without next or prev', () => {
            const variable: any = {};
            PaginationUtils.setVariablePagination(variable, { size: 5, page: 0, totalElements: 5, next: 'n' }, {});
            expect(variable.pagination.last).toBe(false);
            expect(variable.pagination.first).toBe(true);
            expect(variable.pagination.prev).toBeUndefined();
        });
    });

    describe('setPaginationItems', () => {
        const headers = (entries: [string, string][]) => ({ headers: new Map(entries.map(([k, v]) => [k, [v]] as [string, string[]])) });

        it('reads a header whose value is a list by joining it', () => {
            const res: any = {};
            PaginationUtils.setPaginationItems('$header.link', {}, res, 'next', headers([['link', 'a']]));
            expect(res.next).toBe('a');
        });

        it('evaluates a nested key of a json header', () => {
            const res: any = {};
            PaginationUtils.setPaginationItems('$header.pagination.total', {}, res, 'total', headers([['pagination', '{"total": 42}']]));
            expect(res.total).toBe(42);
        });

        it('prefixes the root key for expressions that contain special characters', () => {
            const res: any = {};
            PaginationUtils.setPaginationItems('$header.pagination.total > `10`', {}, res, 'flag', headers([['pagination', '{"headerResp": {"total": 42}}']]));
            expect(res.flag).toBe(true);
        });

        it('warns when a nested header expression cannot be evaluated', () => {
            const res: any = {};
            PaginationUtils.setPaginationItems('$header.pagination.[', {}, res, 'x', headers([['pagination', '{"total": 42}']]));
            expect(warn).toHaveBeenCalled();
        });
    });

    describe('checkPaginationAtQuery with offset pagination', () => {
        const operationInfo = () => ({ parameters: [{ name: 'offset', parameterType: 'query' }, { name: 'limit', parameterType: 'query' }] });

        it('computes the offset from the size and the requested page', () => {
            const variable: any = { dataBinding: { a: 1 }, pagination: { size: 10, page: 0 } };
            const info = operationInfo();
            const paginationInfo = { type: 'offset', input: { offset: 'offset', size: 'limit' } };
            const params = { paginationInfo };
            PaginationUtils.checkPaginationAtQuery({ ...info, ...params }, variable, { page: 3 });
            expect(variable.pagination.page).toBe(20);
            expect(info.parameters[0]).toEqual(expect.objectContaining({ sampleValue: 20 }));
            expect(info.parameters[1]).toEqual(expect.objectContaining({ sampleValue: 10 }));
        });

        it('uses the offset calculation when the output has a page key', () => {
            const variable: any = { dataBinding: { a: 1 }, pagination: { size: 10, page: 0 } };
            const op: any = {
                parameters: [{ name: 'p', parameterType: 'query' }, { name: 's', parameterType: 'query' }],
                paginationInfo: { input: { page: 'p', size: 's' }, output: { page: '$body.page' } },
            };
            PaginationUtils.checkPaginationAtQuery(op, variable, { page: 2 });
            expect(variable.pagination.page).toBe(10);
        });

        it('ignores pagination parameters that are not query parameters', () => {
            const variable: any = { dataBinding: { a: 1 }, pagination: { size: 10, page: 0 } };
            const op: any = {
                parameters: [{ name: 'p', parameterType: 'header' }],
                paginationInfo: { input: { page: 'p', size: 's' } },
            };
            PaginationUtils.checkPaginationAtQuery(op, variable, { page: 2 });
            expect(variable.pagination.page).toBe(0);
        });
    });

    describe('setPaginationAtReq', () => {
        const base = (overrides: any = {}) => ({
            operationInfo: { parameters: [], relativePath: '/items/{cursor}', ...overrides.operationInfo },
            variable: { pagination: { page: 2, size: 10, ...overrides.pagination } },
        });

        it('sets nested header values as json on the cloaked header', () => {
            const { operationInfo, variable } = base({ operationInfo: { parameters: [{ name: 'ctx', parameterType: 'header' }] } });
            const result = PaginationUtils.setPaginationAtReq({ input: { page: 'ctx.page', size: 'ctx.size' } }, operationInfo, variable, {}, '', 'u', {});
            expect(JSON.parse((result as any).headers['X-WM-ctx'])).toEqual({ page: 2, size: 10 });
        });

        it('writes the offset into the request body for offset pagination', () => {
            const { operationInfo, variable } = base({
                operationInfo: { parameters: [{ name: 'body', parameterType: 'body', sampleValue: '{"paging":{"offset":1,"limit":1}}' }] },
            });
            const result: any = PaginationUtils.setPaginationAtReq(
                { type: 'offset', input: { offset: 'body.paging.offset', size: 'body.paging.limit' } },
                operationInfo, variable, {}, '', 'u', { page: 3 });
            expect(JSON.parse(result.requestBody)).toEqual({ paging: { offset: 20, limit: 10 } });
        });

        it('leaves the body alone when the body does not contain the pagination object', () => {
            const { operationInfo, variable } = base({
                operationInfo: { parameters: [{ name: 'body', parameterType: 'body', sampleValue: '{"other":1}' }] },
            });
            const result = PaginationUtils.setPaginationAtReq({ input: { page: 'body.paging.page', size: 'body.paging.size' } }, operationInfo, variable, {}, '', 'u', {});
            expect(result).toEqual({});
        });

        describe('cursor in the path', () => {
            const cursorInfo = { input: { page: 'cursor', size: 'size' } };
            const operation = (extra: any = {}) => ({ parameters: [{ name: 'cursor', parameterType: 'path' }], relativePath: '/items/{cursor}', ...extra });

            it('moves to the next cursor for a proxy call', () => {
                const variable: any = { pagination: { next: '/items/NEXT', prev: '/items/PREV', isNext: true } };
                const result: any = PaginationUtils.setPaginationAtReq(cursorInfo, operation(), variable, {}, '', '/services/items/CUR', {});
                expect(result.url).toBe('/services/items/NEXT');
            });

            it('moves to the previous cursor when navigating back', () => {
                const variable: any = { pagination: { next: '/items/NEXT', prev: '/items/PREV', isNext: false } };
                const result: any = PaginationUtils.setPaginationAtReq(cursorInfo, operation(), variable, {}, '', '/services/items/CUR', {});
                expect(result.url).toBe('/services/items/PREV');
            });

            it('rewrites the path of a direct call through the url object', () => {
                const variable: any = { pagination: { next: '/items/NEXT', prev: '/items/PREV', isNext: true } };
                const result: any = PaginationUtils.setPaginationAtReq(cursorInfo, operation({ directPath: 'http://host/items/{cursor}' }), variable, {}, '', 'http://host/items/CUR', {});
                expect(result.url).toBe('http://host/items/NEXT');
            });
        });

        it('rewrites the query of the cursor url for previous navigation and keeps the page size', () => {
            const variable: any = { pagination: { next: 'x?cursor=N', prev: 'x?cursor=P', isNext: false, isPrev: true } };
            const op = { parameters: [{ name: 'cursor', parameterType: 'query' }, { name: 'size', parameterType: 'query', sampleValue: 5 }], relativePath: '/items' };
            const result: any = PaginationUtils.setPaginationAtReq({ input: { page: 'cursor', size: 'size' } }, op, variable, {}, '', 'http://host/items?cursor=C', {});
            expect(result.url).toBe('http://host/items?cursor=P&size=5');
        });

        it('rewrites the query of the cursor url for next navigation', () => {
            const variable: any = { pagination: { next: 'x?cursor=N', prev: 'x?cursor=P', isNext: true } };
            const op = { parameters: [{ name: 'cursor', parameterType: 'query' }], relativePath: '/items' };
            const result: any = PaginationUtils.setPaginationAtReq({ input: { page: 'cursor', size: 'size' } }, op, variable, {}, '', 'http://host/items?cursor=C', {});
            expect(result.url).toBe('http://host/items?cursor=N');
        });

        it('keeps the url when neither direction is requested', () => {
            const variable: any = { pagination: { next: 'x?cursor=N', prev: 'x?cursor=P' } };
            const op = { parameters: [{ name: 'cursor', parameterType: 'query' }], relativePath: '/items' };
            expect(PaginationUtils.setPaginationAtReq({ input: { page: 'cursor', size: 'size' } }, op, variable, {}, '', 'http://host/items?cursor=C', {})).toEqual({});
        });

        it('does nothing for cursors in unsupported parameter types', () => {
            const variable: any = { pagination: { next: 'n', prev: 'p', isNext: true } };
            const op = { parameters: [{ name: 'cursor', parameterType: 'cookie' }], relativePath: '/items' };
            expect(PaginationUtils.setPaginationAtReq({ input: { page: 'cursor', size: 'size' } }, op, variable, {}, '', 'u', {})).toEqual({});
        });
    });

    describe('generatePaginationRes', () => {
        const parameters = [{ name: 'page', sampleValue: 2 }, { name: 'size', sampleValue: 10 }];
        const info = (overrides: any = {}) => ({ input: { page: 'page', size: 'size' }, ...overrides });
        // the request parameters are resolved through the pagination info stored on the operation
        const generate = (paginationInfo: any, response: any, options: any, variable: any, params: any[] = parameters) =>
            PaginationUtils.generatePaginationRes({ parameters: params, paginationInfo }, paginationInfo, response, undefined, options, variable);

        it('takes size, page and totals from the response body', () => {
            const res = generate(
                info({ output: { size: '$body.size', page: '$body.page', totalElements: '$body.total', hasMoreItems: '$body.more' } }),
                { size: 5, page: 4, total: 99, more: true }, {}, {});
            expect(res).toEqual({ size: 5, page: 4, totalElements: 99, hasMoreItems: true });
        });

        it('reads the size and page from the request parameters otherwise', () => {
            const res: any = generate(info({ output: {} }), {}, {}, {});
            expect(res.size).toBe(10);
            expect(res.page).toBe(2);
            expect(res.totalElements).toBe(21);
            expect(res.hasMoreItems).toBe('');
        });

        it('does not read a page for offset pagination and derives the total from the page option', () => {
            const res: any = generate({ type: 'offset', input: { offset: 'page', size: 'size', page: 'page' }, output: {} }, {}, { page: 3 }, {});
            expect(res.page).toBeUndefined();
            expect(res.totalElements).toBe(31);
        });

        it('keeps the minimum total while there are more records than rendered', () => {
            const res: any = generate(info({ output: { totalElements: '$minValue=100' } }), {}, {}, { pagination: { totalElements: 500 } });
            expect(res.totalElements).toBe(100);
        });

        it('uses the minimum total when the variable has no pagination yet', () => {
            const res: any = generate(info({ output: { totalElements: '$minValue=100' } }), {}, {}, {});
            expect(res.totalElements).toBe(100);
        });

        it('extends the total by one once all known records are rendered', () => {
            const res: any = generate(info({ output: { totalElements: '$minValue=100' } }), {}, {}, { pagination: { totalElements: 5 } });
            expect(res.totalElements).toBe(21);
        });

        it('uses the page option when the page is unknown for the minimum total', () => {
            const res: any = generate(
                { type: 'offset', input: { offset: 'offset', size: 'size' }, output: { totalElements: '$minValue=100' } },
                {}, { page: 2 }, { pagination: { totalElements: 5 } }, [{ name: 'size', sampleValue: 10 }]);
            expect(res.totalElements).toBe(21);
        });

        it('reads next and prev for cursor pagination', () => {
            const res = generate({ input: { page: 'page', size: 'size' }, output: { next: '$body.next', prev: '$body.prev' } }, { next: 'n', prev: 'p' }, {}, {});
            expect(res).toMatchObject({ next: 'n', prev: 'p' });
        });
    });
});
