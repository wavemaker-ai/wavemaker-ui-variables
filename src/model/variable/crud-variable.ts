import { isDefined } from "../../util/utils";
import { DataSource, IDataSource } from "../../types/types";
import { VariableManagerFactory } from '../../factory/variable-manager.factory';
import { ApiAwareVariable } from './api-aware-variable';
import { VARIABLE_CONSTANTS } from '../../constants/variables.constants';
import { CrudVariableManager } from '../../manager/variable/crud-variable.manager';
import { ServiceVariableUtils } from '../../util/variable/service-variable.utils';
import {CRUDList} from '../crud-list';
import {CRUDCreate} from '../crud-create';
import {CRUDUpdate} from '../crud-update';
import {CRUDDelete} from '../crud-delete';

import _ from 'lodash';

const getManager = (): CrudVariableManager => {
    return VariableManagerFactory.get(VARIABLE_CONSTANTS.CATEGORY.CRUD);
};

export class CrudVariable extends ApiAwareVariable implements IDataSource {

    // Used to track progress of file upload
    _progressObservable;
    // Used to track a variable http call, so that it can be cancelled at any point of time during its execution
    _observable;
    pagination;
    list;
    create;
    update;
    delete;
    simulateFileDownload;
    serviceInfo;
    httpService;

    constructor(variable: any) {
        super();
        Object.assign(this as any, variable);
        // for having separate setInput methods for each type
        this.list   = new CRUDList(this, getManager());
        this.create = new CRUDCreate(this, getManager());
        this.update = new CRUDUpdate(this, getManager());
        this.delete = new CRUDDelete(this, getManager());
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
                returnVal = false;
                break;
            case DataSource.Operation.SUPPORTS_DISTINCT_API:
                returnVal = false;
                break;
            case DataSource.Operation.IS_PAGEABLE:
                returnVal = this.hasPagination();
                break;
            case DataSource.Operation.IS_SORTABLE:
                returnVal = this.hasPagination() && !(this as any)._paginationConfig;
                break;
            case DataSource.Operation.SUPPORTS_SERVER_FILTER:
                returnVal = false;
                break;
            case DataSource.Operation.SET_INPUT:
                returnVal = this.setInput(options);
                break;
            case DataSource.Operation.LIST_RECORDS:
                returnVal = this.invoke(options);
                break;
            case DataSource.Operation.INVOKE :
                returnVal = this.invoke(options);
                break;
            case DataSource.Operation.UPDATE :
                returnVal = this.invoke(options);
                break;
            case DataSource.Operation.SEARCH_RECORDS:
                returnVal = this.searchRecords(options);
                break;
            case DataSource.Operation.DOWNLOAD:
                returnVal = this.download(options);
                break;
            case DataSource.Operation.GET_PAGING_OPTIONS:
                returnVal = this.pagination;
                break;
            case DataSource.Operation.IS_UPDATE_REQUIRED:
                returnVal = this.isUpdateRequired(options);
                break;
            case DataSource.Operation.IS_BOUND_TO_LOCALE:
                returnVal = false;
                break;
            case DataSource.Operation.CANCEL:
                returnVal = this.cancel(options);
                break;
            case DataSource.Operation.INSERT_RECORD :
                options.operation = 'create';
                returnVal = this.invoke(options);
                break;
            case DataSource.Operation.UPDATE_RECORD :
                options.operation = 'update';
                returnVal = this.invoke(options);
                break;
            case DataSource.Operation.DELETE_RECORD :
                options.operation = 'delete';
                returnVal = this.invoke(options);
                break;
            case DataSource.Operation.SET_PAGINATION:
                returnVal = this.setPagination(options);
                break;
            default :
                returnVal = {};
                break;
        }
        return returnVal;
    }

    hasPagination() {
        return this.controller === VARIABLE_CONSTANTS.CONTROLLER_TYPE.QUERY || !_.isEmpty(this.pagination);
    }

    invoke(options?, success?, error?) {
        return getManager().invoke(this, options, success, error);
    }

    createRecord(options?, success?, error?) {
        options = options || {};
        options.operation = 'create';
        return getManager().invoke(this, options, success, error);
    }

    listRecords(options?, success?, error?) {
        options = options || {};
        options.operation = 'list';
        return getManager().invoke(this, options, success, error);
    }

    updateRecord(options?, success?, error?) {
        options = options || {};
        options.operation = 'update';
        return getManager().invoke(this, options, success, error);
    }

    deleteRecord(options?, success?, error?) {
        options = options || {};
        options.operation = 'delete';
        return getManager().invoke(this, options, success, error);
    }

    download(options, success?, error?) {
        return getManager().download(this, options, success, error);
    }

    setInput(key, val?, options?) {
        return getManager().setInput(this, key, val, options);
    }

    searchRecords(options, success?, error?) {
        return new Promise((resolve, reject) => {
            getManager().searchRecords(this, options, (response, pagination) => {
                resolve({data: response.content || response, pagination});
            }, reject);
        });
    }

    isUpdateRequired(hasData) {
        const inputFields = getManager().getInputParms(this);
        const queryParams = ServiceVariableUtils.excludePaginationParams(inputFields);

        if (!queryParams.length) {
            // if we don't have any query params and variable data is available then we don't need variable update, so return false
            if (hasData) {
                return false;
            }
        }

        return true;
    }

    cancel(options?) {
        return getManager().cancel(this, options);
    }

    setPagination(data) {
        return getManager().setPagination(this, data);
    }

    init() {
        getManager().initBinding(this);
        getManager().defineFirstLastRecord(this);
    }
}
