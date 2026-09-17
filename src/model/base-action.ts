import { DataSource } from "../types/types";
import DatasetUtil from '../util/dataset-util';
import {getTarget, getTargetNodeKey, getTargetObj, setValueToNode} from "../util/variable/variables.utils";
import {getClonedObject} from "../util/utils";

import {isUndefined, includes} from 'lodash-es';
export abstract class BaseAction {

    protected _id: string;

    name: string;
    owner: string;
    category: string;
    dataSet: any;
    dataBinding: any;
    _context: any;
    isMuted = false;

    execute(operation, options) {
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
        }
        return returnVal;
    }

    invokeOnParamChange(obj, newVal, oldVal) {
        const target = obj.target,
            root = getTarget(this),
            targetObj = getTargetObj(obj, root, this),
            targetNodeKey = getTargetNodeKey(target);
        if ((newVal === oldVal && isUndefined(newVal)) || (isUndefined(newVal) && (!isUndefined(oldVal) || !isUndefined(targetObj[targetNodeKey])))) {
            return;
        }
        // Skip cloning for blob column
        if (!includes(['blob', 'file'], obj.type)) {
            newVal = getClonedObject(newVal);
        }
        setValueToNode(target, obj, root, this, newVal); // cloning newVal to keep the source clean
        return Promise.resolve(this);
    }

    getData() {
        return this.dataSet;
    }

    setData(dataSet: any) {
        if (DatasetUtil.isValidDataset(dataSet)) {
            this.dataSet = dataSet;
        }
        return this.dataSet;
    }

    getValue(key: string, index: number) {
        return DatasetUtil.getValue(this.dataSet, key, index);
    }

    setValue(key: string, value: any) {
        return DatasetUtil.setValue(this.dataSet, key, value);
    }

    getItem(index: number) {
        return DatasetUtil.getItem(this.dataSet, index);
    }

    /**
     *
     * @param index, a number in ideal case
     *        it can be the object to be replaced by the passed value
     * @param value
     * @returns {any}
     */
    setItem(index: any, value: any) {
        return DatasetUtil.setItem(this.dataSet, index, value, {isList: false});
    }

    addItem(value: any, index: number) {
        return DatasetUtil.addItem(this.dataSet, value, index, {isList: false});
    }

    removeItem(index: any, exactMatch: boolean) {
        return DatasetUtil.removeItem(this.dataSet, index, exactMatch);
    }

    clearData() {
        this.dataSet = DatasetUtil.getValidDataset();
        return this.dataSet;
    }

    getCount() {
        return DatasetUtil.getCount(this.dataSet);
    }

    init() {
    }

    mute() {
        this.isMuted = true;
    }

    unmute() {
        this.isMuted = false;
    }
}
