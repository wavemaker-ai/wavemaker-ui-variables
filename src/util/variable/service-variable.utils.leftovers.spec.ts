import { $rootScope } from '../../constants/variables.constants';
import { ServiceVariableUtils } from './service-variable.utils';
import { wmSetDependency } from './variables.utils';

const build = (variable: any, operationInfo: any, inputFields: any = {}, options?: any) =>
    ServiceVariableUtils.constructRequestParams(variable, operationInfo, inputFields, options);

describe('ServiceVariableUtils.constructRequestParams - leftover branches', () => {
    const variable = (overrides: any = {}) => ({ getPrefabName: () => undefined, serviceType: 'RestService', ...overrides });
    const info = (overrides: any = {}) => ({
        directPath: 'http://host/api',
        relativePath: '/api',
        httpMethod: 'GET',
        proxySettings: { web: false },
        parameters: [],
        ...overrides
    });

    beforeEach(() => {
        jest.restoreAllMocks();
        ($rootScope as any).project = { id: 'p1', deployedUrl: 'http://host/' };
        wmSetDependency('appManager', { getPipe: () => ({ transform: (v: any) => v }) });
    });

    it('tolerates a missing variable when access is unauthorised', () => {
        expect(() => build(undefined, null)).not.toThrow();
    });

    it('applies default proxy settings when none exist and reads the method type', () => {
        const op = info({ proxySettings: undefined, httpMethod: undefined, methodType: 'POST', consumes: undefined });
        const req: any = build(variable(), op);
        expect(req.method).toBe('POST');
        expect(req.headers['Content-Type']).toBe('application/json');
    });

    it('reports required parameters by id when they have no name', () => {
        const op = info({ parameters: [{ id: 'p-id', parameterType: 'query', required: true }] });
        expect((build(variable(), op) as any).error.field).toBe('p-id');
    });

    it('treats a missing method as a body method for url encoded forms', () => {
        const op = info({
            httpMethod: undefined,
            methodType: undefined,
            consumes: ['application/x-www-form-urlencoded'],
            parameters: [{ name: 'q', parameterType: 'query', sampleValue: 'v', type: 'string' }]
        });
        const req: any = build(variable(), op);
        expect(req.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
        expect(req.data).toContain('q=v');
    });

    it('builds url encoded form bodies from form data parameters, appending to earlier ones', () => {
        const op = info({
            httpMethod: 'POST',
            consumes: ['application/x-www-form-urlencoded'],
            parameters: [
                { name: 'a', parameterType: 'formData', sampleValue: '1', type: 'string' },
                { name: 'b c', parameterType: 'formData', sampleValue: '2', type: 'string' }
            ]
        });
        expect((build(variable(), op) as any).data).toBe('a=1&b%20c=2');
    });

    it('builds multipart bodies for file and plain form data parameters', () => {
        const op = info({
            httpMethod: 'POST',
            consumes: ['multipart/form-data'],
            parameters: [
                { name: 'files', parameterType: 'formData', type: 'array', items: { type: 'file' }, sampleValue: [{ content: new Blob(['x']), name: 'a.txt' }, { name: 'b.txt' }] },
                { name: 'note', parameterType: 'formData', type: 'string', sampleValue: { k: 'v' } },
                { name: 'plain', parameterType: 'formData', type: 'string', sampleValue: 'text' },
                { name: 'single', parameterType: 'formData', type: 'file', sampleValue: new Blob(['y']) }
            ]
        });
        const req: any = build(variable(), op);
        expect(req.data).toBeInstanceOf(FormData);
    });

    it('lets the platform pick the content type for multipart requests', () => {
        const op = info({ httpMethod: 'POST', consumes: ['multipart/form-data'], parameters: [] });
        expect((build(variable(), op) as any).headers['Content-Type']).toBeUndefined();
    });
});
