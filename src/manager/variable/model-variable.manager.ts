import { BaseVariableManager } from './base-variable.manager';

import {forEach, isBoolean, isNumber, isObject, isArray, isEmpty} from 'lodash-es';

const checkEmptyObject = (obj: any) => {
    let isEmpt = true;
    forEach(obj, (value: any) => {
        if (isEmpty(value) && !isBoolean(value) && !isNumber(value)) {
          return;
        }
        if (!isObject(value)) {
            isEmpt = false;
        } else if (isArray(value)) {
            // If array, check if array is empty or if it has only one value and the value is empty
            isEmpt = isEmpty(value) || (value.length === 1 ? isEmpty(value[0]) : false);
        } else {
            // If object, loop over the object to check if it is empty or not
            isEmpt = checkEmptyObject(value);
        }
        return isEmpt; // isEmpty false will break the loop
    });
    return isEmpt;
};

export class ModelVariableManager extends BaseVariableManager {
    /*
    * Case: a LIST type static variable having only one object
    * and the object has all fields empty, remove that object
    */
    removeFirstEmptyObject(variable: any) {
        if (isArray(variable.dataSet) && variable.dataSet.length === 1 && checkEmptyObject(variable.dataSet[0])) {
            variable.dataSet = [];
        }
    }
}
