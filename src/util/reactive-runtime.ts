let activeEffect: Function | null = null;
let isBatching = false;
const pendingEffects = new Set<Function>();

export function wmSignal(initialValue: number) {
    let value = initialValue;
    const subscribers = new Set<Function>();

    return {
        get() {
            if (activeEffect) {
                subscribers.add(activeEffect);
            }
            return value;
        },

        set(v: number) {
            if (Object.is(v, value)) return;
            value = v;

            if (isBatching) {
                subscribers.forEach(fn => pendingEffects.add(fn));
            } else {
                subscribers.forEach(fn => fn());
            }
        }
    };
}

export function wmEffect(fn: Function) {
    const runner = () => {
        activeEffect = runner;
        try {
            fn();
        } finally {
            activeEffect = null;
        }
    };

    runner();
    return runner;
}

export function wmBatch(fn: Function) {
    isBatching = true;
    try {
        fn();
    } finally {
        isBatching = false;
        pendingEffects.forEach(fn => fn());
        pendingEffects.clear();
    }
}
