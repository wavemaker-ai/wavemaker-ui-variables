import { InterceptContext } from "./intercept-context";
import { Interceptor } from "./interceptor";

export class InterceptorManager {

    private interceptors: Interceptor<any>[] = [];

    add(interceptor: Interceptor<any>) {
        this.interceptors.push(interceptor);
    }

    remove(interceptor: Interceptor<any>) {
        this.interceptors = this.interceptors.filter(i => i !== interceptor);
    }

    filter(contextToMatch: InterceptContext<any>) {
        return this.interceptors.filter(i => i.match(contextToMatch));
    }
}