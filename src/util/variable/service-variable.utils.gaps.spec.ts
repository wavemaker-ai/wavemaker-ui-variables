import { $rootScope } from '../../constants/variables.constants';
import { ServiceVariableUtils } from './service-variable.utils';
import { PaginationUtils } from './pagination.utils';
import { wmSetDependency } from './variables.utils';

const build = (variable: any, operationInfo: any, inputFields: any = {}, options?: any) =>
    ServiceVariableUtils.constructRequestParams(variable, operationInfo, inputFields, options);

describe('ServiceVariableUtils.constructRequestParams - remaining paths', () => {
    const variable = (overrides: any = {}) => ({
        getPrefabName: () => undefined,
        serviceType: 'RestService',
        dateFormatter: { format: (v: any) => `formatted-${v}` },
        ...overrides
    });
    const direct = (overrides: any = {}) => ({
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
        wmSetDependency('appManager', { getPipe: () => ({ transform: (v: any) => `formatted-${v}` }) });
    });

    describe('query parameters of query services', () => {
        const queryVariable = () => variable({ serviceType: 'DataService', controller: 'QueryExecution', operationType: 'get' });

        it('skips null values for query service variables', () => {
            const info = direct({ parameters: [{ name: 'id', parameterType: 'query', sampleValue: null, type: 'integer' }, { name: 'name', parameterType: 'query', sampleValue: 'x', type: 'string' }] });
            expect(build(queryVariable(), info).url).toBe('http://host/api?name=x');
        });

        it('keeps null values for other variables', () => {
            const info = direct({ parameters: [{ name: 'id', parameterType: 'query', sampleValue: 5, type: 'integer' }] });
            expect(build(variable(), info).url).toBe('http://host/api?id=5');
        });

        it('joins array values of string typed data service parameters', () => {
            const info = direct({ parameters: [{ name: 'ids', parameterType: 'query', sampleValue: ['a', 'b'], type: 'string' }] });
            expect(build(variable({ serviceType: 'DataService' }), info).url).toBe('http://host/api?ids=a%2Cb');
        });
    });

    describe('null query values of body type query/procedure variables', () => {
        const bodyQueryVariable = () => variable({ serviceType: 'DataService', controller: 'QueryExecution', operationType: 'post' });

        it('skips a null query parameter and null entries of multi value parameters', () => {
            const info = direct({
                httpMethod: 'POST',
                parameters: [
                    { name: 'nothing', parameterType: 'query', sampleValue: null, type: 'string' },
                    { name: 'tags', parameterType: 'query', collectionFormat: 'multi', sampleValue: [null, 1], type: 'integer' }
                ]
            });
            expect(build(bodyQueryVariable(), info, {}).url).toBe('http://host/api?tags=1');
        });

        it('keeps null multi value entries for other variables', () => {
            const info = direct({
                parameters: [{ name: 'tags', parameterType: 'query', collectionFormat: 'multi', sampleValue: [null, 'a'], type: 'string' }]
            });
            expect(build(variable(), info, {}).url).toContain('tags=');
        });
    });

    describe('request bodies', () => {
        it('encodes form url encoded bodies, appending further fields', () => {
            const info = direct({
                httpMethod: 'POST',
                consumes: ['application/x-www-form-urlencoded'],
                parameters: [
                    { name: 'a b', parameterType: 'formData', sampleValue: 'x&y', type: 'string' },
                    { name: 'c', parameterType: 'formData', sampleValue: 'z', type: 'string' }
                ]
            });
            expect(build(variable(), info).data).toBe('a%20b=x%26y&c=z');
        });

        it('builds query/procedure bodies without input fields (api designer)', () => {
            const info = direct({
                httpMethod: 'POST',
                parameters: [{ name: 'body', parameterType: 'body', sampleValue: { a: 1 }, type: 'object', children: [{ name: 'a', type: 'integer' }] }]
            });
            const v = variable({ serviceType: 'DataService', controller: 'QueryExecution', operationType: 'post' });
            expect(() => ServiceVariableUtils.constructRequestParams(v, info, null as any)).not.toThrow();
            const withFields = build(v, info, { body: { a: 1 } });
            expect(withFields).toBeDefined();
            const plain = build(v, direct({ httpMethod: 'POST', parameters: [{ name: 'body', parameterType: 'body', sampleValue: { a: 1 }, type: 'object' }] }), { a: 1 });
            expect(plain).toBeDefined();
        });
    });

    describe('pagination applied to the request', () => {
        it.each([
            ['headers', { headers: { h: 1 } }, (r: any) => expect(r.headers).toEqual(expect.objectContaining({ h: 1 }))],
            ['request body', { requestBody: 'rb' }, (r: any) => expect(r.data).toBe('rb')],
            ['url', { url: 'http://other' }, (r: any) => expect(r.url).toBe('http://other')]
        ])('takes the %s produced by the pagination utilities', (_n, response, check) => {
            jest.spyOn(PaginationUtils, 'getPaginationInfo').mockReturnValue({ type: 'page' } as any);
            jest.spyOn(PaginationUtils, 'setPaginationAtReq').mockReturnValue(response as any);
            check(build(variable({ pagination: { page: 1 } }), direct({ parameters: [] }), {}));
        });
    });
});
