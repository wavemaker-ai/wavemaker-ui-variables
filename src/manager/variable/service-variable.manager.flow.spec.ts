import { ServiceVariableManager } from './service-variable.manager';
import { wmSetDependency } from '../../util/variable/variables.utils';
import { $queue } from '../../util/inflight-queue';
import { $rootScope } from '../../constants/variables.constants';

describe('ServiceVariableManager - request flow leftovers', () => {
    let manager: any;
    let success: jest.Mock;
    let error: jest.Mock;

    const info = (extra: any = {}) => ({
        directPath: 'http://host/api',
        relativePath: '/api',
        httpMethod: 'GET',
        proxySettings: { web: false },
        parameters: [],
        ...extra
    });
    const variable = (overrides: any = {}): any => ({
        name: 'svc',
        service: 'x',
        operation: 'get',
        serviceType: 'RestService',
        serviceInfo: info(),
        dataBinding: {},
        getPrefabName: () => undefined,
        httpService: { getLocale: () => ({}) },
        _context: { Actions: {} },
        makeHttpCall: jest.fn(),
        ...overrides
    });
    const run = (v: any, options: any = {}) => manager._invoke(v, options, success, error);

    beforeEach(() => {
        jest.restoreAllMocks();
        manager = new ServiceVariableManager();
        success = jest.fn();
        error = jest.fn();
        wmSetDependency('appManager', { notify: jest.fn(), notifyApp: jest.fn(), getAppLocale: () => ({}) });
        wmSetDependency('metadata', undefined);
        ($rootScope as any).project = { id: 'p1', deployedUrl: 'http://host/' };
        ($queue as any).requestsQueue = new Map();
        jest.spyOn(manager, 'processErrorResponse').mockImplementation(() => undefined);
        jest.spyOn(manager, 'processSuccessResponse').mockReturnValue({ ok: true });
        jest.spyOn(manager, 'notifyInflight').mockImplementation(() => undefined);
    });

    it('uses a generic reason when the metadata error has no message', async () => {
        const v = variable({ serviceInfo: undefined });
        jest.spyOn(manager, 'handleRequestMetaError').mockReturnValue(undefined);
        await expect(run(v)).rejects.toContain('An error occurred while triggering the variable');
    });

    it('does not simulate a download when the variable cannot', async () => {
        const v = variable({ serviceInfo: info({ produces: ['application/octet-stream'] }) });
        v.makeHttpCall.mockImplementation((_r: any, _i: any, ok: Function) => ok({ type: 'ok', body: '{}' }));
        await run(v);
        expect(v.makeHttpCall).toHaveBeenCalled();
    });

    it('falls back to the variable name for the downloaded file', () => {
        const simulateFileDownload = jest.fn().mockReturnValue('dl');
        const v = variable({ serviceInfo: info({ produces: ['application/octet-stream'] }), simulateFileDownload });
        expect(run(v)).toBe('dl');
        expect(simulateFileDownload.mock.calls[0][1]).toBe('svc');
    });

    it('ignores responses without type or status', async () => {
        const v = variable();
        v.makeHttpCall.mockImplementation((_r: any, _i: any, ok: Function) => ok({}));
        let settled = false;
        run(v).then(() => (settled = true), () => (settled = true));
        await new Promise(r => setTimeout(r, 0));
        expect(settled).toBe(false);
    });

    it('keeps non JSON error bodies and defaults missing ones', async () => {
        const plain = variable();
        plain.makeHttpCall.mockImplementation((_r: any, _i: any, _ok: Function, fail: Function) => fail({ status: 500, error: 'plain text' }));
        await expect(run(plain)).rejects.toEqual(expect.objectContaining({ details: expect.objectContaining({ error: 'plain text' }) }));
        const none = variable();
        none.makeHttpCall.mockImplementation((_r: any, _i: any, _ok: Function, fail: Function) => fail({ status: 500 }));
        await expect(run(none)).rejects.toBeDefined();
    });

    it('invoke defaults missing options', async () => {
        const v = variable({ dataBinding: { q: 1 } });
        v.makeHttpCall.mockImplementation((_r: any, _i: any, ok: Function) => ok({ type: 'ok', body: '{}' }));
        await expect(manager.invoke(v, undefined, jest.fn(), jest.fn())).resolves.toBeDefined();
    });
});
