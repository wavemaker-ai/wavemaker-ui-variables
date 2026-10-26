import { ServiceVariableUtils } from './service-variable.utils';
import { VARIABLE_CONSTANTS } from '../../constants/variables.constants';

describe('ServiceVariableUtils', () => {

    describe('isFileUploadRequest', () => {
        it('returns true for FileService uploadFile', () => {
            expect(ServiceVariableUtils.isFileUploadRequest({ service: 'FileService', operation: 'uploadFile' })).toBe(true);
        });

        it('returns false for any other service/operation', () => {
            expect(ServiceVariableUtils.isFileUploadRequest({ service: 'FileService', operation: 'deleteFile' })).toBe(false);
            expect(ServiceVariableUtils.isFileUploadRequest({ service: 'OtherService', operation: 'uploadFile' })).toBe(false);
        });
    });

    describe('isFileDeleteRequest', () => {
        it('returns true for FileService deleteFile', () => {
            expect(ServiceVariableUtils.isFileDeleteRequest({ service: 'FileService', operation: 'deleteFile' })).toBe(true);
        });

        it('returns false otherwise', () => {
            expect(ServiceVariableUtils.isFileDeleteRequest({ service: 'FileService', operation: 'uploadFile' })).toBe(false);
        });
    });

    describe('excludePaginationParams', () => {
        it('filters out page/size/sort param names and returns the remaining names', () => {
            const params = [
                { name: 'page' },
                { name: 'size' },
                { name: 'sort' },
                { name: 'search' },
                { name: 'status' }
            ];
            expect(ServiceVariableUtils.excludePaginationParams(params)).toEqual(['search', 'status']);
        });

        it('returns an empty array when all params are pagination params', () => {
            expect(ServiceVariableUtils.excludePaginationParams([{ name: 'page' }, { name: 'size' }])).toEqual([]);
        });
    });

    describe('constructRequestParams', () => {
        it('returns a user-unauthorized error when operationInfo is null', () => {
            const result: any = ServiceVariableUtils.constructRequestParams({}, null, {});
            expect(result.error.type).toBe(VARIABLE_CONSTANTS.REST_SERVICE.ERR_TYPE.USER_UNAUTHORISED);
        });

        it('returns a metadata-missing error when operationInfo is empty', () => {
            const result: any = ServiceVariableUtils.constructRequestParams({}, {}, {});
            expect(result.error.type).toBe(VARIABLE_CONSTANTS.REST_SERVICE.ERR_TYPE.METADATA_MISSING);
        });

        it('returns a crud-operation-missing error when operationInfo is invalid', () => {
            const result: any = ServiceVariableUtils.constructRequestParams({}, { invalid: true }, {});
            expect(result.error.type).toBe(VARIABLE_CONSTANTS.REST_SERVICE.ERR_TYPE.CRUD_OPERATION_MISSING);
        });

        it('returns a required-field-missing error when a required param has no value', () => {
            const operationInfo: any = {
                directPath: '/api/x',
                relativePath: '/api/x',
                httpMethod: 'GET',
                proxySettings: { web: false },
                parameters: [
                    { name: 'id', parameterType: 'QUERY', required: true }
                ]
            };
            const result: any = ServiceVariableUtils.constructRequestParams({}, operationInfo, {});
            expect(result.error.type).toBe(VARIABLE_CONSTANTS.REST_SERVICE.ERR_TYPE.REQUIRED_FIELD_MISSING);
            expect(result.error.field).toBe('id');
        });

        it('builds a direct-call GET request with a query param', () => {
            const operationInfo: any = {
                directPath: '/api/items',
                relativePath: '/api/items',
                httpMethod: 'GET',
                proxySettings: { web: false },
                parameters: [
                    { name: 'status', parameterType: 'QUERY', sampleValue: 'active' }
                ]
            };
            const result: any = ServiceVariableUtils.constructRequestParams({}, operationInfo, {});
            expect(result.method).toBe('GET');
            expect(result.isDirectCall).toBe(true);
            expect(result.url).toBe('/api/items?status=active');
        });

        it('replaces path params in the url', () => {
            const operationInfo: any = {
                directPath: '/api/items/{id}',
                relativePath: '/api/items/{id}',
                httpMethod: 'GET',
                proxySettings: { web: false },
                parameters: [
                    { name: 'id', parameterType: 'PATH', sampleValue: '42' }
                ]
            };
            const result: any = ServiceVariableUtils.constructRequestParams({}, operationInfo, {});
            expect(result.url).toBe('/api/items/42');
        });

        it('sets header params on the request headers', () => {
            const operationInfo: any = {
                directPath: '/api/items',
                relativePath: '/api/items',
                httpMethod: 'GET',
                proxySettings: { web: false },
                parameters: [
                    { name: 'X-Custom', parameterType: 'HEADER', sampleValue: 'abc' }
                ]
            };
            const result: any = ServiceVariableUtils.constructRequestParams({}, operationInfo, {});
            expect(result.headers['X-Custom']).toBe('abc');
        });

        it('sets the request body for a body param', () => {
            const operationInfo: any = {
                directPath: '/api/items',
                relativePath: '/api/items',
                httpMethod: 'POST',
                proxySettings: { web: false },
                parameters: [
                    { name: 'payload', parameterType: 'BODY', sampleValue: { a: 1 } }
                ]
            };
            const result: any = ServiceVariableUtils.constructRequestParams({}, operationInfo, {});
            expect(result.data).toEqual({ a: 1 });
            expect(result.headers['Content-Type']).toBe('application/json');
        });

        it('returns a no-accesstoken error for oauth2 secured operations without a token', () => {
            const operationInfo: any = {
                directPath: '/api/items',
                relativePath: '/api/items',
                httpMethod: 'GET',
                proxySettings: { web: false },
                securityDefinitions: [{ type: VARIABLE_CONSTANTS.REST_SERVICE.SECURITY_DEFN.OAUTH2 }],
                parameters: []
            };
            const result: any = ServiceVariableUtils.constructRequestParams({}, operationInfo, {});
            expect(result.error.type).toBe(VARIABLE_CONSTANTS.REST_SERVICE.ERR_TYPE.NO_ACCESSTOKEN);
        });

        it('returns a no-credentials error for basic-auth operations without username/password', () => {
            const operationInfo: any = {
                directPath: '/api/items',
                relativePath: '/api/items',
                httpMethod: 'GET',
                proxySettings: { web: false },
                securityDefinitions: [{ type: VARIABLE_CONSTANTS.REST_SERVICE.SECURITY_DEFN.BASIC }],
                parameters: []
            };
            const result: any = ServiceVariableUtils.constructRequestParams({}, operationInfo, {});
            expect(result.error.type).toBe(VARIABLE_CONSTANTS.REST_SERVICE.ERR_TYPE.NO_CREDENTIALS);
        });

        it('sets basic-auth header when username/password are provided', () => {
            const operationInfo: any = {
                directPath: '/api/items',
                relativePath: '/api/items',
                httpMethod: 'GET',
                proxySettings: { web: false },
                securityDefinitions: [{ type: VARIABLE_CONSTANTS.REST_SERVICE.SECURITY_DEFN.BASIC }],
                parameters: []
            };
            const result: any = ServiceVariableUtils.constructRequestParams({}, operationInfo, {
                wm_auth_username: 'user',
                wm_auth_password: 'pass'
            });
            expect(result.headers['Authorization']).toBe('Basic ' + btoa('user:pass'));
        });
    });
});
