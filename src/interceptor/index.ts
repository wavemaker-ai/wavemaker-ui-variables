export * from "./interceptor";
export * from "./cache-interceptor";
export * from "./storage";
export * from "./intercept-context";

import { InterceptorManager } from "./interceptor.manager";
import { InterceptService } from "./intercept.service";

const interceptorManager = new InterceptorManager();
const interceptService = new InterceptService(interceptorManager);

export { 
    interceptorManager, 
    interceptService,
};