import { CrudVariableManager } from './crud-variable.manager';
import { wmSetDependency } from '../../util/variable/variables.utils';
import { $queue } from '../../util/inflight-queue';

describe('CrudVariableManager', () => {
    let manager: CrudVariableManager;

    beforeEach(() => {
        manager = new CrudVariableManager();
        wmSetDependency('appManager', { notify: jest.fn() });
        ($queue as any).requestsQueue = new Map();
    });

    describe('initBinding', () => {
        it('flattens per-operation binding nodes into a single list prefixed with the operation name', () => {
            const variable: any = {
                dataBinding: {
                    list: [{ target: 'q', value: 'X' }],
                    update: [{ target: 'id', value: 'bind:...' }]
                }
            };
            manager.initBinding(variable);
            expect(variable.dataBinding).toEqual([
                { target: 'list.q', value: 'X' },
                { target: 'update.id', value: 'bind:...' }
            ]);
        });

        it('handles an empty dataBinding object', () => {
            const variable: any = { dataBinding: {} };
            manager.initBinding(variable);
            expect(variable.dataBinding).toEqual([]);
        });

        it('handles operation entries with no bind nodes', () => {
            const variable: any = { dataBinding: { list: null } };
            manager.initBinding(variable);
            expect(variable.dataBinding).toEqual([]);
        });
    });

    describe('setInput', () => {
        it('creates the dataBinding bucket for the given type and sets the value', () => {
            const variable: any = { dataBinding: {} };
            manager.setInput(variable, 'q', 'search-term', {});
            expect(variable.dataBinding.list).toEqual({ q: 'search-term' });
        });

        it('uses the provided type instead of the default "list"', () => {
            const variable: any = { dataBinding: {} };
            manager.setInput(variable, 'name', 'wm', {}, 'update');
            expect(variable.dataBinding.update).toEqual({ name: 'wm' });
        });

        it('reuses an existing non-empty bucket rather than resetting it', () => {
            const variable: any = { dataBinding: { list: { existing: 1 } } };
            manager.setInput(variable, 'q', 'x', {});
            expect(variable.dataBinding.list).toEqual({ existing: 1, q: 'x' });
        });
    });

    describe('getInputParms', () => {
        it('returns the parameters from the operation metadata for the variable', () => {
            wmSetDependency('metadata', {
                getByOperationId: () => ({
                    wmServiceOperationInfo: { parameters: [{ name: 'id' }] }
                })
            });
            const variable: any = { operationId: 'op1', getPrefabName: () => undefined };
            expect(manager.getInputParms(variable)).toEqual([{ name: 'id' }]);
        });

        it('returns undefined when metadata has no matching operation', () => {
            wmSetDependency('metadata', { getByOperationId: () => undefined });
            const variable: any = { operationId: 'missing', getPrefabName: () => undefined };
            expect(manager.getInputParms(variable)).toBeUndefined();
        });
    });

    describe('getOperationInfo (private)', () => {
        const getOperationInfo = (m: CrudVariableManager, variable: any, options: any) =>
            (m as any).getOperationInfo(variable, options);

        it('returns the wmServiceOperationInfo for the matching operation type', () => {
            wmSetDependency('metadata', {
                getByCrudId: () => [
                    { operationType: 'list', wmServiceOperationInfo: { id: 'list-op' } },
                    { operationType: 'create', wmServiceOperationInfo: { id: 'create-op' } }
                ]
            });
            const variable: any = { crudOperationId: 'crud1', getPrefabName: () => undefined };
            const result = getOperationInfo(manager, variable, { operation: 'create' });
            expect(result).toEqual({ id: 'create-op' });
        });

        it('defaults the operation to "list" when options.operation is not set', () => {
            wmSetDependency('metadata', {
                getByCrudId: () => [{ operationType: 'list', wmServiceOperationInfo: { id: 'list-op' } }]
            });
            const variable: any = { crudOperationId: 'crud1', getPrefabName: () => undefined };
            const options: any = {};
            const result = getOperationInfo(manager, variable, options);
            expect(result).toEqual({ id: 'list-op' });
            expect(options.operation).toBe('list');
        });

        it('returns undefined when the service definition list is empty', () => {
            wmSetDependency('metadata', { getByCrudId: () => [] });
            const variable: any = { crudOperationId: 'crud1', getPrefabName: () => undefined };
            expect(getOperationInfo(manager, variable, { operation: 'list' })).toBeUndefined();
        });

        it('returns an invalid marker when no operation type matches', () => {
            wmSetDependency('metadata', {
                getByCrudId: () => [{ operationType: 'list', wmServiceOperationInfo: { id: 'list-op' } }]
            });
            const variable: any = { crudOperationId: 'crud1', getPrefabName: () => undefined };
            const result = getOperationInfo(manager, variable, { operation: 'delete' });
            expect(result).toEqual({ invalid: true });
        });
    });

    describe('getMethodInfoForCrud (private)', () => {
        const getMethodInfoForCrud = (m: CrudVariableManager, variable: any, inputFields: any, options: any) =>
            (m as any).getMethodInfoForCrud(variable, inputFields, options);

        it('returns the invalid marker unchanged when the operation is invalid', () => {
            wmSetDependency('metadata', {
                getByCrudId: () => [{ operationType: 'list', wmServiceOperationInfo: { id: 'x' } }]
            });
            const variable: any = { crudOperationId: 'crud1', getPrefabName: () => undefined };
            const result = getMethodInfoForCrud(manager, variable, {}, { operation: 'delete' });
            expect(result).toEqual({ invalid: true });
        });

        it('sets sampleValue from inputFields on each parameter, skipping readOnly ones', () => {
            wmSetDependency('metadata', {
                getByCrudId: () => [{
                    operationType: 'update',
                    wmServiceOperationInfo: {
                        parameters: [
                            { name: 'name' },
                            { name: 'id', readOnly: true }
                        ]
                    }
                }]
            });
            const variable: any = { crudOperationId: 'crud1', getPrefabName: () => undefined };
            const result = getMethodInfoForCrud(manager, variable, { name: 'wm', id: 99 }, { operation: 'update' });
            expect(result.parameters[0].sampleValue).toBe('wm');
            expect(result.parameters[1].sampleValue).toBeUndefined();
        });

        it('fills in default pagination sample values for page/size/sort params', () => {
            wmSetDependency('metadata', {
                getByCrudId: () => [{
                    operationType: 'list',
                    wmServiceOperationInfo: {
                        parameters: [
                            { name: 'page' },
                            { name: 'size' },
                            { name: 'sort' }
                        ]
                    }
                }]
            });
            const variable: any = { crudOperationId: 'crud1', getPrefabName: () => undefined, maxResults: '25' };
            const result = getMethodInfoForCrud(manager, variable, {}, { operation: 'list' });
            expect(result.parameters[0].sampleValue).toBe(1);
            expect(result.parameters[1].sampleValue).toBe(25);
            expect(result.parameters[2].sampleValue).toBe('');
        });
    });

    describe('invoke / _invoke', () => {
        const stubMetadataForCrud = (parameters: any[] = []) => {
            wmSetDependency('metadata', {
                getByCrudId: () => [{ operationType: 'list', wmServiceOperationInfo: { directPath: '/api/items', relativePath: '/api/items', httpMethod: 'GET', proxySettings: { web: false }, parameters } }],
                // processErrorResponse (inherited from ServiceVariableManager) always calls the
                // Service-variable-flavored getMethodInfo(), which looks up getByOperationId even
                // for a CRUD variable - a real metadataService implements this too, so it's stubbed
                // here to avoid a crash rather than exercising a genuine product bug.
                getByOperationId: () => undefined
            });
        };

        it('aborts when BEFORE_UPDATE returns false (resolves with undefined, same as ServiceVariableManager)', async () => {
            stubMetadataForCrud();
            const variable: any = {
                dataBinding: {},
                getPrefabName: () => undefined,
                onBeforeUpdate: jest.fn().mockReturnValue(false)
            };
            const error = jest.fn();
            await manager.invoke(variable, {}, jest.fn(), error);
            expect(error).toHaveBeenCalled();
        });

        it('rejects when the crud operation cannot be resolved from metadata', async () => {
            wmSetDependency('metadata', { getByCrudId: () => [] });
            const variable: any = {
                dataBinding: {},
                getPrefabName: () => undefined,
                httpService: { getLocale: () => ({}) }
            };
            await expect(manager.invoke(variable, {}, jest.fn(), jest.fn())).rejects.toBeDefined();
        });

        it('resolves via variable.httpService.sendCall on a successful list invocation', async () => {
            stubMetadataForCrud([{ name: 'status', parameterType: 'QUERY' }]);
            const variable: any = {
                dataBinding: {},
                getPrefabName: () => undefined,
                notify: jest.fn(),
                httpService: {
                    sendCall: jest.fn().mockResolvedValue({
                        type: 'success',
                        status: 200,
                        body: JSON.stringify({ id: 1 })
                    })
                }
            };
            jest.useFakeTimers();
            // invoke()'s resolved value is the raw http response (successHandler does
            // `resolve(response)`); the processed data lands on variable.dataSet instead.
            const result: any = await manager.invoke(variable, { operation: 'list' }, jest.fn(), jest.fn());
            jest.runAllTimers();
            expect(variable.dataSet).toEqual({ id: 1 });
            expect(result.type).toBe('success');
            jest.useRealTimers();
        });

        it('rejects when the underlying http call fails', async () => {
            stubMetadataForCrud();
            const variable: any = {
                dataBinding: {},
                getPrefabName: () => undefined,
                onError: jest.fn(),
                notify: jest.fn(),
                httpService: {
                    sendCall: jest.fn().mockRejectedValue({ status: 500 }),
                    getLocale: () => ({})
                }
            };
            await expect(manager.invoke(variable, { operation: 'list' }, jest.fn(), jest.fn())).rejects.toBeDefined();
        });
    });
});
