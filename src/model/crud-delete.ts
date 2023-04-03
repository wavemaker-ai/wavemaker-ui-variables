import {CrudVariable} from './variable/crud-variable';

export class CRUDDelete {
    constructor(private variable: CrudVariable, private manager) {
    }
    setInput(key, val?, options?) {
        return this.manager.setInput(this.variable, key, val, options, 'delete');
    }
    invoke(options?, success?, error?) {
        options = options || {};
        options.operation = 'delete';
        return this.manager.invoke(this.variable, options, success, error);
    }
}
