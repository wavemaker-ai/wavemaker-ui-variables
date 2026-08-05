import { isDefined, getClonedObject } from "../../util/utils";
import { DataSource, IDataSource } from "../../types/types";

import { VariableManagerFactory } from '../../factory/variable-manager.factory';
import { ApiAwareVariable } from './api-aware-variable';
import { VARIABLE_CONSTANTS } from '../../constants/variables.constants';
import { LiveVariableManager } from '../../manager/variable/live-variable.manager';
import {debounceVariableCall} from "../../util/variable/variables.utils";
import {isUndefined, includes, forEach, isFunction} from 'lodash-es';
const getManager = (): LiveVariableManager => {
    return VariableManagerFactory.get(VARIABLE_CONSTANTS.CATEGORY.LIVE);
};

export class LiveVariable extends ApiAwareVariable implements IDataSource {

    matchMode;
    liveSource;
    propertiesMap;
    pagination;
    type;
    orderBy;
    _options;
    // Used to track a variable http call, so that it can be cancelled at any point of time during its execution
    _observable;
    filterExpressions;
    httpService;
    dateFormatter;
    invokeHttp?: (requestParams: any, params: any) => Promise<any>;

    constructor(variable: any) {
        super();
        Object.assign(this as any, variable);
        this.httpService = variable.httpClientService;
    }

    execute(operation, options) {
        let returnVal = super.execute(operation, options);
        if (isDefined(returnVal)) {
            return returnVal;
        }

        switch (operation) {
            case DataSource.Operation.IS_API_AWARE:
                returnVal = true;
                break;
            case DataSource.Operation.SUPPORTS_CRUD:
                returnVal = true;
                break;
            case DataSource.Operation.SUPPORTS_DISTINCT_API:
                returnVal = true;
                break;
            case DataSource.Operation.IS_PAGEABLE:
                returnVal = true;
                break;
            case DataSource.Operation.IS_SORTABLE:
                returnVal = true;
                break;
            case DataSource.Operation.SUPPORTS_SERVER_FILTER:
                returnVal = true;
                break;
            case DataSource.Operation.GET_OPERATION_TYPE:
                returnVal = this.operation;
                break;
            case DataSource.Operation.GET_RELATED_PRIMARY_KEYS:
                returnVal = this.getRelatedTablePrimaryKeys(options);
                break;
            case DataSource.Operation.GET_ENTITY_NAME:
                returnVal = this.propertiesMap.entityName;
                break;
            case DataSource.Operation.LIST_RECORDS:
                returnVal = this.listRecords(options);
                break;
            case DataSource.Operation.UPDATE_RECORD :
                returnVal = this.updateRecord(options);
                break;
            case DataSource.Operation.INSERT_RECORD :
                returnVal = this.insertRecord(options);
                break;
            case DataSource.Operation.DELETE_RECORD :
                returnVal = this.deleteRecord(options);
                break;
            case DataSource.Operation.INVOKE :
                returnVal = this.invoke(options);
                break;
            case DataSource.Operation.UPDATE :
                returnVal = this.update(options);
                break;
            case DataSource.Operation.GET_RELATED_TABLE_DATA:
                returnVal = this.getRelatedTableData(options.relatedField, options);
                break;
            case DataSource.Operation.GET_DISTINCT_DATA_BY_FIELDS:
                returnVal = this.getDistinctDataByFields(options);
                break;
            case DataSource.Operation.GET_AGGREGATED_DATA:
                returnVal = this.getAggregatedData(options);
                break;
            case DataSource.Operation.GET_MATCH_MODE:
                returnVal = this.matchMode;
                break;
            case DataSource.Operation.DOWNLOAD:
                returnVal = this.download(options);
                break;
            case DataSource.Operation.GET_PROPERTIES_MAP:
                returnVal = this.propertiesMap;
                break;
            case DataSource.Operation.GET_PRIMARY_KEY:
                returnVal = this.getPrimaryKey();
                break;
            case DataSource.Operation.GET_BLOB_URL:
                returnVal = `services/${this.liveSource}/${this.type}/${options.primaryValue}/content/${options.columnName}`;
                break;
            case DataSource.Operation.GET_OPTIONS:
                returnVal = this._options || {};
                break;
            case DataSource.Operation.SEARCH_RECORDS:
                returnVal = this.searchRecords(options);
                break;
            case DataSource.Operation.GET_REQUEST_PARAMS:
                returnVal = this.getRequestParams(options);
                break;
            case DataSource.Operation.GET_PAGING_OPTIONS:
                returnVal = this.pagination;
                break;
            case DataSource.Operation.IS_UPDATE_REQUIRED:
                returnVal = true;
                break;
            case DataSource.Operation.IS_BOUND_TO_LOCALE:
                returnVal = false;
                break;
            case DataSource.Operation.CANCEL:
                returnVal = false;
                break;
            default:
                returnVal = {};
                break;
        }
        return returnVal;
    }

    listRecords(options?, success?, error?) {
        return getManager().listRecords(this, options, success, error);
    }

    updateRecord(options?, success?, error?) {
        return getManager().updateRecord(this, options, success, error);
    }

    insertRecord(options?, success?, error?) {
        return getManager().insertRecord(this, options, success, error);
    }

    deleteRecord(options?, success?, error?) {
        return getManager().deleteRecord(this, options, success, error);
    }

    setInput(key, val, options) {
        return getManager().setInput(this, key, val, options);
    }

    setFilter(key, val) {
        return getManager().setFilter(this, key, val);
    }

    download(options, success?, error?) {
        return getManager().download(this, options, success, error);
    }

    invoke(options?, success?, error?) {
        switch (this.operation) {
            case 'insert':
                return this.insertRecord(options, success, error);
            case 'update':
                return this.updateRecord(options, success, error);
            case 'delete':
                return this.deleteRecord(options, success, error);
            default:
                return this.listRecords(options, success, error);
        }
    }

    getRelatedTablePrimaryKeys(columnName) {
        return getManager().getRelatedTablePrimaryKeys(this, columnName);
    }

    getRelatedTableData(columnName, options, success?, error?) {
        return getManager().getRelatedTableData(this, columnName, options, success, error);
    }

    getDistinctDataByFields(options, success?, error?) {
        return getManager().getDistinctDataByFields(this, options, success, error);
    }

    getAggregatedData(options, success?, error?) {
        return getManager().getAggregatedData(this, options, success, error);
    }

    getPrimaryKey() {
        return getManager().getPrimaryKey(this);
    }

    searchRecords(options, success?, error?) {
        return getManager().searchRecords(this, options, success, error);
    }

    getRequestParams(options) {
        return getManager().prepareRequestParams(options);
    }

    _downgradeInputData(data) {
        return getManager().downgradeFilterExpressionsToInputData(this, data);
    }

    _upgradeInputData(response, data) {
        return getManager().upgradeInputDataToFilterExpressions(this, response, data);
    }

    setOrderBy(expression) {
        this.orderBy = expression;
        return this.orderBy;
    }

    // legacy method
    update(options?, success?, error?) {
        return this.invoke(options, success, error);
    }

    createRecord(options?, success?, error?) {
        return this.insertRecord(options, success, error);
    }

    init() {
        getManager().initBinding(this, 'dataBinding', this.operation === 'read' ? 'filterFields' : 'inputFields');
        if (this.operation === 'read') {
            getManager().initFilterExpressionBinding(this);
        }
        getManager().defineFirstLastRecord(this);
    }

    invokeOnFiltertExpressionChange(obj, targetNodeKey, newVal, oldVal) {
        console.log('filter expr changed', newVal, oldVal);
            if ((newVal === oldVal && isUndefined(newVal)) || (isUndefined(newVal) && !isUndefined(oldVal))) {
                return;
            }
            // Skip cloning for blob column
            if (!includes(['blob', 'file'], obj.type)) {
                newVal = getClonedObject(newVal);
            }
            // backward compatibility: where we are allowing the user to bind complete object
            if (obj.target === 'dataBinding') {
                // remove the existing databinding element
                this.filterExpressions.rules = [];
                // now add all the returned values
                forEach(newVal, function (value, target) {
                    this.filterExpressions.rules.push({
                        'target': target,
                        'value': value,
                        'matchMode': obj.matchMode || 'startignorecase',
                        'required': false,
                        'type': ''
                    });
                });
            } else {
                // setting value to the root node
                obj[targetNodeKey] = newVal;
            }
        if (this.operation === 'read') {
            /* if auto-update set for the variable with read operation only, get its data */
            if (this.autoUpdate && !isUndefined(newVal) && isFunction(this.update)) {
                debounceVariableCall(this, 'update');
            }
        } else {
            /* if auto-update set for the variable with read operation only, get its data */
            if (this.autoUpdate && !isUndefined(newVal) && isFunction(this[this.operation + 'Record'])) {
                debounceVariableCall(this, this.operation + 'Record');
            }
        }
            // this.invoke();
    }

    cancel(options?) {
        return getManager().cancel(this, options);
    }
}
