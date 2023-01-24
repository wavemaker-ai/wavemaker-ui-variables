import { BaseVariableManager } from './base-variable.manager';

declare const _: any;

const checkEmptyObject = (obj: any) => {
    let isEmpty = true;
    _.forEach(obj, (value: any) => {
        if (_.isEmpty(value) && !_.isBoolean(value) && !_.isNumber(value)) {
          return;
        }
        if (!_.isObject(value)) {
            isEmpty = false;
        } else if (_.isArray(value)) {
            // If array, check if array is empty or if it has only one value and the value is empty
            isEmpty = _.isEmpty(value) || (value.length === 1 ? _.isEmpty(value[0]) : false);
        } else {
            // If object, loop over the object to check if it is empty or not
            isEmpty = checkEmptyObject(value);
        }
        return isEmpty; // isEmpty false will break the loop
    });
    return isEmpty;
};

export class ModelVariableManager extends BaseVariableManager {
    /*
    * Case: a LIST type static variable having only one object
    * and the object has all fields empty, remove that object
    */
    removeFirstEmptyObject(variable: any) {
        if (_.isArray(variable.dataSet) && variable.dataSet.length === 1 && checkEmptyObject(variable.dataSet[0])) {
            variable.dataSet = [];
        }
    }
}
