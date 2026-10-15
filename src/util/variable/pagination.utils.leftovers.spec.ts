import { PaginationUtils } from './pagination.utils';
import { CacheInterceptor } from '../../interceptor/cache-interceptor';
import { BaseVariableManager } from '../../manager/variable/base-variable.manager';

describe('PaginationUtils - remaining branches', () => {
    beforeEach(() => jest.restoreAllMocks());

    it('marks both cursors present when next and prev exist', () => {
        const v: any = {};
        PaginationUtils.setVariablePagination(v, { size: 5, totalElements: 10, next: 'n', prev: 'p' }, { page: 2 });
        expect(v.pagination.first).toBe(false);
        expect(v.pagination.last).toBe(false);
    });

    it('reads headers from a plain iterable', () => {
        const res: any = {};
        PaginationUtils.setPaginationItems('$header.x-total', {}, res, 'total', [['x-total', '4']]);
        expect(res.total).toBe('4');
    });

    describe('checkPaginationAtQuery', () => {
        const info = (extra: any = {}) => ({ type: 'cursor', input: { size: 'limit', page: 'cur' }, ...extra });

        it('returns when options are missing', () => {
            const v: any = { pagination: { size: 1 }, _paginationConfig: info() };
            expect(PaginationUtils.checkPaginationAtQuery({ parameters: [] }, v, undefined)).toBeUndefined();
        });

        it('returns when pagination info is missing', () => {
            const v: any = { pagination: {} };
            expect(PaginationUtils.checkPaginationAtQuery({ parameters: [] }, v, { page: 1 })).toBeUndefined();
        });

        it('sets the path size parameter for cursor type from options', () => {
            const p: any = { name: 'limit', parameterType: 'path', sampleValue: 1 };
            const v: any = { pagination: { size: 3 }, _paginationConfig: info() };
            PaginationUtils.checkPaginationAtQuery({ parameters: [p] }, v, { page: 1, size: 9 });
            expect(p.sampleValue).toBe(9);
        });

        it('falls back to the variable pagination size, then the sample value', () => {
            const p: any = { name: 'limit', parameterType: 'path', sampleValue: 1 };
            PaginationUtils.checkPaginationAtQuery({ parameters: [p] }, { pagination: { size: 3 }, _paginationConfig: info() } as any, { page: 1 });
            expect(p.sampleValue).toBe(3);
            const q: any = { name: 'limit', parameterType: 'path', sampleValue: 1 };
            PaginationUtils.checkPaginationAtQuery({ parameters: [q] }, { pagination: {}, _paginationConfig: info() } as any, { page: 1 });
            expect(q.sampleValue).toBe(1);
        });

        it('ignores a cursor size param that is not a path parameter', () => {
            const p: any = { name: 'limit', parameterType: 'query', sampleValue: 1 };
            PaginationUtils.checkPaginationAtQuery({ parameters: [p] }, { pagination: { size: 3 }, _paginationConfig: info() } as any, { page: 1, size: 7 });
            expect(p.sampleValue).toBe(1);
        });

        it('does nothing for a cursor type whose size input is empty', () => {
            const cfg: any = { type: 'cursor', input: { size: '', page: 'cur' } };
            expect(PaginationUtils.checkPaginationAtQuery({ parameters: [] }, { pagination: {}, _paginationConfig: cfg } as any, { page: 1 })).toBeUndefined();
        });
    });

    describe('setParameterVal', () => {
        const op = (v: any) => ({ parameters: [{ name: 'size', sampleValue: v }], paginationInfo: { type: 'page', input: { size: 'size' } } });

        it('overrides the size from options when present', () => {
            const o: any = op(5);
            const res: any = {};
            PaginationUtils.setParameterVal('size', res, o, {}, { size: 20 });
            expect(res.size).toBe(20);
        });

        it('keeps the sample value when options carry no size or the sample is empty', () => {
            const res: any = {};
            PaginationUtils.setParameterVal('size', res, op(5), {}, {});
            expect(res.size).toBe(5);
            const res2: any = {};
            PaginationUtils.setParameterVal('size', res2, op(0), {}, { size: 20 });
            expect(res2.size).toBe(0);
        });

        it('does not override for other pagination types', () => {
            const o: any = { parameters: [{ name: 'size', sampleValue: 5 }], paginationInfo: { type: 'cursor', input: { size: 'size' } } };
            const res: any = {};
            PaginationUtils.setParameterVal('size', res, o, {}, { size: 20 });
            expect(res.size).toBe(5);
        });
    });

    describe('generatePaginationRes size resolution', () => {
        const gen = (info: any, response: any) => {
            const op: any = { parameters: [{ name: 's', sampleValue: 4 }, { name: 'p', sampleValue: 1 }], paginationInfo: info };
            return PaginationUtils.generatePaginationRes(op, info, response, undefined, {}, {});
        };

        it('uses a numeric configured size', () => {
            expect((gen({ type: 'page', input: { size: '25', page: 'p' }, output: {} }, {}) as any).size).toBe('25');
        });

        it('reads the size from the response when the configured size is a path', () => {
            expect((gen({ type: 'page', input: { size: 'pageSize', page: 'p' }, output: {} }, { pageSize: 8 }) as any).size).toBe(8);
        });

        it('keeps the existing size when the configured value resolves to nothing', () => {
            expect((gen({ type: 'page', input: { size: 'nope', page: 'p' }, output: {} }, {}) as any).size).toBeUndefined();
        });

        it('treats a missing output as non-cursor pagination', () => {
            expect(() => gen({ type: 'page', input: { size: 's', page: 'p' } }, {})).not.toThrow();
        });

        it('skips cursor handling when no output exists on a cursor pagination', () => {
            const cfg: any = { type: 'cursor', input: { size: 's', page: 'p' }, output: { next: 'x' } };
            const op: any = { parameters: [], paginationInfo: cfg };
            const res = PaginationUtils.generatePaginationRes(op, cfg, { x: 1 }, undefined, {}, {});
            expect(res).toBeDefined();
        });
    });

    describe('setPaginationAtReq body handling', () => {
        const run = (options: any) => {
            const paramObj: any = { name: 'body', parameterType: 'body', sampleValue: JSON.stringify({ page: 1, size: 10 }) };
            const info: any = { type: 'page', input: { page: 'page', size: 'body.size' } };
            const variable: any = { pagination: { size: 10 } };
            return PaginationUtils.setPaginationAtReq(info, { parameters: [paramObj] }, variable, {}, '', 'u', options);
        };

        it('defaults the page to 1 when options carry none', () => {
            expect(() => run({})).not.toThrow();
        });

        it('uses the page from options', () => {
            expect(() => run({ page: 3 })).not.toThrow();
        });
    });
});

describe('CacheInterceptor.match', () => {
    it('is false without an inner interceptor and delegates otherwise', () => {
        expect(new CacheInterceptor(undefined as any).match({} as any)).toBe(false);
        expect(new CacheInterceptor({} as any).match({} as any)).toBe(false);
        expect(new CacheInterceptor({ match: () => true } as any).match({} as any)).toBe(true);
    });
});

describe('BaseVariableManager.httpCall', () => {
    it('never settles when the response has neither type nor status', async () => {
        const mgr: any = new (BaseVariableManager as any)();
        const variable: any = { httpService: { sendCall: jest.fn().mockResolvedValue({}) } };
        let settled = false;
        mgr.httpCall({}, variable).then(() => (settled = true), () => (settled = true));
        await new Promise(r => setTimeout(r, 0));
        expect(settled).toBe(false);
    });

    it('resolves a response that has only a status', async () => {
        const mgr: any = new (BaseVariableManager as any)();
        jest.spyOn(mgr, 'setRequestTrackId').mockImplementation(() => {});
        const variable: any = { httpService: { sendCall: jest.fn().mockResolvedValue({ status: 200 }) } };
        await expect(mgr.httpCall({}, variable)).resolves.toEqual({ status: 200 });
    });
});
