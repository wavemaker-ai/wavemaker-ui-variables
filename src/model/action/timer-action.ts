import { BaseAction } from '../base-action';
import { VARIABLE_CONSTANTS } from '../../constants/variables.constants';
import { VariableManagerFactory } from '../../factory/variable-manager.factory';

const  getManager = () => {
    return VariableManagerFactory.get(VARIABLE_CONSTANTS.CATEGORY.TIMER);
};

export class TimerAction extends BaseAction {
    private currentOptions;
    private repeating = false;
    private _isFired = false;

    constructor(variable: any) {
        super();
        Object.assign(this, variable);
    }

    // Backward compatible method
    fire(options, success, error) {
        if(this.repeating) {
            this.currentOptions = options;
            this._isFired = true;
        }
        return getManager().trigger(this, options, success, error);
    }

    invoke(options, success, error) {
        return this.fire(options, success, error);
    }

    cancel() {
        return getManager().cancel(this);
    }

    mute() {
        super.mute();
        if(this.repeating) {
            this.cancel();
        }
    }

    unmute() {
        super.unmute();
        if(this.repeating && this._isFired) {
            this.fire(this.currentOptions, null, null);
        }
    }
}
