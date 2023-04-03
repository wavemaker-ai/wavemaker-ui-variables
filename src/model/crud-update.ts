import {CrudVariable} from './variable/crud-variable';

export class CRUDUpdate {
    constructor(private variable: CrudVariable, private manager) {
    }
    setInput(key, val?, options?) {
        return this.manager.setInput(this.variable, key, val, options, 'update');
    }
    invoke(options?, success?, error?) {
        options = options || {};
        options.operation = 'update';
        return this.manager.invoke(this.variable, options, success, error);
    }
}
