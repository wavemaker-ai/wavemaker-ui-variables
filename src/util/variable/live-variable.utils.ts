import { hasCordova, getClonedObject, isDateTimeType, isDefined, replace, triggerFn, isNumberType } from "../../util/utils";
import { $rootScope, DB_CONSTANTS, SWAGGER_CONSTANTS } from '../../constants/variables.constants';
import { getEvaluatedOrderBy, formatDate } from './variables.utils';

// @ts-ignore
import moment from 'moment';
import {forEach, find, get, includes, map, filter, trim ,isEmpty, endsWith, join, toLower, isObject, isArray, toUpper, reduce, isString, each, isNil, remove, isNull, some ,indexOf, clone, replace as _replace, isNaN} from 'lodash-es';

export class LiveVariableUtils {

    static isCompositeKey(primaryKey) {
        return !primaryKey || (primaryKey && (!primaryKey.length || primaryKey.length > 1));
    }

    static isNoPrimaryKey(primaryKey) {
        return (!primaryKey || (primaryKey && !primaryKey.length));
    }

    // Generate the URL based on the primary keys and their values
    static getCompositeIDURL(primaryKeysData) {
        let compositeId = '';
        //  Loop over the 'compositeKeysData' and construct the 'compositeId'.
        forEach(primaryKeysData, (paramValue, paramName) => {
            compositeId += paramName + '=' + encodeURIComponent(paramValue) + '&';
        });
        compositeId = compositeId.slice(0, -1);
        return compositeId;
    }


    // Check if table has blob column
    static hasBlob(variable) {
        return find(get(variable, ['propertiesMap', 'columns']), {'type': 'blob'});
    }

    static getPrimaryKey(variable) {
        if (!variable.propertiesMap) {
            return [];
        }

        if (variable.propertiesMap.primaryFields) {
            return variable.propertiesMap.primaryFields;
        }
        /*Old projects do not have primary fields. Get primary key from the columns*/
        const primaryKey = [];
        /*Loop through the propertiesMap and get the primary key column.*/
        forEach(variable.propertiesMap.columns, (index, column) => {
            if (column.isPrimaryKey) {
                if (column.isRelated && (!includes(column.relatedFieldName, primaryKey))) {
                    primaryKey.push(column.relatedFieldName);
                } else if (!includes(column.fieldName, primaryKey)) {
                    primaryKey.push(column.fieldName);
                }
            }
        });
        return primaryKey;
    }

    //  Construct the URL for blob columns and set it in the data, so that widgets can use this
    static processBlobColumns(responseData, variable) {
        if (!responseData) {
            return;
        }
        const blobCols = map(filter(variable.propertiesMap.columns, {'type': 'blob'}), 'fieldName'),
            deployedUrl = trim($rootScope.project.deployedUrl);
        let href = '',
            primaryKeys;

        if (isEmpty(blobCols)) {
            return;
        }

        if (hasCordova()) {
            href += endsWith(deployedUrl, '/') ? deployedUrl : deployedUrl + '/';
        }
        href += ((variable._prefabName !== '' && variable._prefabName !== undefined) ? 'prefabs/' + variable._prefabName : 'services') + '/' + variable.liveSource + '/' + variable.type + '/';
        primaryKeys = variable.propertiesMap.primaryFields || variable.propertiesMap.primaryKeys;
        forEach(responseData, data => {
            if (data) {
                forEach(blobCols, col => {
                    const compositeKeysData = {};
                    if (data[col] === null || !isEmpty(trim(data[col]))) {
                        return;
                    }
                    if (LiveVariableUtils.isCompositeKey(primaryKeys)) {
                        primaryKeys.forEach(key => {
                            compositeKeysData[key] = data[key];
                        });
                        data[col] = href + 'composite-id/content/' + col + '?' + LiveVariableUtils.getCompositeIDURL(compositeKeysData);
                    } else {
                        data[col] = href + data[join(primaryKeys)] + '/content/' + col;
                    }
                });
            }
        });
    }

    static getHibernateOrSqlType(variable, fieldName, type, entityName?: string) {
        const columns = variable.propertiesMap.columns;
        let column,
            relatedCols,
            relatedCol,
            columnParts;
        if (includes(fieldName, '.')) {
            columnParts = fieldName.split('.');
            if (columnParts.length > 2) {
                return undefined;
            }
            column = find(columns, col => {
                return col.fieldName === columnParts[0];
            });
            relatedCols = column && column.columns;
            relatedCol = find(relatedCols, col => {
                return col.fieldName === columnParts[1];
            });
            return relatedCol && relatedCol[type];
        }
        column = find(columns, col => {
            return col.fieldName === fieldName || col.relatedColumnName === fieldName;
        });
        if (!column && entityName) {
            const entity = find(columns, col => col.relatedEntityName === entityName);
            column = find(entity.columns, col => {
                return col.fieldName === fieldName || col.relatedColumnName === fieldName;
            });
        }
        return column && column[type];
    }

    /*Function to get the sqlType of the specified field.*/
    static getSqlType(variable, fieldName, entityName?: string) {
        return LiveVariableUtils.getHibernateOrSqlType(variable, fieldName, 'type', entityName);
    }

    /*Function to check if the specified field has a one-to-many relation or not.*/
    static isRelatedFieldMany(variable, fieldName) {
        const columns = variable.propertiesMap.columns,
            columnsCount = columns.length;
        let index,
            column;
        /*Loop through the columns of the liveVariable*/
        for (index = 0; index < columnsCount; index += 1) {
            column = columns[index];
            /*If the specified field is found in the columns of the variable,
            * then it has a many-to-one relation.*/
            if (column.fieldName === fieldName) {
                return false;
            }
        }
        return true;
    }

    static isStringType(type) {
        return includes(['text', 'string'], toLower(type));
    }

    static getSQLFieldType(variable, options) {
        if (includes(['timestamp', 'datetime', 'date'], options.type)) {
            return options.type;
        }
        return LiveVariableUtils.getSqlType(variable, options.fieldName) || options.type;
    }

    static getAttributeName(variable, fieldName) {
        let attrName = fieldName;
        variable.propertiesMap.columns.forEach(column => {
            if (column.fieldName === fieldName && column.isRelated) {
                attrName = column.relatedFieldName;
            }
        });
        return attrName;
    }

    static getFilterCondition(filterCondition) {
        if (includes(DB_CONSTANTS.DATABASE_RANGE_MATCH_MODES, filterCondition)) {
            return filterCondition;
        }
        return DB_CONSTANTS.DATABASE_MATCH_MODES['exact'];
    }

    static getFilterOption(variable, fieldOptions, options) {
        let attributeName,
            fieldValue = fieldOptions.value,
            filterOption,
            filterCondition;

        const matchModes = DB_CONSTANTS.DATABASE_MATCH_MODES,
            fieldName = fieldOptions.fieldName,
            fieldRequired = fieldOptions.required || false,
            fieldType = LiveVariableUtils.getSQLFieldType(variable, fieldOptions);

        filterCondition = matchModes[fieldOptions.matchMode] || matchModes[fieldOptions.filterCondition] || fieldOptions.filterCondition;

        fieldOptions.type = fieldType;
        /* if the field value is an object(complex type), loop over each field inside and push only first level fields */
        if (isObject(fieldValue) && !isArray(fieldValue)) {
            const firstLevelValues = [];
            forEach(fieldValue, (subFieldValue, subFieldName) => {
                if (subFieldValue && !isObject(subFieldValue)) {
                    firstLevelValues.push(fieldName + '.' + subFieldName + '=' + subFieldValue);
                }
            });
            return firstLevelValues;
        }

        if (includes(DB_CONSTANTS.DATABASE_EMPTY_MATCH_MODES, filterCondition)) {
            attributeName = LiveVariableUtils.getAttributeName(variable, fieldName);
            // For non string types empty match modes are not supported, so convert them to null match modes.
            if (fieldType && !LiveVariableUtils.isStringType(fieldType)) {
                filterCondition = DB_CONSTANTS.DATABASE_NULL_EMPTY_MATCH[filterCondition];
            }
            filterOption = {
                'attributeName': attributeName,
                'attributeValue': '',
                'attributeType': toUpper(fieldType),
                'filterCondition': filterCondition,
                'required': fieldRequired
            };
            if (options.searchWithQuery) {
                filterOption.isVariableFilter = fieldOptions.isVariableFilter;
            }
            return filterOption;
        }

        if (isDefined(fieldValue) && fieldValue !== null && fieldValue !== '') {
            /*Based on the sqlType of the field, format the value & set the filter condition.*/
            if (fieldType) {
                switch (fieldType) {
                    case 'integer':
                        fieldValue = isArray(fieldValue) ? reduce(fieldValue, (result, value) => {
                            value = parseInt(value, 10);
                            if (!isNaN(value)) {
                                result.push(value);
                            }
                            return result;
                        }, []) : parseInt(fieldValue, 10);
                        filterCondition = filterCondition ? LiveVariableUtils.getFilterCondition(filterCondition) : matchModes['exact'];
                        break;
                    case 'date':
                    case 'datetime':
                    case 'timestamp':
                        fieldValue = formatDate(fieldValue, fieldType, variable.dateFormatter);
                        filterCondition = filterCondition ? LiveVariableUtils.getFilterCondition(filterCondition) : matchModes['exact'];
                        break;
                    case 'text':
                    case 'string':
                        if (isArray(fieldValue)) {
                            filterCondition = includes([matchModes['in'], matchModes['notin']], filterCondition) ? filterCondition : matchModes['exact'];
                        } else {
                            filterCondition = filterCondition || matchModes['anywhereignorecase'];
                        }
                        break;
                    default:
                        filterCondition = filterCondition ? LiveVariableUtils.getFilterCondition(filterCondition) : matchModes['exact'];
                        break;
                }
            } else {
                filterCondition = isString(fieldValue) ? matchModes['anywhereignorecase'] : matchModes['exact'];
            }
            attributeName = LiveVariableUtils.getAttributeName(variable, fieldName);
            filterOption = {
                'attributeName': attributeName,
                'attributeValue': fieldValue,
                'attributeType': toUpper(fieldType),
                'filterCondition': filterCondition,
                'required': fieldRequired
            };
            if (options.searchWithQuery) {
                filterOption.isVariableFilter = fieldOptions.isVariableFilter;
            }
            return filterOption;
        }
    }

    static getFilterOptions(variable, filterFields, options) {
        let filterOptions = [];
        each(filterFields, (fieldOptions) => {
            const filterOption = LiveVariableUtils.getFilterOption(variable, fieldOptions, options);
            if (!isNil(filterOption)) {
                if (isArray(filterOption)) {
                    filterOptions = filterOptions.concat(filterOption);
                } else {
                    filterOptions.push(filterOption);
                }
            }
        });
        return filterOptions;
    }

    // Wrap the field name and value in lower() in ignore case scenario
    // TODO: Change the function name to represent the added functionality of identifiers for datetime, timestamp and float types. Previously only lower was warapped.
    static wrapInLowerCase(value, options, ignoreCase, isField?) {
        const type = toLower(options.attributeType);
        // If ignore case is true and type is string/ text and match mode is string type, wrap in lower()
        if (ignoreCase && (!type || LiveVariableUtils.isStringType(type)) && includes(DB_CONSTANTS.DATABASE_STRING_MODES, options.filterCondition)) {
            return 'lower(' + value + ')';
        }
        return value;
    }

    static encodeAndAddQuotes(value, type, skipEncode) {
        let encodedValue = skipEncode ? value : encodeURIComponent(value);
        type = toLower(type);
        encodedValue = _replace(encodedValue, /'/g, '\'\'');
        // For number types, don't wrap the value in quotes
        if ((isNumberType(type) && type !== 'float')) {
            return encodedValue;
        }
        return '\'' + encodedValue + '\'';
    }

    static getParamValue(value, options, ignoreCase, skipEncode) {
        let param;
        const filterCondition = options.filterCondition,
            dbModes = DB_CONSTANTS.DATABASE_MATCH_MODES,
            type = options.attributeType;
        if (includes(DB_CONSTANTS.DATABASE_EMPTY_MATCH_MODES, filterCondition)) {
            // For empty matchmodes, no value is required
            return '';
        }
        switch (filterCondition) {
            case dbModes.startignorecase:
            case dbModes.start:
                param = LiveVariableUtils.encodeAndAddQuotes(value + '%', type, skipEncode);
                param = LiveVariableUtils.wrapInLowerCase(param, options, ignoreCase);
                break;
            case dbModes.endignorecase:
            case dbModes.end:
                param = LiveVariableUtils.encodeAndAddQuotes('%' + value, type, skipEncode);
                param = LiveVariableUtils.wrapInLowerCase(param, options, ignoreCase);
                break;
            case dbModes.nowhereignorecase:
            case dbModes.nowhere:
            case dbModes.anywhereignorecase:
            case dbModes.anywhere:
                param = LiveVariableUtils.encodeAndAddQuotes('%' + value + '%', type, skipEncode);
                param = LiveVariableUtils.wrapInLowerCase(param, options, ignoreCase);
                break;
            case dbModes.between:
                param = join(map(value, val => {
                    return LiveVariableUtils.wrapInLowerCase(LiveVariableUtils.encodeAndAddQuotes(val, type, skipEncode), options, ignoreCase);
                }), ' and ');
                break;
            case dbModes.in:
            case dbModes.notin:
                param = join(map(value, val => {
                    return LiveVariableUtils.wrapInLowerCase(LiveVariableUtils.encodeAndAddQuotes(val, type, skipEncode), options, ignoreCase);
                }), ', ');
                param = '(' + param + ')';
                break;
            /*case dbModes.exactignorecase:
            case dbModes.exact:
            case dbModes.notequals:
            The above three cases will be handled by default*/
            default:
                param = LiveVariableUtils.encodeAndAddQuotes(value, type, skipEncode);
                param = LiveVariableUtils.wrapInLowerCase(param, options, ignoreCase);
                break;
        }
        return isDefined(param) ? param : '';
    }

    static getSearchQuery(filterOptions, operator, ignoreCase, skipEncode?) {
        let query;
        const params = [];
        forEach(filterOptions, fieldValue => {
            const value = fieldValue.attributeValue,
                dbModes = DB_CONSTANTS.DATABASE_MATCH_MODES,
                isValArray = isArray(value);
            let fieldName = fieldValue.attributeName,
                filterCondition = fieldValue.filterCondition,
                matchModeExpr,
                paramValue;
            // If value is an empty array, do not generate the query
            // If values is NaN and number type, do not generate query for this field
            if ((isValArray && isEmpty(value)) || (!isValArray && isNaN(value) && (isNumberType(fieldValue.attributeType))) || (!isValArray && (isNaN(value) && !moment(value).isValid() && isDateTimeType(toLower(fieldValue.attributeType))))) {
                return;
            }
            if (isValArray) {
                // If array is value and mode is between, pass between. Else pass as in query
                filterCondition = filterCondition === dbModes.between || filterCondition === dbModes.notin ? filterCondition : dbModes.in;
                fieldValue.filterCondition = filterCondition;
            }
            matchModeExpr = DB_CONSTANTS.DATABASE_MATCH_MODES_WITH_QUERY[filterCondition];
            paramValue = LiveVariableUtils.getParamValue(value, fieldValue, ignoreCase, skipEncode);
            fieldName = LiveVariableUtils.wrapInLowerCase(fieldName, fieldValue, ignoreCase);
            params.push(replace(matchModeExpr, [fieldName, paramValue]));
        });
        query = join(params, operator); // empty space added intentionally around OR
        return query;
    }

    /**
     * creating the proper values from the actual object like for between,in matchModes value has to be an array like [1,2]
     * @param rules recursive filterexpressions object
     * @param variable variable object
     * @param options options
     */
    static processFilterFields(rules, variable, options) {
        remove(rules, rule => {
            return rule && (isString(rule.value) && rule.value.indexOf('bind:') === 0 || (rule.matchMode === 'between' ? (isString(rule.secondvalue) && rule.secondvalue.indexOf('bind:') === 0) : false));
        });

        forEach(rules, (rule, index) => {
            if (rule) {
                if (rule.rules) {
                    LiveVariableUtils.processFilterFields(rule.rules, variable, options);
                } else {
                    if (!isNull(rule.target)) {
                        const value = rule.matchMode.toLowerCase() === DB_CONSTANTS.DATABASE_MATCH_MODES.between.toLowerCase()
                            ? (isArray(rule.value) ? rule.value : [rule.value, rule.secondvalue])
                            : (rule.matchMode.toLowerCase() === DB_CONSTANTS.DATABASE_MATCH_MODES.in.toLowerCase() || rule.matchMode.toLowerCase() === DB_CONSTANTS.DATABASE_MATCH_MODES.notin.toLowerCase()
                                ? (isArray(rule.value) ? rule.value : (rule.value ? rule.value.split(',').map(val => val.trim()) : ''))
                                : rule.value);
                        rules[index] = LiveVariableUtils.getFilterOption(variable, {
                            'fieldName': rule.target,
                            'type': rule.type,
                            'value': value,
                            'required': rule.required,
                            'filterCondition': rule.matchMode || options.matchMode || variable.matchMode
                        }, options);
                    }
                }
            }
        });
    }

    static getSearchField(fieldValue, ignoreCase, skipEncode) {
        let fieldName = fieldValue.attributeName;
        let matchModeExpr;
        let paramValue;
        let filterCondition = fieldValue.filterCondition;

        const value = fieldValue.attributeValue;
        const isValArray = isArray(value);
        const dbModes = DB_CONSTANTS.DATABASE_MATCH_MODES;

        // If value is an empty array, do not generate the query
        // If values is NaN and number type, do not generate query for this field
        if ((isValArray && isEmpty(value)) ||
            (isValArray && some(value, val => (isNull(val) || isNaN(val) || val === ''))) ||
            (!isValArray && (isNaN(value) && (isNumberType(fieldValue.attributeType)))) ||
            (!isValArray && (isNaN(value) && !moment(value).isValid() && isDateTimeType(toLower(fieldValue.attributeType))))) {
            return;
        }
        if (isValArray) {
            // If array is value and mode is between, pass between. Else pass as in query
            filterCondition = filterCondition === dbModes.between || filterCondition === dbModes.notin ? filterCondition : dbModes.in;
            fieldValue.filterCondition = filterCondition;
        }
        matchModeExpr = DB_CONSTANTS.DATABASE_MATCH_MODES_WITH_QUERY[filterCondition];
        paramValue = LiveVariableUtils.getParamValue(value, fieldValue, ignoreCase, skipEncode);
        fieldName = LiveVariableUtils.wrapInLowerCase(fieldName, fieldValue, ignoreCase);
        return replace(matchModeExpr, [fieldName, paramValue]);
    }

    /**
     * this is used to identify whether to use ignorecase at each criteria level and not use the variable
     * level isIgnoreCase flag and apply it to all the rules.
     * Instead of adding an extra param to the criteria object, we have added few other matchmodes for string types like
     * anywhere with anywhereignorecase, start with startignorecase, end with endignorecase, exact with exactignorecase,
     * So while creating the criteria itseld user can choose whether to use ignore case or not for a particular column while querying
     * @param matchMode
     * @param ignoreCase
     * @returns {*} boolean
     */
    static getIgnoreCase(matchMode, ignoreCase) {
        const matchModes = DB_CONSTANTS.DATABASE_MATCH_MODES;
        if (indexOf([matchModes['anywhere'], matchModes['nowhere'], matchModes['start'], matchModes['end'], matchModes['exact']], matchMode) !== -1) {
            return false;
        }
        if (indexOf([matchModes['anywhereignorecase'], matchModes['nowhereignorecase'], matchModes['startignorecase'], matchModes['endignorecase'], matchModes['exactignorecase']], matchMode) !== -1) {
            return true;
        }
        return ignoreCase;
    }

    static generateSearchQuery(rules, condition, ignoreCase, skipEncode) {
        const params = [];
        forEach(rules, rule => {
            if (rule) {
                if (rule.rules) {
                    const query = LiveVariableUtils.generateSearchQuery(rule.rules, rule.condition, ignoreCase, skipEncode);
                    if (query !== '') {
                        params.push('(' + query + ')');
                    }
                } else {
                    const searchField = LiveVariableUtils.getSearchField(rule, LiveVariableUtils.getIgnoreCase(rule.filterCondition, ignoreCase), skipEncode);
                    if (!isNil(searchField)) {
                        params.push(searchField);
                    }
                }
            }
        });
        return join(params, ' ' + condition + ' ');
    }

    static prepareTableOptionsForFilterExps(variable, options, clonedFields) {
        if (!isDefined(options.searchWithQuery)) {
            options.searchWithQuery = true; // Using query api instead of  search api
        }

        const filterOptions = [];
        const matchModes = DB_CONSTANTS.DATABASE_MATCH_MODES;
        let orderByFields,
            orderByOptions,
            query;
        let clonedObj = clonedFields || getClonedObject(variable.filterExpressions);

        // if filterexpression from live filter is present use it to query
        if (options.filterExpr && !isEmpty(options.filterExpr)) {
            clonedObj = options.filterExpr;
        }
        // merge live filter runtime values
        let filterRules: any = {};
        if (!isEmpty(options.filterFields)) {
            let operator = '';
            for (const field in options.filterFields) {
                operator = options.filterFields[field] && options.filterFields[field]['logicalOp'] || '';
                break;
            }
            filterRules = {'condition': options.logicalOp || operator || 'AND', 'rules': []};
            forEach(options.filterFields, (filterObj, filterName) => {
                if (!filterObj) {
                    return
                }
                const filterCondition = matchModes[filterObj.matchMode] || matchModes[filterObj.filterCondition] || filterObj.filterCondition;
                if (includes(DB_CONSTANTS.DATABASE_EMPTY_MATCH_MODES, filterCondition) ||
                    (!isNil(filterObj.value) && filterObj.value !== '')) {
                    const type = filterObj.type || LiveVariableUtils.getSqlType(variable, filterName, options.entityName);
                    const ruleObj = {
                        'target': filterName,
                        'type': type,
                        'matchMode': filterObj.matchMode || (LiveVariableUtils.isStringType(type) ? 'startignorecase' : 'exact'),
                        'value': filterObj.value,
                        'required': filterObj.required || false
                    };
                    filterRules.rules.push(ruleObj);
                }
            });
        }
        if (!isEmpty(clonedObj)) {
            if (!isNil(filterRules.rules) && filterRules.rules.length) {
                // combine both the rules using 'AND'
                const tempRules = {'condition': 'AND', 'rules': []};
                tempRules.rules.push(getClonedObject(clonedObj));
                tempRules.rules.push(filterRules);
                clonedObj = tempRules;
            }
        } else {
            clonedObj = filterRules;
        }

        LiveVariableUtils.processFilterFields(clonedObj.rules, variable, options);
        query = LiveVariableUtils.generateSearchQuery(clonedObj.rules, clonedObj.condition, variable.ignoreCase, options.skipEncode);

        orderByFields = getEvaluatedOrderBy(variable.orderBy, options.orderBy);
        orderByOptions = orderByFields ? 'sort=' + orderByFields : '';

        return {
            'filter' : filterOptions,
            'sort'   : orderByOptions,
            'query'  : query
        };
    }

    static prepareTableOptions(variable, options, clonedFields?) {
        if (variable.operation === 'read') {
            return LiveVariableUtils.prepareTableOptionsForFilterExps(variable, options, clonedFields);
        }
        if (!isDefined(options.searchWithQuery)) {
            options.searchWithQuery = true; //  Using query api instead of  search api
        }
        const filterFields = [];
        let filterOptions = [],
            orderByFields,
            orderByOptions,
            query,
            optionsQuery;
        clonedFields = clonedFields || variable.filterFields;
        // get the filter fields from the variable
        forEach(clonedFields, (value, key) => {
            if (isObject(value) && (!options.filterFields || !options.filterFields[key] || options.filterFields[key].logicalOp === 'AND')) {
                value.fieldName = key;
                if (LiveVariableUtils.isStringType(LiveVariableUtils.getSQLFieldType(variable, value))) {
                    value.filterCondition = DB_CONSTANTS.DATABASE_MATCH_MODES[value.matchMode || variable.matchMode];
                }
                value.isVariableFilter = true;
                filterFields.push(value);
            }
        });
        // get the filter fields from the options
        forEach(options.filterFields, (value, key) => {
            value.fieldName = key;
            value.filterCondition = DB_CONSTANTS.DATABASE_MATCH_MODES[value.matchMode || options.matchMode || variable.matchMode];
            filterFields.push(value);
        });
        if (variable.operation === 'read' || options.operation === 'read') {
            filterOptions = LiveVariableUtils.getFilterOptions(variable, filterFields, options);
        }
        /*if searchWithQuery is true, then convert the input params into query string. For example if firstName and lastName
         should be sent as params then query string will be q='firstName containing 'someValue' OR lastName containing 'someValue''
         */
        if (options.searchWithQuery && filterOptions.length) {
            // Generate query for variable filter fields. This has AND logical operator
            query = LiveVariableUtils.getSearchQuery(filter(filterOptions, {'isVariableFilter': true}), ' AND ', variable.ignoreCase, options.skipEncode);
            // Generate query for option filter fields. This has default logical operator as OR
            optionsQuery = LiveVariableUtils.getSearchQuery(filter(filterOptions, {'isVariableFilter': undefined}), ' ' + (options.logicalOp || 'AND') + ' ', variable.ignoreCase, options.skipEncode);
            if (optionsQuery) {
                // If both variable and option query are present, merge them with AND
                query = query ? (query + ' AND ( ' + optionsQuery + ' )') : optionsQuery;
            }
        }
        orderByFields = getEvaluatedOrderBy(variable.orderBy, options.orderBy);
        orderByOptions = orderByFields ? 'sort=' + orderByFields : '';

        return {
            'filter': filterOptions,
            'sort': orderByOptions,
            'query': query
        };
    }

    /* Function to check if specified field is of type date*/
    static getFieldType(fieldName, variable, relatedField?) {
        let fieldType,
            columns,
            result;
        if (variable.propertiesMap) {
            columns = variable.propertiesMap.columns || [];
            result = find(columns, obj => {
                return obj.fieldName === fieldName;
            });
            // if related field name passed, get its type from columns inside the current field
            if (relatedField && result) {
                result = find(result.columns, obj => {
                    return obj.fieldName === relatedField;
                });
            }
            fieldType = result && result.type;
        }
        return fieldType;
    }

    // Prepare formData for blob columns
    static prepareFormData(variableDetails, rowObject) {
        const formData: any = new FormData();
        formData.rowData = clone(rowObject);
        forEach(rowObject, (colValue, colName) => {
            if (LiveVariableUtils.getFieldType(colName, variableDetails) === 'blob') {
                if (isObject(colValue)) {
                    if (isArray(colValue)) {
                        forEach(colValue, fileObject => {
                            formData.append(colName, fileObject, fileObject.name);
                        });
                    } else {
                        formData.append(colName, colValue, colValue.name);
                    }
                }
                rowObject[colName] = colValue !== null ? '' : null;
            }
        });
        formData.append(SWAGGER_CONSTANTS.WM_DATA_JSON, new Blob([JSON.stringify(rowObject)], {
            type: 'application/json'
        }));
        return formData;
    }

    static traverseFilterExpressions(filterExpressions, traverseCallbackFn) {
        if (filterExpressions && filterExpressions.rules) {
            forEach(filterExpressions.rules, (filExpObj, i) => {
                if (filExpObj.rules) {
                    LiveVariableUtils.traverseFilterExpressions(filExpObj, traverseCallbackFn);
                } else {
                    return triggerFn(traverseCallbackFn, filterExpressions, filExpObj);
                }
            });
        }
    }

    /**
     * Traverses recursively the filterExpressions object and if there is any required field present with no value,
     * then we will return without proceeding further. Its upto the developer to provide the mandatory value,
     * if he wants to assign it in teh onbefore<delete/insert/update>function then make that field in
     * the filter query section as optional
     * @param filterExpressions - recursive rule Object
     * @returns {Object} object or boolean. Object if everything gets validated or else just boolean indicating failure in the validations
     */
    static getFilterExprFields(filterExpressions) {
        let isRequiredFieldAbsent = false;
        const traverseCallbackFn = (parentFilExpObj, filExpObj) => {
            if (filExpObj
                && filExpObj.required
                && ((indexOf(['null', 'isnotnull', 'empty', 'isnotempty', 'nullorempty'], filExpObj.matchMode) === -1) && filExpObj.value === '')) {
                isRequiredFieldAbsent = true;
                return false;
            }
        };
        LiveVariableUtils.traverseFilterExpressions(filterExpressions, traverseCallbackFn);
        return isRequiredFieldAbsent ? !isRequiredFieldAbsent : filterExpressions;
    }

    /**
     *
     * @param variable
     * @param options
     * @returns {function(*=): *} returns a function which should be called for the where clause.
     * This return function can take a function as argument. This argument function can modify the filter fields
     * before generating where clause.
     */
    static getWhereClauseGenerator(variable, options, updatedFilterFields?: any) {
        return (modifier, skipEncode?: boolean) => {
            const clonedFields = LiveVariableUtils.getFilterExprFields(getClonedObject(updatedFilterFields || variable.filterExpressions));
            // this flag skips the encoding of the query
            if (isDefined(skipEncode)) {
                options.skipEncode = skipEncode;
            }
            if (modifier) {
                // handling the scenario where variable can also have filterFields
                if (options.filterFields) {
                    modifier(clonedFields, options);
                } else {
                    modifier(clonedFields);
                }
            }
            return LiveVariableUtils.prepareTableOptions(variable, options, clonedFields).query;
        };
    }
}

