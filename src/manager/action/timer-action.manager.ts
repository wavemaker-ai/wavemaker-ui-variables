import { isDefined } from '../../util/utils';

import { initiateCallback } from '../../util/variable/variables.utils';
import { CONSTANTS } from '../../constants/variables.constants';

export class TimerActionManager {
    trigger(variable, options, success, error) {
        if (isDefined(variable._promise) || CONSTANTS.isStudioMode) {
            return;
        }
        const repeatTimer = variable.repeating,
            delay = variable.delay || CONSTANTS.DEFAULT_TIMER_DELAY,
            event = 'onTimerFire',
            exec = function () {
                initiateCallback(event, variable, {});
            };

        variable._promise = repeatTimer ? setInterval(exec, delay) : setTimeout(function () {
            exec();
            variable._promise = undefined;
        }, delay);

        /*// destroy the timer on scope destruction
        callBackScope.$on('$destroy', function () {
            variable.cancel(variable._promise);
        });*/

        return variable._promise;
    }

    cancel(variable) {
        if (isDefined(variable._promise)) {
            if (variable.repeating) {
                clearInterval(variable._promise);
            } else {
                clearTimeout(variable._promise);
            }
            variable._promise = undefined;
        }
    }
}
