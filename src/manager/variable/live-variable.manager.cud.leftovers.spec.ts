import { LiveVariableManager } from './live-variable.manager';
import { LiveVariableUtils } from '../../util/variable/live-variable.utils';
import { wmSetDependency } from '../../util/variable/variables.utils';
import { $queue } from '../../util/inflight-queue';
import { $rootScope, CONSTANTS } from '../../constants/variables.constants';

describe('LiveVariableManager - CUD leftover branches', () => {
    let manager: any;
    let makeCall: jest.SpyInstance;

    const variable = (overrides: any = {}): any => ({
        operation: 'insert',
        inputFields: {},
        propertiesMap: { primaryFields: ['id'] },
        liveSource: 'hrdb',
        type: 'User',
        dateFormatter: { format: (epoch: any) => `fmt-${epoch}` },
        notify: jest.fn(),
        onError: jest.fn(),
        _context: { Actions: {} },
        httpService: { getLocale: () => ({}) },
        ...overrides
    });

    beforeEach(() => {
        jest.restoreAllMocks();
        manager = new LiveVariableManager();
        wmSetDependency('appManager', undefined);
        CONSTANTS.isStudioMode = false;
        ($rootScope as any).project = { id: 'p1', deployedUrl: 'http://host' };
        ($queue as any).requestsQueue = new Map();
        jest.spyOn(LiveVariableUtils, 'getPrimaryKey').mockReturnValue(['id']);
        jest.spyOn(LiveVariableUtils, 'isCompositeKey').mockReturnValue(false);
        jest.spyOn(LiveVariableUtils, 'isNoPrimaryKey').mockReturnValue(false);
        jest.spyOn(LiveVariableUtils, 'isStringType').mockReturnValue(true);
        jest.spyOn(LiveVariableUtils, 'hasBlob').mockReturnValue(false);
        jest.spyOn(LiveVariableUtils, 'getFieldType').mockImplementation(((_name: string, _v: any, key?: string) => (key === 'photo' ? 'blob' : 'string')) as any);
        makeCall = jest.spyOn(manager, 'makeCall').mockResolvedValue({ type: 'ok', body: { id: 1 } });
        jest.spyOn(manager, 'notifyInflight').mockImplementation(() => undefined);
    });

    it('defaults missing options and input fields', async () => {
        await manager.insertRecord(variable({ inputFields: undefined }), undefined, jest.fn(), jest.fn());
        expect(makeCall).toHaveBeenCalled();
    });

    it('clears blob columns of related entities, keeping nulls', async () => {
        const address = { photo: 'bytes', other: 'x' };
        const empty = { photo: null };
        await manager.insertRecord(variable({ inputFields: { address, empty } }), {}, jest.fn(), jest.fn());
        const data = makeCall.mock.calls[0][2].data;
        expect(data.address).toEqual({ photo: '', other: 'x' });
        expect(data.empty).toEqual({ photo: null });
    });

    it('accepts responses that only carry data', async () => {
        makeCall.mockResolvedValue({ status: 200, data: { id: 5 } });
        const v = variable();
        await expect(manager.insertRecord(v, {}, jest.fn(), jest.fn())).resolves.toEqual({ id: 5 });
        expect(v.dataSet).toEqual({ id: 5 });
    });

    it('rejects an error payload in the response', async () => {
        makeCall.mockResolvedValue({ type: 'ok', body: { error: 'bad' } });
        const error = jest.fn();
        await expect(manager.insertRecord(variable(), {}, jest.fn(), error)).rejects.toBe('bad');
        expect(error).toHaveBeenCalledWith('bad');
    });

    it('stops when onBeforeUpdate returns false', async () => {
        const v = variable({ onBeforeUpdate: () => false });
        const error = jest.fn();
        await expect(manager.insertRecord(v, {}, jest.fn(), error)).rejects.toContain('Call stopped');
    });
});
