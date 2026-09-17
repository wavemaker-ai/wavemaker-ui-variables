import { parseConfig, generateConnectionParams, LVService } from './live-variable.http.utils';
import { wmSetDependency } from './variables.utils';

describe('live-variable.http.utils', () => {

    describe('parseConfig', () => {
        it('returns null for an unknown target/action combination', () => {
            expect(parseConfig({ target: 'UNKNOWN', action: 'x' })).toBeNull();
        });

        it('builds config from the matching VARIABLE_URLS entry', () => {
            const config = parseConfig({ target: 'DATABASE', action: 'readTableData' });
            expect(config.method).toBe('GET');
            expect(config.url).toContain(':entityName');
        });

        it('prefixes the url and overrides the method from serviceParams.config', () => {
            const config = parseConfig({
                target: 'DATABASE', action: 'readTableData',
                config: { url: 'http://host', method: 'PUT', headers: { 'X-A': '1' } }
            });
            expect(config.url.startsWith('http://host')).toBe(true);
            expect(config.method).toBe('PUT');
            expect(config.headers['X-A']).toBe('1');
        });

        it('replaces :param placeholders in the url from urlParams', () => {
            const config = parseConfig({
                target: 'DATABASE', action: 'readTableData',
                urlParams: { service: 'services', dataModelName: 'db1', entityName: 'Employee', page: 1, size: 20, sort: '' }
            });
            expect(config.url).not.toContain(':entityName');
            expect(config.url).toContain('Employee');
        });

        it('skips undefined/null urlParams values', () => {
            const config = parseConfig({
                target: 'DATABASE', action: 'readTableData',
                urlParams: { entityName: undefined }
            });
            expect(config.url).toContain(':entityName');
        });

        it('sets data, dataParams, headers, and extra config flags', () => {
            const config = parseConfig({
                target: 'DATABASE', action: 'insertTableData',
                data: { a: 1 },
                dataParams: { b: 2 },
                headers: { 'X-B': '2' },
                byPassResult: true,
                isDirectCall: true,
                isExtURL: false,
                preventMultiple: true,
                responseType: 'json'
            });
            expect(config.data).toEqual({ a: 1, params: { b: 2 } });
            expect(config.headers).toEqual({ 'X-B': '2' });
            expect(config.byPassResult).toBe(true);
            expect(config.isDirectCall).toBe(true);
            expect(config.preventMultiple).toBe(true);
            expect(config.responseType).toBe('json');
        });

        it('sets config.params when serviceParams.params is provided', () => {
            const config = parseConfig({
                target: 'DATABASE', action: 'readTableData',
                params: { q: 'x' }
            });
            expect(config.params).toEqual({ q: 'x' });
        });
    });

    describe('generateConnectionParams', () => {
        it('builds connection params with a cleaned-up url', () => {
            const result = generateConnectionParams({
                projectID: 'p1', dataModelName: 'db1', entityName: 'Employee',
                page: 1, size: 20, sort: '', url: 'http://host//'
            }, 'readTableData');
            expect(result.url.startsWith('http://host/')).toBe(true);
            expect(result.url).not.toContain('//services');
        });

        it('defaults service to "services" when not provided', () => {
            const result = generateConnectionParams({ url: 'http://host', entityName: 'E' }, 'readTableData');
            expect(result.url).toContain('services');
        });

        it('passes through explicit data', () => {
            const result = generateConnectionParams({ url: 'http://host', data: 'q=1', entityName: 'E' }, 'searchTableData');
            expect(result.data).toBe('q=1');
        });

        it('defaults data to an empty string when not provided', () => {
            const result = generateConnectionParams({ url: 'http://host', entityName: 'E' }, 'readTableData');
            expect(result.data).toBe('');
        });
    });

    describe('LVService (initiateAction, isStudioMode is always false)', () => {
        it('delegates to httpService.sendCallAsObservable with the generated connection params', () => {
            const sendCallAsObservable = jest.fn().mockReturnValue('observable');
            wmSetDependency('http', { sendCallAsObservable });
            const params: any = { url: 'http://host', entityName: 'Employee', dataModelName: 'db1' };
            const result = LVService.readTableData(params, jest.fn(), jest.fn());
            expect(sendCallAsObservable).toHaveBeenCalled();
            expect(result).toBe('observable');
            expect(params.operation).toBe('readTableData');
        });

        it('exportTableData and getDistinctDataByFields work without success/failure callbacks', () => {
            const sendCallAsObservable = jest.fn().mockReturnValue('observable');
            wmSetDependency('http', { sendCallAsObservable });
            const params: any = { url: 'http://host', entityName: 'Employee' };
            expect(LVService.exportTableData(params)).toBe('observable');
            expect(LVService.getDistinctDataByFields(params)).toBe('observable');
        });
    });
});
