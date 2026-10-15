import { BaseVariableManager } from './base-variable.manager';
import { wmSetDependency } from '../../util/variable/variables.utils';

describe('BaseVariableManager', () => {
    let manager: BaseVariableManager;

    beforeEach(() => {
        manager = new BaseVariableManager();
    });

    describe('initBinding', () => {
        it('does not throw (currently a no-op)', () => {
            expect(() => manager.initBinding({}, {}, {})).not.toThrow();
        });
    });

    describe('notifyInflight', () => {
        it('notifies the app manager with the variable state', () => {
            const notify = jest.fn();
            wmSetDependency('appManager', { notify });
            const variable = { name: 'v1' };
            manager.notifyInflight(variable, true, { a: 1 }, { b: 2 });
            expect(notify).toHaveBeenCalledWith('toggle-variable-state', {
                variable,
                active: true,
                data: { a: 1 },
                options: { b: 2 }
            });
        });

        it('does not throw when no app manager dependency is set', () => {
            wmSetDependency('appManager', undefined);
            expect(() => manager.notifyInflight({}, false)).not.toThrow();
        });
    });

    describe('setRequestTrackId', () => {
        it('reads the track id from a headers.get() style response', () => {
            const variable: any = {};
            const response = { headers: { get: (key: string) => (key === 'x-wm-request-track-id' ? 'track-1' : undefined) } };
            manager.setRequestTrackId(response, variable);
            expect(variable._requestTrackId).toBe('track-1');
        });

        it('reads the track id from a plain headers object', () => {
            const variable: any = {};
            const response = { headers: { 'x-wm-request-track-id': 'track-2' } };
            manager.setRequestTrackId(response, variable);
            expect(variable._requestTrackId).toBe('track-2');
        });

        it('does not set a track id when the response has no headers', () => {
            const variable: any = {};
            manager.setRequestTrackId(undefined, variable);
            expect(variable._requestTrackId).toBeUndefined();
        });
    });

    describe('httpCall', () => {
        it('resolves with the response when the http service call succeeds', async () => {
            const response = { status: 200, headers: {} };
            const variable: any = {
                httpService: { sendCall: jest.fn().mockResolvedValue(response) }
            };
            const result = await manager.httpCall({}, variable);
            expect(result).toBe(response);
            expect(variable.httpService.sendCall).toHaveBeenCalled();
        });

        it('rejects with the error when the http service call fails (non session-timeout)', async () => {
            const error = { status: 500 };
            const variable: any = {
                httpService: {
                    sendCall: jest.fn().mockRejectedValue(error),
                    isPlatformSessionTimeout: () => false
                }
            };
            await expect(manager.httpCall({}, variable)).rejects.toBe(error);
        });

        it('resolves after a session-timeout retry succeeds', async () => {
            const retryResponse = { status: 200 };
            let notifiedFalse = false;
            wmSetDependency('appManager', {
                notify: () => { notifiedFalse = true; }
            });
            const error: any = {
                status: 401,
                _401Subscriber: {
                    asObservable: () => ({
                        subscribe: (onNext: any) => {
                            onNext(retryResponse);
                        }
                    })
                }
            };
            const variable: any = {
                httpService: {
                    sendCall: jest.fn().mockRejectedValue(error),
                    isPlatformSessionTimeout: () => true
                }
            };
            const result = await manager.httpCall({}, variable);
            expect(result).toBe(retryResponse);
            expect(notifiedFalse).toBe(true);
        });
    });

    describe('prepareCallbackOptions', () => {
        it('returns an options object with the xhrObj set', () => {
            const xhr = {};
            expect(manager.prepareCallbackOptions(xhr)).toEqual({ xhrObj: xhr });
        });

        it('merges in additional options when provided', () => {
            const xhr = {};
            expect(manager.prepareCallbackOptions(xhr, { skipUpdate: true })).toEqual({
                xhrObj: xhr,
                skipUpdate: true
            });
        });
    });
});
