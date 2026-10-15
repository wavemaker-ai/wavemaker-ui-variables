import { generateConnectionParams, parseConfig } from './live-variable.http.utils';

describe('live-variable.http.utils - remaining paths', () => {
    describe('parseConfig', () => {
        it('appends dynamic urls, overrides the method and merges headers', () => {
            const config = parseConfig({
                target: 'DATABASE',
                action: 'searchTableDataWithQuery',
                config: { url: '/prefix', method: 'PUT', headers: { 'X-Custom': '1' } },
                urlParams: { service: 'services', dataModelName: 'db', entityName: 'Emp', page: 2, size: 5, sort: 'sort=id' }
            });
            expect(config.url).toBe('/prefix/services/db/Emp/filter?page=2&size=5&sort=id');
            expect(config.method).toBe('PUT');
            expect(config.headers).toEqual(expect.objectContaining({ 'X-Custom': '1', 'Content-Type': 'application/x-www-form-urlencoded' }));
        });

        it('creates a header bag and keeps the default method for configs without them', () => {
            const config = parseConfig({
                target: 'DATABASE',
                action: 'readTableData',
                config: {},
                urlParams: { service: 'services', dataModelName: 'db', entityName: 'Emp', page: 1, size: 1, sort: '' }
            });
            expect(config.headers).toEqual({});
            expect(config.method).toBeDefined();
        });

        it('skips undefined and null url parameters', () => {
            const config = parseConfig({
                target: 'DATABASE',
                action: 'readTableData',
                urlParams: { service: undefined, dataModelName: null, entityName: 'Emp' }
            });
            expect(config.url).toContain(':service');
            expect(config.url).toContain(':dataModelName');
            expect(config.url).toContain('/Emp');
        });
    });

    describe('generateConnectionParams', () => {
        it('defaults the service to "services" and uses the supplied one otherwise', () => {
            const base = { projectID: 'p', dataModelName: 'db', entityName: 'Emp', page: 1, size: 5, sort: '', data: { a: 1 } };
            const defaulted = generateConnectionParams({ ...base }, 'readTableData');
            expect(defaulted.url).toContain('services/db/Emp');
            const custom = generateConnectionParams({ ...base, service: '' }, 'readTableData');
            expect(custom.url).not.toContain('services/db');
        });
    });
});
