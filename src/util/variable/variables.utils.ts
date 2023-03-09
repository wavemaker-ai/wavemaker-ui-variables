import {findValueOf, getValidJSON, noop, extractType, DataType, DEFAULT_FORMATS} from '../utils';

import { VARIABLE_CONSTANTS } from '../../constants/variables.constants';

declare const window: any, moment;
import _ from 'lodash';
import he from 'he';

export let appManager: any;
export let httpService: any;
export let metadataService: any;
export let navigationService: any;
export let routerService: any;
export let toasterService: any;
export let oauthService: any;
export let securityService: any;
export let dialogService: any;
export let internalBoundNodeMap = new Map();
const timers = new Map();
const DOT_EXPR_REX = /^\[("|')[\w\W]*(\1)\]$/;
const _invoke = (variable, op) => {
    let debouncedFn,
        cancelFn = _.noop,
        retVal;
    if (timers.has(variable)) {
        cancelFn = timers.get(variable).cancel;
    }
    cancelFn();
    debouncedFn = _.debounce(function () {
        retVal = variable[op]();
        // handle promises to avoid uncaught promise errors in console
        if (retVal instanceof Promise) {
            retVal.catch(_.noop);
        }
    }, 100);
    timers.set(variable, debouncedFn);
    debouncedFn();
};

export const wmSetDependency = (type: string, ref: any) => {
    switch (type) {
        case 'appManager':
            appManager = ref;
            break;
        case 'http':
            httpService = ref;
            break;
        case 'metadata':
            metadataService = ref;
            break;
        case 'navigationService':
            navigationService = ref;
            break;
        case 'router':
            routerService = ref;
            break;
        case 'toaster':
            toasterService =  ref;
            break;
        case 'oAuth':
            oauthService =  ref;
            break;
        case 'security':
            securityService =  ref;
            break;
        case 'dialog':
            dialogService = ref;
            break;
    }
};
export const debounceVariableCall = _invoke;
/**
 * returns true if HTML5 File API is available else false
 * @returns {{prototype: Blob; new(blobParts?: any[], options?: BlobPropertyBag): Blob}}
 */
export const isFileUploadSupported = () => {
    // ToDo - variable seperation
    return (window.File && window.FileReader && window.FileList && window.Blob);
};

/**
 * formatting the expression as required by backend which was enclosed by ${<expression>}.
 * @param fieldDefs
 * returns fieldDefs
 */
export const formatExportExpression = (fieldDefs: any) => {
    _.forEach(fieldDefs, function (fieldDef: any) {
        if (fieldDef.expression) {
            fieldDef.expression = '${' + fieldDef.expression + '}';
        }
    });
    return fieldDefs;
};
/**
 * prepare a blob object based on the content and content type provided
 * if content is blob itself, simply returns it back
 * @param val
 * @param valContentType
 * @returns {*}
 */
export const getBlob = (val: any, valContentType?: any) => {
    if (val instanceof Blob) {
        return val;
    }
    const jsonVal = getValidJSON(val);
    if (jsonVal && jsonVal instanceof Object) {
        val = new Blob([JSON.stringify(jsonVal)], { type: valContentType || 'application/json' });
    } else {
        val = new Blob([val], { type: valContentType || 'text/plain' });
    }
    return val;
};
/**
 * sets the value against passed key on the "inputFields" object in the variable
 * @param targetObj: the object in which the key, value is to be set
 * @param variable
 * @param key: can be:
 *  - a string e.g. "username"
 *  - an object, e.g. {"username": "john", "ssn": "11111"}
 * @param val
 * - if key is string, the value against it (for that data type)
 * - if key is object, not required
 * @param options
 * @returns {any}
 */
export const setInput = (targetObj: any, key: any, val: any, options: any) => {
    targetObj = targetObj || {};
    let keys,
        lastKey,
        paramObj = {};

    // content type check
    if (_.isObject(options)) {
        switch (options.type) {
            case 'file':
                val = getBlob(val, options.contentType);
                break;
            case 'number':
                val = _.isNumber(val) ? val : parseInt(val, 10);
                break;
        }
    }

    if (_.isObject(key)) {
        // check if the passed parameter is an object itself
        paramObj = key;
    } else if (key.indexOf('.') > -1) {
        // check for '.' in key e.g. 'employee.department'
        keys = key.split('.');
        lastKey = keys.pop();
        // Finding the object based on the key
        targetObj = findValueOf(targetObj, keys.join('.'), true);
        key = lastKey;
        paramObj[key] = val;
    } else {
        paramObj[key] = val;
    }

    _.forEach(paramObj, function (paramVal: any, paramKey: any) {
        targetObj[paramKey] = paramVal;
    });
    return targetObj;
};

/**
 * This method decodes the variable data which is encoded from backend before showing in the widgets.
 * It takes variable response content as input and iterates recursively,
 * if the value is string type then it will decode the data.
 * @param responseContent (Array of objects)
 */
export const decodeData = (responseContent: any) => {
    if (!responseContent) {
        return responseContent;
    }
    if (_.isArray(responseContent)) {
        _.forEach(responseContent, (data: any) => {
            if (_.isString(data)) {
                data = htmlDecode(data);
            } else if (_.isObject(data)) {
                _.forEach(data, (value: any, key: any) => {
                    if (value && _.isString(value)) {
                        data[key] = htmlDecode(value);
                    } else if (_.isObject(value)) {
                        decodeData(value);
                    }
                });
            }
        });
    } else if (_.isObject(responseContent)) {
        _.forEach(responseContent, (value: any, key: any) => {
            if (value && _.isString(value)) {
                responseContent[key] = htmlDecode(value);
            } else if (_.isObject(value)) {
                decodeData(value);
            }
        });
    } else if (_.isString(responseContent)) {
        responseContent = htmlDecode(responseContent);
        return responseContent;
    }
};

function htmlDecode(input: any) {
    return he.unescape(input);
}

/**
 *
 * @param varOrder
 * @param optionsOrder
 * @returns {any}
 */
export const getEvaluatedOrderBy = (varOrder: any, optionsOrder: any) => {
    let optionFields: any,
        varOrderBy;
    // If options order by is not defined, return variable order
    if (!optionsOrder || _.isEmpty(optionsOrder)) {
        return varOrder;
    }
    // If variable order by is not defined, return options order
    if (!varOrder) {
        return optionsOrder;
    }
    // If both are present, combine the options order and variable order, with options order as precedence
    varOrder     = _.split(varOrder, ',');
    optionsOrder = _.split(optionsOrder, ',');
    optionFields = _.map(optionsOrder, function (order: any) {
        return _.split(_.trim(order), ' ')[0];
    });
    // If a field is present in both options and variable, remove the variable orderby
    _.remove(varOrder, function (orderBy: any) {
        return _.includes(optionFields, _.split(_.trim(orderBy), ' ')[0]);
    });
    varOrderBy = varOrder.length ? ',' + _.join(varOrder, ',') : '';
    return _.join(optionsOrder, ',') + varOrderBy;
};

const processVariablePostBindUpdate = (nodeName, nodeVal, nodeType, variable, noUpdate?) => {
    switch (variable.category) {
        case VARIABLE_CONSTANTS.CATEGORY.LIVE:
            if (variable.operation === 'read') {
                if (nodeName === 'dataBinding') {
                    _.forEach(nodeVal, function (val, key) {
                        variable.filterFields[key] = {
                            'value': val
                        };
                    });
                } else {
                    variable.filterFields[nodeName] = {
                        'value': nodeVal,
                        'type' : nodeType
                    };
                }
                /* if auto-update set for the variable with read operation only, get its data */
                if (variable.autoUpdate && !_.isUndefined(nodeVal) && _.isFunction(variable.listRecords) && !noUpdate) {
                    _invoke(variable, 'listRecords');
                }
            } else {
                if (nodeName === 'dataBinding') {
                    variable.inputFields = nodeVal;
                } else {
                    variable.inputFields[nodeName] = nodeVal;
                }
                /* if auto-update set for the variable with read operation only, get its data */
                if (variable.autoUpdate && !_.isUndefined(nodeVal) && _.isFunction(variable[variable.operation + 'Record']) && !noUpdate) {
                    _invoke(variable, variable.operation + 'Record');
                }
            }
            break;
        case VARIABLE_CONSTANTS.CATEGORY.CRUD:
            if (variable.operationType === 'list' && variable.autoUpdate && !_.isUndefined(nodeVal) && _.isFunction(variable.invoke) && !noUpdate) {
                _invoke(variable, 'invoke');
            }
            break;
        case VARIABLE_CONSTANTS.CATEGORY.SERVICE:
        case VARIABLE_CONSTANTS.CATEGORY.LOGIN:
            if (variable.autoUpdate && !_.isUndefined(nodeVal) && _.isFunction(variable.invoke) && !noUpdate) {
                _invoke(variable, 'invoke');
            }
            break;
        case VARIABLE_CONSTANTS.CATEGORY.DEVICE:
            variable[nodeName] = nodeVal;
            if (variable.autoUpdate && !_.isUndefined(nodeVal) && _.isFunction(variable.invoke) && !noUpdate) {
                _invoke(variable, 'invoke');
            }
            break;
    }
};

/**
* Returns the object node for a bind object, where the value has to be updated
* obj.target = "a"
    * @param obj
* @param root
* @param variable
* @returns {*}
*/
export const getTargetObj = (obj, root, variable) => {
    /*
     * if the target key is in the form as "['my.param']"
     * keep the target key as "my.param" and do not split further
     * this is done, so that, the computed value against this binding is assigned as
     *      {"my.param": "value"}
     * and not as
     *      {
     *          "my": {
     *              "param": "value"
     *          }
     *      }
     */
    let target = obj.target,
        targetObj;
    const rootNode = variable[root];
    if (DOT_EXPR_REX.test(target)) {
        targetObj = rootNode;
    } else {
        target = target.substr(0, target.lastIndexOf('.'));
        if (obj.target === root) {
            targetObj = variable;
        } else if (target) {
            targetObj = findValueOf(rootNode, target, true);
        } else {
            targetObj = rootNode;
        }
    }
    return targetObj;
};

/**
 * Gets the key for the target object
 * the computed value will be updated against this key in the targetObject(computed by getTargetObj())
 * @param target
 * @param regex
 * @returns {*}
 */
export const getTargetNodeKey = (target) => {
    /*
     * if the target key is in the form as "['my.param']"
     * keep the target key as "my.param" and do not split further
     * this is done, so that, the computed value against this binding is assigned as
     *      {"my.param": "value"}
     * and not as
     *      {
     *          "my": {
     *              "param": "value"
     *          }
     *      }
     */
    let targetNodeKey;
    if (DOT_EXPR_REX.test(target)) {
        targetNodeKey = target.replace(/^(\[["'])|(["']\])$/g, '');
    } else {
        targetNodeKey = target.split('.').pop();
    }
    return targetNodeKey;
};

export const setValueToNode = (target, obj, root, variable, value, noUpdate?) => {
    const targetNodeKey = getTargetNodeKey(target),
        targetObj = getTargetObj(obj, root, variable);
    value = !_.isUndefined(value) ? value : obj.value;
    /* sanity check, user can bind parent nodes to non-object values, so child node bindings may fail */
    if (targetObj) {
        targetObj[targetNodeKey] = value;
    }
    processVariablePostBindUpdate(targetNodeKey, value, obj.type, variable, noUpdate);
};

export const getTarget = (variable) => {
    let target;
    switch(variable.category) {
        case VARIABLE_CONSTANTS.CATEGORY.MODEL:
            target = 'dataSet';
            break;
        case VARIABLE_CONSTANTS.CATEGORY.LIVE:
            target = variable.operation === 'read' ? 'filterFields' : 'inputFields';
            break;
        default:
            target = 'dataBinding';
            break;

    }
    return target;
}

/**
 * The model internalBoundNodeMap stores the reference to latest computed values against internal(nested) bound nodes
 * This is done so that the internal node's computed value is not lost, once its parent node's value is computed at a later point
 * E.g.
 * Variable.employeeVar has following bindings
 * "dataBinding": [
 {
         "target": "department.budget",
         "value": "bind:Variables.budgetVar.dataSet"
     },
 {
         "target": "department",
         "value": "bind:Variables.departmentVar.dataSet"
     }
 ]
 * When department.budget is computed, employeeVar.dataSet = {
 *  "department": {
 *      "budget": {"q1": 1111}
 *  }
 * }
 *
 * When department is computed
 *  "department": {
 *      "name": "HR",
 *      "location": "Hyderabad"
 *  }
 * The budget field (computed earlier) is LOST.
 *
 * To avoid this, the latest values against internal nodes (in this case department.budget) are stored in a map
 * These values are assigned back to internal fields if the parent is computed (in this case department)
 * @param target
 * @param root
 * @param variable
 */
export const updateInternalNodes = (target, root, variable) => {
    const boundInternalNodes = _.keys(_.get(internalBoundNodeMap.get(variable), [variable.name, root])),
        targetNodeKey = getTargetNodeKey(target);
    let internalNodes;
    function findInternalNodeBound() {
        return _.filter(boundInternalNodes, function (node) {
            // the later condition in check (targetNodeKey === root || targetNodeKey === 'dataBinding') is specifically for live variable of insert/update types
            return (node !== targetNodeKey && _.includes(node, targetNodeKey)) || ((targetNodeKey === root || targetNodeKey === 'dataBinding') && node !== targetNodeKey);
        });
    }
    internalNodes = findInternalNodeBound();
    if ((internalNodes.length)) {
        _.forEach(internalNodes, function (node) {
            setValueToNode(node, {target: node}, root, variable, _.get(internalBoundNodeMap.get(variable), [variable.name, root, node]));
        });
    }
};

export const initiateCallback = (type: string, variable: any, data: any, options?: any, skipDefaultNotification?: boolean) => {

    /*checking if event is available and variable has event property and variable event property bound to function*/
    const eventValues = variable[type],
        callBackScope = variable._context;
    let errorVariable;
    /**
     * For error event:
     * trigger app level error handler.
     * if no event is assigned, trigger default appNotification variable.
     */
    if (type === VARIABLE_CONSTANTS.EVENT.ERROR && !skipDefaultNotification) {
        if (!eventValues) {
            /* in case of error, if no event assigned, handle through default notification variable */
            errorVariable = callBackScope.Actions[VARIABLE_CONSTANTS.DEFAULT_VAR.NOTIFICATION];
            if (errorVariable) {
                data = errorVariable.getMessage() || data;
                data = _.isString(data) ? data : 'An error has occured. Please check the app logs.';
                errorVariable.invoke({ 'message' : data}, undefined, undefined);
                // $rootScope.$evalAsync(function () {
                // $rootScope.$emit("invoke-service", VARIABLE_CONSTANTS.DEFAULT_VAR.NOTIFICATION, {scope: callBackScope, message: response});
                // });
            }
        }
    }
    // TODO: [Vibhu], check whether to support legacy event calling mechanism (ideally, it should have been migrated)
    // ToDo - variable seperation
   // const fn = $parseEvent(variable[type]);
    const fn = variable[type] || noop;
    if (type === VARIABLE_CONSTANTS.EVENT.BEFORE_UPDATE) {
        if (variable.category === 'wm.LiveVariable' && variable.operation === 'read') {
            return fn(variable._context, {variable: variable, dataFilter: data, options: options});
        } else {
           return fn(variable._context, {variable: variable, inputData: data, options: options});
        }
    } else {
        return fn(variable._context, {variable: variable, data: data, options: options});
    }
};
const getDateTimeFormatForType = (type) => {
    return DEFAULT_FORMATS[_.toUpper(type)];
};

// Format value for datetime types
const _formatDate = (dateValue, type) => {
    let epoch;
    if (_.isDate(dateValue)) {
        epoch = dateValue.getTime();
    } else {
        if (!isNaN(dateValue)) {
            dateValue = parseInt(dateValue, 10);
        }
        epoch = dateValue && moment(dateValue).valueOf();
    }
    if (isNaN(epoch) && type !== DataType.TIME) {
        return epoch;
    }
    if (type === DataType.TIMESTAMP) {
        return epoch;
    }
    if (type === DataType.TIME && !epoch) {
        epoch = moment(new Date().toDateString() + ' ' + dateValue).valueOf();
    }
    return dateValue && appManager.getPipe('date').transform(epoch, getDateTimeFormatForType(type));
};

// Function to convert values of date time types into default formats
export const formatDate = (value, type) => {
    if (_.includes(type, '.')) {
        type = _.toLower(extractType(type));
    }
    if (_.isArray(value)) {
        return _.map(value, function (val) {
            return _formatDate(val, type);
        });
    }
    return _formatDate(value, type);
};