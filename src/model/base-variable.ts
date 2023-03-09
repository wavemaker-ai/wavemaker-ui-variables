import { DataSource } from '../types/types';

import DatasetUtil from '../util/dataset-util';
import {
    getTargetNodeKey,
    getTargetObj,
    getTarget,
    setValueToNode,
    internalBoundNodeMap,
    updateInternalNodes
} from "../util/variable/variables.utils";
import {getClonedObject} from "../util/utils";
import { EventNotifier, DefaultEventNotifier } from "../types/event-notifier";
declare const _: any;
export enum VariableEvents {
    BEFORE_INVOKE = 'beforeInvoke',
    AFTER_INVOKE = 'afterInvoke'
};
export abstract class BaseVariable implements EventNotifier {

    protected _id: string;

    name: string;
    owner: string;
    category: string;
    isList: boolean;
    dataSet: any;
    dataBinding: any;
    _context: any;
    isMuted = false;
    params;
    paramProvider;
    private eventNotifier = new DefaultEventNotifier();

    notify (event: string, args: any[]) {
        this.eventNotifier.notify(event, args);
    }

    subscribe (event: string, fn: Function) {
        return this.eventNotifier.subscribe(event, fn);
    }

    execute(operation: any, options: any) {
        let returnVal;
        switch (operation) {
            case DataSource.Operation.GET_NAME:
                returnVal = this.name;
                break;
            case DataSource.Operation.GET_UNIQUE_IDENTIFIER:
                returnVal = this._id;
                break;
            case DataSource.Operation.GET_CONTEXT_IDENTIFIER:
                returnVal = this._context;
                break;
            case DataSource.Operation.ADD_ITEM:
                returnVal = this.addItem(options.item, _.omit(options, 'item'));
                break;
            case DataSource.Operation.SET_ITEM:
                returnVal = this.setItem(options.prevItem, options.item,  _.omit(options, 'prevItem', 'item'));
                break;
            case DataSource.Operation.REMOVE_ITEM:
                returnVal = this.removeItem(options.item, _.omit(options, 'item'));
                break;
        }
        return returnVal;
    }

    invokeOnParamChange(obj?, newVal?, oldVal?) {
        const runMode = true;
        if(!obj) {
            return;
        }
        const target = obj?.target,
                root = getTarget(this),
            targetObj = getTargetObj(obj, root, this),
            targetNodeKey = getTargetNodeKey(target);
        if ((newVal === oldVal && _.isUndefined(newVal)) || (_.isUndefined(newVal) && (!_.isUndefined(oldVal) || !_.isUndefined(targetObj[targetNodeKey])))) {
            return;
        }
        // Skip cloning for blob column
        if (!_.includes(['blob', 'file'], obj.type)) {
            newVal = getClonedObject(newVal);
        }
        setValueToNode(target, obj, root, this, newVal); // cloning newVal to keep the source clean
        if (runMode) {
            /*set the internal bound node map with the latest updated value*/
            if (!internalBoundNodeMap.has(this)) {
                internalBoundNodeMap.set(this, {});
            }
            _.set(internalBoundNodeMap.get(this), [this.name, root, target], newVal);
            /*update the internal nodes after internal node map is set*/
            if (_.isObject(newVal)) {
                updateInternalNodes(target, root, this);
            }
        }
        return Promise.resolve(this);
    }

    getData() {
        return this.dataSet;
    }

    setData(dataSet: any) {
        if (DatasetUtil.isValidDataset(dataSet, this.isList)) {
            this.dataSet = dataSet;
        }
        return this.dataSet;
    }

    getValue(key: string, index: number) {
        return DatasetUtil.getValue(this.dataSet, key, index, this.isList);
    }

    setValue(key: string, value: any) {
        return DatasetUtil.setValue(this.dataSet, key, value, this.isList);
    }

    getItem(index: number) {
        return DatasetUtil.getItem(this.dataSet, index, this.isList);
    }

    /**
     *
     * @param index, a number in ideal case
     *        it can be the object to be replaced by the passed value
     * @param value
     * @returns {any}
     */
    setItem(index: any, value: any, options?: any) {
        options = this.getChildDetails(options);
        return DatasetUtil.setItem(this.dataSet, index, value, options);
    }

    /**
     * This method is to get target node options like path, parentIndex and isList
     * @param options: provided options
     * @returns {object}
     * Example: if we have parent dataset as object and we are performing operations on inner list then we have to set isList as true.
     * So finding the target node type and updating the isList option.
     */
    private getChildDetails (options: any) {
        let parentIndex, isList = this.isList, path;
        if (options && options.path) {
            path = options.path;
            let targetNode;
            if (isList) {
                parentIndex = options.parentIndex || 0;
                targetNode =  _.get(this.dataSet[parentIndex], options.path);
            } else {
                targetNode = _.get(this.dataSet, options.path);
            }
            isList = targetNode ? _.isArray(targetNode) ? true : false : true;
        }
        return {path, isList, parentIndex};
    }

    addItem(value: any, options?: any) {
        let index;
        if (_.isNumber(options)) {
            index = options;
        }
        if (_.isObject(options)) {
            index = options.index;
        }

        options = this.getChildDetails(options);
        return DatasetUtil.addItem(this.dataSet, value, index, options);
    }

    removeItem(index: any, options?: any) {
        let exactMatch, parentIndex;
        if (options) {
            if (_.isBoolean(options)) {
                exactMatch = options;
            }
            if (_.isObject(options)) {
                exactMatch = options.exactMatch;
                if (this.isList) {
                    parentIndex = options.parentIndex || 0;
                }
            }
        }
        return DatasetUtil.removeItem(this.dataSet, index, { exactMatch, path: _.get(options, 'path'), parentIndex });
    }

    clearData() {
        this.dataSet = DatasetUtil.getValidDataset(this.isList);
        return this.dataSet;
    }

    getCount() {
        return DatasetUtil.getCount(this.dataSet, this.isList);
    }

    /**
     * Return the prefab name if the variable is form a prefab
     * @returns {string}
     */
    getPrefabName() {
        const prefabname = this._context && (this._context.prefabname || this._context.prefabName);
        // __self__ is a prefab name given to a prefab which is run in preview mode
        return prefabname !== '__self__' && prefabname;
    }

    mute() {
        this.isMuted = true;
    }

    unmute() {
        this.isMuted = false;
    }

    destroy() {
        
    }
}
