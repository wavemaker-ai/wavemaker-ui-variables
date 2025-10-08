import { InterceptorManager } from "./interceptor.manager";

export class InterceptService {
    
    constructor(private interceptorManager: InterceptorManager) {

    }

    async intercept(context: any) {
        const matchingInterceptors = this.interceptorManager.filter(context);
        if (matchingInterceptors.length === 0) {
            return context.proceed();
        }
        await Promise.all(matchingInterceptors
            .map(async interceptor => await interceptor.intercept(context)));
        return context.variable.dataSet;
    }
}