import { DataSource, IDataSource } from '../../types/types';
import { isDefined } from "../../util/utils";

import { VariableManagerFactory } from '../../factory/variable-manager.factory';
import { BaseVariable } from '../base-variable';
import { VARIABLE_CONSTANTS } from '../../constants/variables.constants';
import { appManager } from '../../util/variable/variables.utils';

const getManager = () => {
    return VariableManagerFactory.get(VARIABLE_CONSTANTS.CATEGORY.MODEL);
};

export class ModelVariable extends BaseVariable implements IDataSource {

    type: any;
    saveInPhonegap: any;

    constructor(variable: any) {
        super();
        console.log(variable);
        Object.assign(this as any, variable);
    }

    init() {
        if (this.isList) {
            getManager().removeFirstEmptyObject(this);
        }

        getManager().initBinding(this, 'dataBinding', 'dataSet');
    }

    execute(operation: any, options: any) {
        let returnVal = super.execute(operation, options);
        if (isDefined(returnVal)) {
            return returnVal;
        }

        switch (operation) {
            case DataSource.Operation.IS_API_AWARE:
                returnVal = false;
                break;
            case DataSource.Operation.SUPPORTS_CRUD:
                returnVal = false;
                break;
            case DataSource.Operation.SUPPORTS_DISTINCT_API:
                returnVal = false;
                break;
            case DataSource.Operation.IS_PAGEABLE:
                returnVal = false;
                break;
            case DataSource.Operation.IS_SORTABLE:
                returnVal = false;
                break;
            case DataSource.Operation.SUPPORTS_SERVER_FILTER:
                returnVal = false;
                break;
            case DataSource.Operation.IS_BOUND_TO_LOCALE:
                returnVal = this.isBoundToLocale();
                break;
            case DataSource.Operation.GET_DEFAULT_LOCALE:
                returnVal = this.getDefaultLocale();
                break;
            default:
                returnVal = {};
                break;
        }
        return returnVal;
    }

    isBoundToLocale() {
        return this.name === 'supportedLocale';
    }

    getDefaultLocale() {
        return appManager.getSelectedLocale();
    }

}
