import { $rootScope, CONSTANTS } from '../../constants/variables.constants';
import { getAccessToken } from './../oAuth.utils';
import { ServiceVariableUtils } from './service-variable.utils';
import { wmSetDependency as setDependency } from './variables.utils';

jest.mock('./../oAuth.utils', () => ({
    getAccessToken: jest.fn(),
}));

const build = (variable: any, operationInfo: any, inputFields: any = {}, options?: any) =>
    ServiceVariableUtils.constructRequestParams(variable, operationInfo, inputFields, options);

describe('ServiceVariableUtils.constructRequestParams - extra paths', () => {
    const variable = (overrides: any = {}) => ({
        getPrefabName: () => undefined,
        serviceType: 'RestService',
        dateFormatter: { format: (v: any) => `formatted-${v}` },
        ...overrides,
    });
    const direct = (overrides: any = {}) => ({
        directPath: 'http://host/api',
        relativePath: '/api',
        httpMethod: 'GET',
        proxySettings: { web: false },
        parameters: [],
        ...overrides,
    });

    beforeEach(() => {
        ($rootScope as any).project = { id: 'p1', deployedUrl: 'http://host/' };
        (getAccessToken as jest.Mock).mockReset();
        setDependency('appManager', { getPipe: () => ({ transform: (v: any) => `formatted-${v}` }) });
    });

    describe('security definitions', () => {
        it('sets a bearer header when the oauth access token exists', () => {
            (getAccessToken as jest.Mock).mockReturnValue('tok');
            const result = build(variable(), direct({ securityDefinitions: [{ type: 'oauth2', 'x-WM-PROVIDER_ID': 'google' }] }));
            expect(getAccessToken).toHaveBeenCalledWith('google', null);
            expect(result.headers.Authorization).toBe('Bearer tok');
        });

        it('returns an error with the definition when the oauth access token is missing', () => {
            (getAccessToken as jest.Mock).mockReturnValue(null);
            const definition = { type: 'oauth2', 'x-WM-PROVIDER_ID': 'google' };
            const result = build(variable(), direct({ securityDefinitions: [definition] }));
            expect(result.error.type).toBe('missing_accesstoken');
            expect(result.securityDefnObj).toBe(definition);
        });

        it('sets a basic auth header from the credential input fields', () => {
            const result = build(variable(), direct({ securityDefinitions: [{ type: 'basic' }] }), { wm_auth_username: 'u', wm_auth_password: 'p' });
            expect(result.headers.Authorization).toBe('Basic ' + btoa('u:p'));
            expect(result.authDetails).toEqual({ type: 'BASIC' });
        });

        it('returns an error when basic auth credentials are missing', () => {
            const result = build(variable(), direct({ securityDefinitions: [{ type: 'basic' }] }), { wm_auth_username: 'u' });
            expect(result.error.type).toBe('no_credentials');
        });
    });

    describe('query parameters', () => {
        const queryParam = (value: any, extra: any = {}) => direct({
            parameters: [{ name: 'tag', parameterType: 'query', sampleValue: value, ...extra }],
        });

        it('encodes the value', () => {
            expect(build(variable(), queryParam('a b&c')).url).toBe('http://host/api?tag=a%20b%26c');
        });

        it('joins array values with commas, encoding each element', () => {
            expect(build(variable(), queryParam(['a', 'b,c'])).url).toBe('http://host/api?tag=a,b%2Cc');
        });

        it('repeats the parameter for the multi collection format', () => {
            expect(build(variable(), queryParam(['a', 'b'], { collectionFormat: 'multi' })).url).toBe('http://host/api?tag=a&tag=b');
        });

        it('chains several query params with &', () => {
            const info = direct({
                parameters: [
                    { name: 'a', parameterType: 'query', sampleValue: '1' },
                    { name: 'b', parameterType: 'query', sampleValue: '2' },
                ],
            });
            expect(build(variable(), info).url).toBe('http://host/api?a=1&b=2');
        });

        it('skips null values for query service variables', () => {
            const queryVar = variable({ controller: 'QueryExecution', serviceType: 'DataService' });
            const info = direct({ parameters: [{ name: 'a', parameterType: 'query', sampleValue: null, required: false }] });
            expect(build(queryVar, info).url).toBe('http://host/api');
        });

        it('skips null elements of an array for query service variables', () => {
            const queryVar = variable({ controller: 'QueryExecution', serviceType: 'DataService' });
            const info = direct({ parameters: [{ name: 'a', parameterType: 'query', sampleValue: ['x'], collectionFormat: 'multi' }] });
            expect(build(queryVar, info).url).toBe('http://host/api?a=x');
        });

        it('formats date params and joins array string params for data services', () => {
            const dataVar = variable({ serviceType: 'DataService' });
            const info = direct({
                parameters: [
                    { name: 'names', parameterType: 'query', sampleValue: ['a', 'b'], type: 'string' },
                    { name: 'when', parameterType: 'query', sampleValue: 1700000000000, type: 'timestamp' },
                ],
            });
            const url = build(dataVar, info).url;
            expect(url).toContain('names=a%2Cb');
            expect(url).toContain('when=1700000000000');
        });
    });

    describe('request bodies', () => {
        it('defaults the content type to application/json for body methods', () => {
            const result = build(variable(), direct({ httpMethod: 'POST' }));
            expect(result.headers['Content-Type']).toBe('application/json');
        });

        it('uses the first consumes entry as the content type', () => {
            const result = build(variable(), direct({ httpMethod: 'POST', consumes: ['text/xml'] }));
            expect(result.headers['Content-Type']).toBe('text/xml');
        });

        it('leaves the content type to the browser for multipart requests', () => {
            const result = build(variable(), direct({ httpMethod: 'POST', consumes: ['multipart/form-data'] }));
            expect(result.headers['Content-Type']).toBeUndefined();
        });

        it('sends query params as the form body for urlencoded requests', () => {
            const info = direct({
                httpMethod: 'POST',
                consumes: ['application/x-www-form-urlencoded'],
                parameters: [{ name: 'a', parameterType: 'query', sampleValue: '1' }],
            });
            const result = build(variable(), info);
            expect(result.data).toBe('a=1');
            expect(result.url).toBe('http://host/api');
            expect(result.headers['Content-Type']).toBe('application/x-www-form-urlencoded');
        });

        it('appends query params to an existing urlencoded body', () => {
            const info = direct({
                httpMethod: 'POST',
                consumes: ['application/x-www-form-urlencoded'],
                parameters: [
                    { name: 'body', parameterType: 'body', sampleValue: 'x=1' },
                    { name: 'a', parameterType: 'query', sampleValue: '2' },
                ],
            });
            expect(build(variable(), info).data).toBe('x=1&a=2');
        });

        it('builds multipart form data for string and file values', () => {
            const file = new File(['abc'], 'a.txt');
            const info = direct({
                httpMethod: 'POST',
                consumes: ['multipart/form-data'],
                parameters: [
                    { name: 'title', parameterType: 'formdata', sampleValue: 'hello', type: 'string' },
                    { name: 'meta', parameterType: 'formdata', sampleValue: { a: 1 }, type: 'object' },
                    { name: 'files', parameterType: 'formdata', sampleValue: [{ content: file, name: 'a.txt' }], type: 'file' },
                    { name: 'single', parameterType: 'formdata', sampleValue: file, type: 'file' },
                ],
            });
            const data: FormData = build(variable(), info).data;
            expect(data.get('title')).toBe('hello');
            expect(data.get('meta')).toBe('{"a":1}');
            expect(data.getAll('files')).toHaveLength(1);
            expect(data.get('single')).not.toBeNull();
        });

        it('uses the x-WM-CONTENT_TYPE of the param in studio mode', () => {
            CONSTANTS.isStudioMode = true;
            try {
                const info = direct({
                    httpMethod: 'POST',
                    consumes: ['multipart/form-data'],
                    parameters: [{ name: 'doc', parameterType: 'formdata', sampleValue: 'text', type: 'string', 'x-WM-CONTENT_TYPE': 'text/plain' }],
                });
                const data: FormData = build(variable(), info).data;
                expect((data.get('doc') as File).type).toBe('text/plain');
            } finally {
                CONSTANTS.isStudioMode = false;
            }
        });
    });

    describe('query and procedure variables with a body', () => {
        const queryVar = variable({ controller: 'QueryExecution', serviceType: 'DataService', operationType: 'post' });
        const definitions = {
            QueryBody: [
                { name: 'id', type: 'integer', required: true },
                { name: 'tags', type: 'string' },
                { name: 'readonly', type: 'string', readOnly: true },
                { name: 'created', type: 'date' },
            ],
        };

        it('wraps the input fields into the request body, formatting values', () => {
            const info = direct({
                httpMethod: 'POST',
                definitions,
                parameters: [{ name: 'body', parameterType: 'body', type: 'QueryBody' }],
            });
            const result = build(queryVar, info, { id: 1, tags: ['a', 'b'], readonly: 'x', created: 1700000000000 });
            expect(result.data.id).toBe(1);
            expect(result.data.tags).toBe('a,b');
            expect(result.data.readonly).toBeUndefined();
            expect(result.data.created).toBeDefined();
        });

        it('prefers a nested input object that is named after the param', () => {
            const info = direct({
                httpMethod: 'POST',
                definitions,
                parameters: [{ name: 'body', parameterType: 'body', type: 'QueryBody' }],
            });
            const result = build(queryVar, info, { body: { id: 7 } });
            expect(result.data).toEqual({ id: 7 });
        });

        it('reports required body fields that are missing', () => {
            const info = direct({
                httpMethod: 'POST',
                definitions,
                parameters: [{ name: 'body', parameterType: 'body', type: 'QueryBody' }],
            });
            const result = build(queryVar, info, {});
            expect(result.error.type).toBe('required_field_missing');
            expect(result.error.field).toBe('id');
            expect(result.error.skipDefaultNotification).toBe(true);
        });

        it('processes the wm_data_json form data part like a body', () => {
            const info = direct({
                httpMethod: 'POST',
                consumes: ['multipart/form-data'],
                definitions,
                parameters: [{ name: 'wm_data_json', parameterType: 'formdata', type: 'QueryBody', contentType: 'application/json' }],
            });
            const result = build(queryVar, info, { id: 3 });
            expect(result.data).toBeInstanceOf(FormData);
            expect(result.data.get('wm_data_json')).not.toBeNull();
        });
    });

    describe('proxy calls', () => {
        const proxy = (overrides: any = {}) => ({
            relativePath: '/api',
            httpMethod: 'GET',
            proxySettings: { web: true, mobile: true, withCredentials: true },
            parameters: [{ name: 'X-Custom', parameterType: 'header', sampleValue: 'v' }, { name: 'Accept', parameterType: 'header', sampleValue: 'a' }],
            ...overrides,
        });

        it('cloaks headers of REST services except the well known ones', () => {
            const result = build(variable(), proxy());
            expect(result.headers).toEqual({ 'X-WM-X-Custom': 'v', Accept: 'a' });
            expect(result.withCredentials).toBe(true);
            expect(result.isExtURL).toBe(true);
        });

        it('keeps headers untouched for non rest services', () => {
            const result = build(variable({ serviceType: 'DataService' }), proxy());
            expect(result.headers['X-Custom']).toBe('v');
        });

        it('routes prefab variables through the prefab rest service', () => {
            const prefabVar = variable({ getPrefabName: () => 'mylib' });
            const result = build(prefabVar, proxy({ basePath: '/base', relativePath: '/api' }));
            expect(result.url).toBe('http://host/prefabs/mylib/base/api');
            expect(result.target).toBe('invokePrefabRestService');
        });
    });

    describe('pagination', () => {
        it('sends the page in a cloaked header when the pagination input is a header param', () => {
            const info = direct({
                paginationInfo: { input: { page: 'pageNo', size: 'pageSize' } },
                parameters: [{ name: 'pageNo', parameterType: 'header' }],
            });
            const result = build(variable({ pagination: { page: 2, size: 10 } }), info);
            expect(result.headers['X-WM-pageNo']).toBe(2);
        });

        it('sends the requested page in the body when the pagination input is a body param', () => {
            const info = direct({
                httpMethod: 'POST',
                paginationInfo: { input: { page: 'page', size: 'size' } },
                parameters: [{ name: 'body', parameterType: 'body', sampleValue: { page: 1, size: 1 } }],
            });
            const result = build(variable({ pagination: { page: 2, size: 25 } }), info, {}, { page: 3 });
            expect(JSON.parse(result.data).page).toBe(3);
        });

        it('adds the page query param when navigating beyond the first page', () => {
            const info = direct({
                paginationInfo: { input: { page: 'page', size: 'size' } },
                parameters: [
                    { name: 'page', parameterType: 'query', sampleValue: '1' },
                    { name: 'size', parameterType: 'query', sampleValue: '5' },
                ],
            });
            const v = variable({ pagination: { page: 2, size: 5 }, dataBinding: { page: 1 } });
            const result = build(v, info, {}, { page: 2 });
            expect(result.url).toContain('page=');
        });
    });
});
