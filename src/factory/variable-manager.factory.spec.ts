import { VariableManagerFactory } from './variable-manager.factory';
import { BaseVariableManager } from '../manager/variable/base-variable.manager';
import { ModelVariableManager } from '../manager/variable/model-variable.manager';
import { ServiceVariableManager } from '../manager/variable/service-variable.manager';
import { LiveVariableManager } from '../manager/variable/live-variable.manager';
import { CrudVariableManager } from '../manager/variable/crud-variable.manager';
import { TimerActionManager } from '../manager/action/timer-action.manager';

describe('VariableManagerFactory', () => {
    it.each([
        ['Variable', BaseVariableManager],
        ['wm.Variable', ModelVariableManager],
        ['wm.ServiceVariable', ServiceVariableManager],
        ['wm.LiveVariable', LiveVariableManager],
        ['wm.CrudVariable', CrudVariableManager],
        ['wm.TimerAction', TimerActionManager],
    ])('returns a %s manager instance for type %s', (type, ctor) => {
        expect(VariableManagerFactory.get(type)).toBeInstanceOf(ctor);
    });

    it('returns the same cached instance on subsequent calls for the same type', () => {
        const first = VariableManagerFactory.get('wm.Variable');
        const second = VariableManagerFactory.get('wm.Variable');
        expect(first).toBe(second);
    });
});
