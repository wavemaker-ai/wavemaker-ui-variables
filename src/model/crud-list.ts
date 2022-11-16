import {CrudVariable} from './variable/crud-variable';

export class CRUDList {
    constructor(private variable: CrudVariable, private manager) {
    }
    setInput(key, val?, options?) {
        return this.manager.setInput(this.variable, key, val, options, 'list');
    }
    invoke(options?, success?, error?) {
        options = options || {};
        options.operation = 'list';
        return this.manager.invoke(this.variable, options, success, error);
    }
}
