import { LiveVariableUtils } from './live-variable.utils';
import { $rootScope } from '../../constants/variables.constants';

describe('LiveVariableUtils', () => {

    describe('isCompositeKey', () => {
        it('is true for no primary key', () => {
            expect(LiveVariableUtils.isCompositeKey(undefined)).toBe(true);
        });
        it('is true for an empty array', () => {
            expect(LiveVariableUtils.isCompositeKey([])).toBe(true);
        });
        it('is true for more than one primary key', () => {
            expect(LiveVariableUtils.isCompositeKey(['a', 'b'])).toBe(true);
        });
        it('is false for exactly one primary key', () => {
            expect(LiveVariableUtils.isCompositeKey(['id'])).toBe(false);
        });
    });

    describe('isNoPrimaryKey', () => {
        it('is true when there is no primary key', () => {
            expect(LiveVariableUtils.isNoPrimaryKey(undefined)).toBe(true);
            expect(LiveVariableUtils.isNoPrimaryKey([])).toBe(true);
        });
        it('is false when a primary key exists', () => {
            expect(LiveVariableUtils.isNoPrimaryKey(['id'])).toBe(false);
        });
    });

    describe('getCompositeIDURL', () => {
        it('joins key=value pairs with & and encodes values', () => {
            expect(LiveVariableUtils.getCompositeIDURL({ a: '1', b: 'x y' })).toBe('a=1&b=x%20y');
        });
        it('returns an empty string for no keys', () => {
            expect(LiveVariableUtils.getCompositeIDURL({})).toBe('');
        });
    });

    describe('hasBlob', () => {
        it('returns the blob column when present', () => {
            const variable = { propertiesMap: { columns: [{ fieldName: 'a', type: 'string' }, { fieldName: 'doc', type: 'blob' }] } };
            expect(LiveVariableUtils.hasBlob(variable)).toEqual({ fieldName: 'doc', type: 'blob' });
        });
        it('returns undefined when there is no blob column', () => {
            const variable = { propertiesMap: { columns: [{ fieldName: 'a', type: 'string' }] } };
            expect(LiveVariableUtils.hasBlob(variable)).toBeUndefined();
        });
    });

    describe('getPrimaryKey', () => {
        it('returns an empty array when there is no propertiesMap', () => {
            expect(LiveVariableUtils.getPrimaryKey({})).toEqual([]);
        });
        it('returns primaryFields directly when present', () => {
            const variable = { propertiesMap: { primaryFields: ['id'] } };
            expect(LiveVariableUtils.getPrimaryKey(variable)).toEqual(['id']);
        });
        it('derives primary key field names from columns when primaryFields is absent', () => {
            const variable = {
                propertiesMap: {
                    columns: [
                        { fieldName: 'id', isPrimaryKey: true },
                        { fieldName: 'name', isPrimaryKey: false }
                    ]
                }
            };
            expect(LiveVariableUtils.getPrimaryKey(variable)).toEqual(['id']);
        });
        it('uses the related field name for a related primary key column', () => {
            const variable = {
                propertiesMap: {
                    columns: [{ fieldName: 'dept', isPrimaryKey: true, isRelated: true, relatedFieldName: 'deptId' }]
                }
            };
            expect(LiveVariableUtils.getPrimaryKey(variable)).toEqual(['deptId']);
        });
        it('does not add duplicate field names to the primary key list', () => {
            const variable = {
                propertiesMap: {
                    columns: [
                        { fieldName: 'id', isPrimaryKey: true },
                        { fieldName: 'id', isPrimaryKey: true }
                    ]
                }
            };
            expect(LiveVariableUtils.getPrimaryKey(variable)).toEqual(['id']);
        });
    });

    describe('processBlobColumns', () => {
        const originalDeployedUrl = $rootScope.project.deployedUrl;
        afterEach(() => { $rootScope.project.deployedUrl = originalDeployedUrl; });

        it('does nothing for a falsy response', () => {
            expect(() => LiveVariableUtils.processBlobColumns(null, {})).not.toThrow();
        });

        it('does nothing when there are no blob columns', () => {
            const data = [{ id: 1 }];
            LiveVariableUtils.processBlobColumns(data, { propertiesMap: { columns: [] } });
            expect(data).toEqual([{ id: 1 }]);
        });

        it('builds a blob content url for a single (non-composite) primary key', () => {
            $rootScope.project.deployedUrl = 'http://x/';
            const variable = {
                _prefabName: '',
                liveSource: 'db1',
                type: 'Employee',
                propertiesMap: {
                    columns: [{ fieldName: 'photo', type: 'blob' }],
                    primaryFields: ['id']
                }
            };
            const data = [{ id: 5, photo: '' }];
            LiveVariableUtils.processBlobColumns(data, variable);
            expect(data[0].photo).toBe('services/db1/Employee/5/content/photo');
        });

        it('builds a composite-id blob content url when there are multiple primary keys', () => {
            const variable = {
                _prefabName: '',
                liveSource: 'db1',
                type: 'Employee',
                propertiesMap: {
                    columns: [{ fieldName: 'photo', type: 'blob' }],
                    primaryFields: ['id', 'orgId']
                }
            };
            const data = [{ id: 5, orgId: 9, photo: '' }];
            LiveVariableUtils.processBlobColumns(data, variable);
            expect(data[0].photo).toBe('services/db1/Employee/composite-id/content/photo?id=5&orgId=9');
        });

        it('skips a row whose blob value is already non-empty', () => {
            const variable = {
                _prefabName: '',
                liveSource: 'db1',
                type: 'Employee',
                propertiesMap: { columns: [{ fieldName: 'photo', type: 'blob' }], primaryFields: ['id'] }
            };
            const data = [{ id: 5, photo: 'already-set' }];
            LiveVariableUtils.processBlobColumns(data, variable);
            expect(data[0].photo).toBe('already-set');
        });
    });

    describe('getHibernateOrSqlType / getSqlType', () => {
        it('returns the type for a plain field', () => {
            const variable = { propertiesMap: { columns: [{ fieldName: 'age', type: 'integer' }] } };
            expect(LiveVariableUtils.getSqlType(variable, 'age')).toBe('integer');
        });

        it('resolves a related field via dotted fieldName', () => {
            const variable = {
                propertiesMap: {
                    columns: [{ fieldName: 'dept', columns: [{ fieldName: 'name', type: 'string' }] }]
                }
            };
            expect(LiveVariableUtils.getSqlType(variable, 'dept.name')).toBe('string');
        });

        it('returns undefined for a dotted fieldName with more than 2 parts', () => {
            const variable = { propertiesMap: { columns: [] } };
            expect(LiveVariableUtils.getSqlType(variable, 'a.b.c')).toBeUndefined();
        });

        it('falls back to relatedColumnName matching', () => {
            const variable = { propertiesMap: { columns: [{ fieldName: 'x', relatedColumnName: 'age', type: 'integer' }] } };
            expect(LiveVariableUtils.getSqlType(variable, 'age')).toBe('integer');
        });

        it('searches inside a matching related entity when no direct column matches', () => {
            const variable = {
                propertiesMap: {
                    columns: [{ fieldName: 'dept', relatedEntityName: 'Department', columns: [{ fieldName: 'age', type: 'integer' }] }]
                }
            };
            expect(LiveVariableUtils.getSqlType(variable, 'age', 'Department')).toBe('integer');
        });
    });

    describe('isRelatedFieldMany', () => {
        it('returns false when the field exists directly on the variable', () => {
            const variable = { propertiesMap: { columns: [{ fieldName: 'name' }] } };
            expect(LiveVariableUtils.isRelatedFieldMany(variable, 'name')).toBe(false);
        });

        it('returns true when the field is not found directly', () => {
            const variable = { propertiesMap: { columns: [{ fieldName: 'name' }] } };
            expect(LiveVariableUtils.isRelatedFieldMany(variable, 'dept')).toBe(true);
        });
    });

    describe('isStringType', () => {
        it('is true for text/string (any case)', () => {
            expect(LiveVariableUtils.isStringType('STRING')).toBe(true);
            expect(LiveVariableUtils.isStringType('text')).toBe(true);
        });
        it('is false for other types', () => {
            expect(LiveVariableUtils.isStringType('integer')).toBe(false);
        });
    });

    describe('getSQLFieldType', () => {
        it('returns the option type directly for date/time types', () => {
            const variable = { propertiesMap: { columns: [] } };
            expect(LiveVariableUtils.getSQLFieldType(variable, { type: 'timestamp', fieldName: 'x' })).toBe('timestamp');
        });
        it('falls back to the sql type from the variable metadata', () => {
            const variable = { propertiesMap: { columns: [{ fieldName: 'age', type: 'integer' }] } };
            expect(LiveVariableUtils.getSQLFieldType(variable, { type: 'string', fieldName: 'age' })).toBe('integer');
        });
        it('falls back to options.type when no metadata match exists', () => {
            const variable = { propertiesMap: { columns: [] } };
            expect(LiveVariableUtils.getSQLFieldType(variable, { type: 'string', fieldName: 'missing' })).toBe('string');
        });
    });

    describe('getAttributeName', () => {
        it('returns the fieldName unchanged when not related', () => {
            const variable = { propertiesMap: { columns: [{ fieldName: 'name' }] } };
            expect(LiveVariableUtils.getAttributeName(variable, 'name')).toBe('name');
        });
        it('returns the relatedFieldName for a related column', () => {
            const variable = { propertiesMap: { columns: [{ fieldName: 'dept', isRelated: true, relatedFieldName: 'deptId' }] } };
            expect(LiveVariableUtils.getAttributeName(variable, 'dept')).toBe('deptId');
        });
    });

    describe('getFilterCondition', () => {
        it('returns range match modes unchanged', () => {
            expect(LiveVariableUtils.getFilterCondition('BETWEEN')).toBe('BETWEEN');
        });
        it('defaults to EQUALS for a non-range match mode', () => {
            expect(LiveVariableUtils.getFilterCondition('LIKE')).toBe('EQUALS');
        });
    });

    describe('getFilterOption', () => {
        const variable = { propertiesMap: { columns: [{ fieldName: 'age', type: 'integer' }] } };

        it('splits an object value into first-level dotted key=value entries', () => {
            const result = LiveVariableUtils.getFilterOption(variable, {
                fieldName: 'address', value: { city: 'NYC', zip: '10001' }
            }, {});
            expect(result).toEqual(expect.arrayContaining(['address.city=NYC', 'address.zip=10001']));
        });

        it('builds an empty-match filter option for null/empty match modes', () => {
            const result: any = LiveVariableUtils.getFilterOption(variable, {
                fieldName: 'age', matchMode: 'null', value: ''
            }, {});
            expect(result.filterCondition).toBe('NULL');
            expect(result.attributeValue).toBe('');
        });

        it('converts empty match mode to a null-equivalent for a non-string field', () => {
            const result: any = LiveVariableUtils.getFilterOption(variable, {
                fieldName: 'age', matchMode: 'empty', value: ''
            }, {});
            expect(result.filterCondition).toBe('NULL');
        });

        it('parses an integer field value and defaults filterCondition to EQUALS', () => {
            const result: any = LiveVariableUtils.getFilterOption(variable, {
                fieldName: 'age', value: '25'
            }, {});
            expect(result.attributeValue).toBe(25);
            expect(result.filterCondition).toBe('EQUALS');
        });

        it('defaults a string field to anywhereignorecase', () => {
            const variable2 = { propertiesMap: { columns: [{ fieldName: 'name', type: 'string' }] } };
            const result: any = LiveVariableUtils.getFilterOption(variable2, { fieldName: 'name', value: 'wm' }, {});
            expect(result.filterCondition).toBe('CONTAINING_IGNORECASE');
        });

        it('returns undefined for an undefined/empty field value with a non-empty match mode', () => {
            const result = LiveVariableUtils.getFilterOption(variable, { fieldName: 'age', value: '' }, {});
            expect(result).toBeUndefined();
        });
    });

    describe('getFilterOptions', () => {
        it('flattens filter fields into a list of filter options', () => {
            const variable = { propertiesMap: { columns: [{ fieldName: 'age', type: 'integer' }] } };
            const result = LiveVariableUtils.getFilterOptions(variable, [{ fieldName: 'age', value: '25' }], {});
            expect(result).toHaveLength(1);
            expect((result[0] as any).attributeValue).toBe(25);
        });

        it('skips nil filter options', () => {
            const variable = { propertiesMap: { columns: [] } };
            const result = LiveVariableUtils.getFilterOptions(variable, [{ fieldName: 'age', value: '' }], {});
            expect(result).toEqual([]);
        });
    });

    describe('wrapInLowerCase', () => {
        it('wraps the value in lower() for string types with ignoreCase and a string match mode', () => {
            expect(LiveVariableUtils.wrapInLowerCase("'wm'", { attributeType: 'string', filterCondition: 'LIKE' }, true)).toBe("lower('wm')");
        });
        it('leaves the value unchanged when ignoreCase is false', () => {
            expect(LiveVariableUtils.wrapInLowerCase("'wm'", { attributeType: 'string', filterCondition: 'LIKE' }, false)).toBe("'wm'");
        });
        it('leaves the value unchanged for a non-string-mode match mode', () => {
            expect(LiveVariableUtils.wrapInLowerCase("5", { attributeType: 'integer', filterCondition: 'EQUALS' }, true)).toBe('5');
        });
    });

    describe('encodeAndAddQuotes', () => {
        it('encodes and quotes a string value', () => {
            expect(LiveVariableUtils.encodeAndAddQuotes('a b', 'string', false)).toBe("'a%20b'");
        });
        it('skips encoding when skipEncode is true', () => {
            expect(LiveVariableUtils.encodeAndAddQuotes('a b', 'string', true)).toBe("'a b'");
        });
        it('does not quote numeric types other than float', () => {
            expect(LiveVariableUtils.encodeAndAddQuotes('5', 'integer', true)).toBe('5');
        });
        it('quotes float values', () => {
            expect(LiveVariableUtils.encodeAndAddQuotes('5.5', 'float', true)).toBe("'5.5'");
        });
        it('escapes single quotes by doubling them', () => {
            expect(LiveVariableUtils.encodeAndAddQuotes("o'brien", 'string', true)).toBe("'o''brien'");
        });
    });

    describe('getParamValue', () => {
        it('returns an empty string for an empty match mode', () => {
            expect(LiveVariableUtils.getParamValue('', { filterCondition: 'NULL', attributeType: 'string' }, false, true)).toBe('');
        });
        it('builds a startswith % pattern', () => {
            expect(LiveVariableUtils.getParamValue('wm', { filterCondition: 'STARTING_WITH', attributeType: 'string' }, false, true)).toBe("'wm%'");
        });
        it('builds a between clause joined with and', () => {
            expect(LiveVariableUtils.getParamValue([1, 5], { filterCondition: 'BETWEEN', attributeType: 'integer' }, false, true)).toBe('1 and 5');
        });
        it('builds an in clause wrapped in parens', () => {
            expect(LiveVariableUtils.getParamValue(['a', 'b'], { filterCondition: 'IN', attributeType: 'string' }, false, true)).toBe("('a', 'b')");
        });
        it('defaults to an exact-match encoded value', () => {
            expect(LiveVariableUtils.getParamValue('wm', { filterCondition: 'EQUALS', attributeType: 'string' }, false, true)).toBe("'wm'");
        });
    });

    describe('getSearchQuery', () => {
        it('builds a query string joined by the given operator', () => {
            const filterOptions = [
                { attributeName: 'name', attributeValue: 'wm', filterCondition: 'EQUALS', attributeType: 'STRING' },
                { attributeName: 'age', attributeValue: 25, filterCondition: 'EQUALS', attributeType: 'INTEGER' }
            ];
            const query = LiveVariableUtils.getSearchQuery(filterOptions, ' AND ', false, true);
            expect(query).toBe("name='wm' AND age=25");
        });

        it('skips a field whose array value is empty', () => {
            const filterOptions = [{ attributeName: 'tags', attributeValue: [], filterCondition: 'IN', attributeType: 'STRING' }];
            expect(LiveVariableUtils.getSearchQuery(filterOptions, ' AND ', false, true)).toBe('');
        });

        it('switches non-between/notin array filters to an "in" query', () => {
            const filterOptions: any = [{ attributeName: 'id', attributeValue: [1, 2], filterCondition: 'EQUALS', attributeType: 'INTEGER' }];
            const query = LiveVariableUtils.getSearchQuery(filterOptions, ' AND ', false, true);
            expect(query).toBe('id in (1, 2)');
        });
    });

    describe('processFilterFields', () => {
        it('removes rules whose value is a live binding expression', () => {
            const rules: any = [{ target: 'name', value: 'bind:Widgets.x.value', matchMode: 'exact' }];
            LiveVariableUtils.processFilterFields(rules, { propertiesMap: { columns: [] } }, {});
            expect(rules).toEqual([]);
        });

        it('resolves a plain rule into a filter option', () => {
            const rules: any = [{ target: 'age', value: '25', matchMode: 'exact' }];
            LiveVariableUtils.processFilterFields(rules, { propertiesMap: { columns: [{ fieldName: 'age', type: 'integer' }] } }, {});
            expect(rules[0].attributeValue).toBe(25);
        });

        it('splits a comma separated string into an array for "in" match mode', () => {
            const rules: any = [{ target: 'status', value: 'A,B', matchMode: 'in' }];
            LiveVariableUtils.processFilterFields(rules, { propertiesMap: { columns: [] } }, {});
            expect(rules[0].attributeValue).toEqual(['A', 'B']);
        });

        it('recurses into nested rule groups', () => {
            const rules: any = [{ rules: [{ target: 'age', value: '25', matchMode: 'exact' }] }];
            LiveVariableUtils.processFilterFields(rules, { propertiesMap: { columns: [{ fieldName: 'age', type: 'integer' }] } }, {});
            expect(rules[0].rules[0].attributeValue).toBe(25);
        });
    });

    describe('getIgnoreCase', () => {
        it('is false for a case-sensitive match mode', () => {
            expect(LiveVariableUtils.getIgnoreCase('EQUALS', true)).toBe(false);
        });
        it('is true for an ignorecase match mode', () => {
            expect(LiveVariableUtils.getIgnoreCase('EQUALS_IGNORECASE', false)).toBe(true);
        });
        it('falls back to the variable-level ignoreCase flag otherwise', () => {
            expect(LiveVariableUtils.getIgnoreCase('BETWEEN', true)).toBe(true);
        });
    });

    describe('generateSearchQuery', () => {
        it('builds a flat query from simple rules', () => {
            const rules: any = [
                { attributeName: 'name', attributeValue: 'wm', filterCondition: 'EQUALS', attributeType: 'STRING' }
            ];
            expect(LiveVariableUtils.generateSearchQuery(rules, 'AND', false, true)).toBe("name='wm'");
        });

        it('wraps nested rule groups in parentheses', () => {
            const rules: any = [{
                condition: 'OR',
                rules: [
                    { attributeName: 'name', attributeValue: 'a', filterCondition: 'EQUALS', attributeType: 'STRING' },
                    { attributeName: 'name', attributeValue: 'b', filterCondition: 'EQUALS', attributeType: 'STRING' }
                ]
            }];
            expect(LiveVariableUtils.generateSearchQuery(rules, 'AND', false, true)).toBe("(name='a' OR name='b')");
        });
    });

    describe('getFieldType', () => {
        it('returns the type of a matching column', () => {
            const variable = { propertiesMap: { columns: [{ fieldName: 'age', type: 'integer' }] } };
            expect(LiveVariableUtils.getFieldType('age', variable)).toBe('integer');
        });
        it('returns undefined when there is no propertiesMap', () => {
            expect(LiveVariableUtils.getFieldType('age', {})).toBeUndefined();
        });
        it('resolves a related column type', () => {
            const variable = {
                propertiesMap: { columns: [{ fieldName: 'dept', columns: [{ fieldName: 'name', type: 'string' }] }] }
            };
            expect(LiveVariableUtils.getFieldType('dept', variable, 'name')).toBe('string');
        });
    });

    describe('prepareFormData', () => {
        it('appends non-blob fields as-is and blob fields as files, clearing them from rowObject', () => {
            const variable = { propertiesMap: { columns: [{ fieldName: 'photo', type: 'blob' }, { fieldName: 'name', type: 'string' }] } };
            const file = new File(['x'], 'a.png');
            const rowObject: any = { name: 'wm', photo: file };
            const formData: any = LiveVariableUtils.prepareFormData(variable, rowObject);
            expect(formData).toBeInstanceOf(FormData);
            expect(rowObject.photo).toBe('');
        });

        it('sets the blob field to null when the value was explicitly null', () => {
            const variable = { propertiesMap: { columns: [{ fieldName: 'photo', type: 'blob' }] } };
            const rowObject: any = { photo: null };
            LiveVariableUtils.prepareFormData(variable, rowObject);
            expect(rowObject.photo).toBeNull();
        });
    });

    describe('traverseFilterExpressions', () => {
        it('invokes the callback for each leaf rule', () => {
            const cb = jest.fn();
            const filterExpressions = {
                rules: [
                    { target: 'a', value: 1 },
                    { rules: [{ target: 'b', value: 2 }] }
                ]
            };
            LiveVariableUtils.traverseFilterExpressions(filterExpressions, cb);
            expect(cb).toHaveBeenCalledTimes(2);
        });

        it('does nothing when there are no rules', () => {
            const cb = jest.fn();
            LiveVariableUtils.traverseFilterExpressions({}, cb);
            expect(cb).not.toHaveBeenCalled();
        });
    });

    describe('getFilterExprFields', () => {
        it('returns the filterExpressions unchanged when nothing is missing', () => {
            const fe = { rules: [{ target: 'a', required: true, value: 'x', matchMode: 'exact' }] };
            expect(LiveVariableUtils.getFilterExprFields(fe)).toBe(fe);
        });
        it('returns false when a required field is empty', () => {
            const fe = { rules: [{ target: 'a', required: true, value: '', matchMode: 'exact' }] };
            expect(LiveVariableUtils.getFilterExprFields(fe)).toBe(false);
        });
    });

    describe('prepareTableOptions / prepareTableOptionsForFilterExps', () => {
        it('builds a query from variable.filterExpressions for a read operation', () => {
            const variable: any = {
                operation: 'read',
                filterExpressions: { condition: 'AND', rules: [{ target: 'age', value: '25', matchMode: 'exact' }] },
                propertiesMap: { columns: [{ fieldName: 'age', type: 'integer' }] }
            };
            const result = LiveVariableUtils.prepareTableOptions(variable, {});
            expect(result.query).toBe('age=25');
        });

        it('builds a query from variable.filterFields for a non-read operation', () => {
            const variable: any = {
                operation: 'insert',
                filterFields: { age: { value: '25', matchMode: 'exact' } },
                propertiesMap: { columns: [{ fieldName: 'age', type: 'integer' }] }
            };
            const result = LiveVariableUtils.prepareTableOptions(variable, { operation: 'read' });
            expect(result.query).toBe('age=25');
        });

        it('merges options.filterFields with an OR default logical operator', () => {
            const variable: any = {
                operation: 'insert',
                filterFields: {},
                propertiesMap: { columns: [{ fieldName: 'name', type: 'string' }] }
            };
            const result = LiveVariableUtils.prepareTableOptions(variable, {
                operation: 'read',
                filterFields: { name: { value: 'wm', matchMode: 'exact' } }
            });
            expect(result.query).toBe("name='wm'");
        });
    });

    describe('getWhereClauseGenerator', () => {
        it('returns a function that produces the query for the current filterExpressions', () => {
            const variable: any = {
                operation: 'read',
                filterExpressions: { condition: 'AND', rules: [{ target: 'age', value: '25', matchMode: 'exact' }] },
                propertiesMap: { columns: [{ fieldName: 'age', type: 'integer' }] }
            };
            const generator = LiveVariableUtils.getWhereClauseGenerator(variable, {});
            expect(generator()).toBe('age=25');
        });

        it('applies the modifier function to the cloned filter fields before building the query', () => {
            const variable: any = {
                operation: 'read',
                filterExpressions: { condition: 'AND', rules: [] },
                propertiesMap: { columns: [{ fieldName: 'age', type: 'integer' }] }
            };
            const generator = LiveVariableUtils.getWhereClauseGenerator(variable, {});
            const query = generator((clonedFields: any) => {
                clonedFields.rules.push({ target: 'age', value: '30', matchMode: 'exact' });
            });
            expect(query).toBe('age=30');
        });
    });
});
