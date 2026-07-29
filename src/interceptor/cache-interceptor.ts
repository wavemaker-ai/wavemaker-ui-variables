import { InterceptContext } from "./intercept-context";
import { BaseInterceptor, Interceptor } from "./interceptor";

const DEFAULT_CACHE_TIMEOUT = 5 * 60 * 1000;

export class CacheInterceptor<IC extends InterceptContext<any>> extends BaseInterceptor<IC> {
  
    constructor(
        private interceptor: Interceptor<IC>, 
        private cacheType: 'session' | 'persistent' = 'session',
        private cacheTimeout = DEFAULT_CACHE_TIMEOUT,
        private passThrough = false
    ) {
        super({});
    }

    match(context: IC) {
        return !!this.interceptor?.match?.(context);
    }
  
    async intercept(context: IC) {
        let store = context.stores.session;
        if(this.cacheType === 'persistent') {
            store = context.stores.persistent;
        }
        const cacheData = await store.getItem("response");
        if (cacheData) {
            context.variable.dataSet = cacheData;
            if (!this.passThrough) {
                return cacheData;
            }
        }
        const data = await this.interceptor.intercept(context);
        await store.setItem("response", data, this.cacheTimeout);
        return data;
    }
}
