import { ServiceVariableUtils } from './service-variable.utils';
import { PaginationUtils } from './pagination.utils';
import { LiveVariableUtils } from './live-variable.utils';
import { parseConfig } from './live-variable.http.utils';
import * as variablesUtils from './variables.utils';
import { wmSetDependency } from './variables.utils';
import { $rootScope } from '../../constants/variables.constants';
import { upload } from '../file-upload.util';

const build = (variable: any, operationInfo: any, inputFields: any = {}, options?: any) =>
    ServiceVariableUtils.constructRequestParams(variable, operationInfo, inputFields, options);

describe('final leftovers - service variable utils', () => {
    const variable = (overrides: any = {}) => ({ getPrefabName: () => undefined, serviceType: 'RestService', ...overrides });
    const info = (overrides: any = {}) => ({
        directPath: 'http://host/api',
        relativePath: '/api',
        httpMethod: 'POST',
        proxySettings: { web: false },
        parameters: [],
        ...overrides
    });

    beforeEach(() => {
        jest.restoreAllMocks();
        ($rootScope as any).project = { id: 'p1', deployedUrl: 'http://host/' };
        wmSetDependency('appManager', { getPipe: () => ({ transform: (v: any) => v }) });
    });

    it('skips form data when file upload is unsupported', () => {
        jest.spyOn(variablesUtils, 'isFileUploadSupported').mockReturnValue(false);
        const op = info({ consumes: ['multipart/form-data'], parameters: [{ name: 'f', parameterType: 'formData', type: 'string', sampleValue: 'x' }] });
        expect((build(variable(), op) as any).data).toBeUndefined();
    });

    it('reports missing body fields of query variables by id when they have no name', () => {
        const v = variable({ serviceType: 'DataService', controller: 'QueryExecution', operationType: 'post' });
        const op = info({
            definitions: { Body: [{ id: 'bid', required: true }] },
            parameters: [{ name: 'body', parameterType: 'body', type: 'Body', sampleValue: {} }]
        });
        const req: any = build(v, op, { body: {} });
        expect(req.error.field).toBe('bid');
    });

    it('uses the children of body parameters when there are no input fields (api designer)', () => {
        const v = variable({ serviceType: 'DataService', controller: 'QueryExecution', operationType: 'post' });
        const op = info({ parameters: [{ name: 'body', parameterType: 'body', type: 'Body', sampleValue: undefined, children: [{ name: 'a' }] }] });
        expect(() => build(v, op, null)).not.toThrow();
        const op2 = info({ parameters: [{ name: 'body', parameterType: 'body', type: 'Body', sampleValue: { a: 1 }, children: [{ name: 'a' }] }] });
        expect(() => build(v, op2, null)).not.toThrow();
    });

    it('keeps the plain url for proxied calls of prefab variables with unsupported service types', () => {
        const v = variable({ serviceType: 'Unknown', getPrefabName: () => 'pf' });
        const op = info({ proxySettings: { mobile: true } });
        expect((build(v, op) as any).url).toBe('http://host//api');
    });

    it('ignores empty pagination results', () => {
        jest.spyOn(PaginationUtils, 'getPaginationInfo').mockReturnValue({ type: 'page', input: {} } as any);
        jest.spyOn(PaginationUtils, 'setPaginationAtReq').mockReturnValue(undefined as any);
        const v = variable({ pagination: { size: 1 } });
        expect((build(v, info()) as any).url).toBe('http://host/api');
    });
});

describe('final leftovers - pagination utils', () => {
    beforeEach(() => jest.restoreAllMocks());

    it('throws for missing response headers', () => {
        expect(() => PaginationUtils.setPaginationItems('$header.x', {}, {}, 'k', undefined)).toThrow();
    });

    it('handles cursor size inputs that resolve to an empty parameter name', () => {
        const p: any = { name: 'limit', parameterType: 'path', sampleValue: 1 };
        const v: any = { pagination: { size: 3 }, _paginationConfig: { type: 'cursor', input: { size: '.x', page: 'c' } } };
        expect(() => PaginationUtils.checkPaginationAtQuery({ parameters: [p] }, v, { page: 1 })).not.toThrow();
        expect(p.sampleValue).toBe(1);
    });

    it('defaults the body page to 1 when options carry none', () => {
        const paramObj: any = { name: 'body', parameterType: 'body', sampleValue: { page: 1, size: 10 } };
        const info: any = { type: 'page', input: { page: 'page', size: 'body.size' } };
        const res: any = PaginationUtils.setPaginationAtReq(info, { parameters: [paramObj] }, { pagination: { size: 10 } }, {}, '', 'u', {});
        expect(JSON.parse(res.requestBody).page).toBe(1);
        const res2: any = PaginationUtils.setPaginationAtReq(info, { parameters: [paramObj] }, { pagination: { size: 10 } }, {}, '', 'u', { page: 4 });
        expect(JSON.parse(res2.requestBody).page).toBe(4);
    });

    it('keeps the size when the size parameter is not found', () => {
        const op: any = { parameters: [{ name: 'other', sampleValue: 5 }], paginationInfo: { type: 'page', input: { size: 'size' } } };
        const res: any = {};
        PaginationUtils.setParameterVal('size', res, op, {}, { size: 3 });
        expect(res.size).toBeUndefined();
    });

    it('reads the size parameter without options', () => {
        const op: any = { parameters: [{ name: 'size', sampleValue: 5 }], paginationInfo: { type: 'page', input: { size: 'size' } } };
        const res: any = {};
        PaginationUtils.setParameterVal('size', res, op, {});
        expect(res.size).toBe(5);
    });
});

describe('final leftovers - live variable utils', () => {
    const variable: any = { propertiesMap: { columns: [] }, dateFormatter: { format: (v: any) => v } };

    it('defaults empty filter conditions for date and string like fields', () => {
        const filterFields = [
            { fieldName: 'd', type: 'date', value: 1, filterCondition: 'exact' },
            { fieldName: 'd2', type: 'date', value: 1 },
            { fieldName: 'n', type: 'integer', value: 1 }
        ];
        expect(() => LiveVariableUtils.getFilterOptions(variable, filterFields as any, {})).not.toThrow();
    });

    it('does not override an explicit searchWithQuery flag', () => {
        const options: any = { searchWithQuery: false, filterFields: {} };
        LiveVariableUtils.prepareTableOptionsForFilterExps({ ...variable, filterExpressions: {} }, options, {});
        expect(options.searchWithQuery).toBe(false);
    });
});

describe('final leftovers - http utils and uploads', () => {
    it('ignores inherited url parameters', () => {
        const urlParams = Object.create({ inherited: 'x' });
        urlParams.service = 'services';
        const config = parseConfig({ target: 'DATABASE', action: 'readTableData', urlParams });
        expect(config.url).toContain('services');
        expect(config.url).toContain(':dataModelName');
    });

    it('appends non object files as is', async () => {
        const variable: any = { request: 'r', httpService: { uploadFile: jest.fn().mockResolvedValue('ok') } };
        const promise: any = upload('plain-string', variable, new FormData(), { url: '/u', fileParamName: 'file' });
        await new Promise<void>(resolve => promise.then(() => resolve(), () => resolve()));
        const fd: FormData = variable.httpService.uploadFile.mock.calls[0][1];
        expect(fd.has('file')).toBe(false);
    });
});
