import { ServiceVariableManager } from './service-variable.manager';
import { wmSetDependency } from '../../util/variable/variables.utils';
import { $queue } from '../../util/inflight-queue';

describe('ServiceVariableManager - leftover getMethodInfo branches', () => {
    let manager: any;

    beforeEach(() => {
        jest.restoreAllMocks();
        manager = new ServiceVariableManager();
        wmSetDependency('metadata', undefined);
        wmSetDependency('appManager', { notify: jest.fn() });
        ($queue as any).requestsQueue = new Map();
    });

    const info = (extra: any = {}) => ({
        serviceInfo: { parameters: [{ name: 'size' }, { name: 'page' }, { name: 'sort' }] },
        getPrefabName: () => '',
        ...extra
    } as any);
    const values = (v: any, input: any, options: any) => manager.getMethodInfo(v, input, options).parameters.map((p: any) => p.sampleValue);

    it('prefers option values for size, page and sort', () => {
        expect(values(info({ orderBy: 'a asc' }), {}, { size: 5, page: 2, orderBy: 'b desc' })).toEqual([5, 2, expect.stringContaining('b desc')]);
    });

    it('falls back to input values, the configured pagination size, the max results and defaults', () => {
        expect(values(info(), { size: 9, page: 3, sort: 's' }, {})).toEqual([9, 3, 's']);
        expect(values(info({ _paginationConfig: { input: { size: 12 } } }), {}, {})).toEqual([12, 1, '']);
        expect(values(info({ maxResults: '30' }), {}, {})).toEqual([30, 1, '']);
        expect(values(info({ _paginationConfig: {} }), {}, {})).toEqual([20, 1, '']);
    });

    it('leaves read-only parameters alone', () => {
        const v = info({ serviceInfo: { parameters: [{ name: 'size', readOnly: true, sampleValue: 'keep' }] } });
        expect(values(v, { size: 1 }, {})).toEqual(['keep']);
    });
});

describe('ServiceVariableManager - upload inputs', () => {
    it('ignores array entries that are neither files nor blobs', () => {
        const manager: any = new ServiceVariableManager();
        const variable: any = { name: 'v', getPrefabName: () => '' };
        expect(manager.uploadFile(variable, {}, jest.fn(), jest.fn(), { files: [{ a: 1 }], more: [] }, {})).toBeUndefined();
    });
});
