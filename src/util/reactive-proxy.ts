export function reactiveProxy<T extends object>(obj: T): T {
    return new Proxy(obj, {
        get(target, key) {
            const value = target[key as keyof T];
            if (value && typeof (value as any).track === 'function') {
                (value as any).track();
            }
            return value;
        }
    });
}

export function createReactiveVariables(variables: any) {
    return new Proxy(variables, {
        get(target, prop, receiver) {
            const value = Reflect.get(target, prop, receiver);
            if (prop === 'dataSet' && target && typeof target.track === 'function') {
                target.track();
            }
            return value;
        }
    });
}
