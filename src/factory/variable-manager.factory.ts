import { ServiceVariableManager } from '../manager/variable/service-variable.manager';
import { ModelVariableManager } from '../manager/variable/model-variable.manager';
import { LiveVariableManager } from '../manager/variable/live-variable.manager';
import { CrudVariableManager } from '../manager/variable/crud-variable.manager';
import { BaseVariableManager } from '../manager/variable/base-variable.manager';
import { TimerActionManager } from '../manager/action/timer-action.manager';

const managerMap = new Map(),
    typeToManagerMap = {
        'Variable': BaseVariableManager,
        'wm.Variable': ModelVariableManager,
        'wm.ServiceVariable': ServiceVariableManager,
        'wm.LiveVariable': LiveVariableManager,
        'wm.CrudVariable': CrudVariableManager,
        'wm.TimerVariable': TimerActionManager,
    };

export class VariableManagerFactory {

    static get(type: any) {
        return managerMap.has(type) ?
            managerMap.get(type) :
            managerMap.set(type, new typeToManagerMap[type]()).get(type);
    }
}
