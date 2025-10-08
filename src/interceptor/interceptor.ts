import { InterceptContext } from "./intercept-context";

export interface Interceptor<IC extends InterceptContext<any>> {
  match: (context: IC) => boolean;
  intercept: (context: IC) => Promise<any>;
}

export abstract class BaseInterceptor<IC extends InterceptContext<any>> implements Interceptor<IC> {

  constructor(protected options: {
    match?: (context: IC) => boolean;
    intercept?: (context: IC) => Promise<any>;
  }) {
  }

  match(context: IC) {
    return !!this.options.match?.(context);
  }

  abstract intercept(context: IC): Promise<any>;
}
