import { httpService } from "../../util/variable/variables.utils";
import { appManager } from "./../../util/variable/variables.utils";
import { AdvancedOptions } from "../../advanced-options";

import { extend } from "lodash-es";

export abstract class BaseVariableManager {
  initBinding(variable: any, bindSource?: any, bindTarget?: any) {
    // processBinding(variable, variable._context, bindSource, bindTarget);
    // ToDo - variable seperation
  }

  notifyInflight(variable: any, status: boolean, data?: any, options?: any) {
    // ToDo - variable seperation
    appManager &&
      appManager.notify("toggle-variable-state", {
        variable: variable,
        active: status,
        data: data,
        options: options,
      });
  }

  /**
   * This method sets the variable parameter requestTrackId to X-WM-Request-Track-Id which is received in the response headers.
   * @param response
   */
  setRequestTrackId(response: any = {}, variable: any) {
    response.headers = response.headers || {};
    const requestTrackId =
      (response.headers.get && response.headers.get("x-wm-request-track-id")) ||
      response.headers["x-wm-request-track-id"];
    if (requestTrackId) {
      variable._requestTrackId = requestTrackId;
    }
  }

  protected isCanceledRequest(error: any): boolean {
    const cause = error && (error.details || error);
    return !!(
      cause &&
      (cause.code === "ERR_CANCELED" ||
        cause.name === "CanceledError" ||
        cause.name === "AbortError" ||
        cause.__CANCEL__ === true)
    );
  }

  /**
   * This method makes the final angular http call that returns an observable.
   * We attach this observable to variable to cancel a network call
   * @param requestParams
   * @param variable
   * @param dbOperation
   */
  // ToDo - variable seperation
  httpCall(requestParams, variable, params?: any) {
    return new Promise((resolve, reject) => {
      // send _source info, to identify the call is invoked from framework
      requestParams["_source"] = "variable";

      if (variable.invokeHttp) {
        variable.invokeHttp(requestParams, params).then(
          (response: any) => {
            if ((response && response.type) || (response && response.status)) {
              this.setRequestTrackId(response, variable);
              resolve(response);
            }
          },
          (err: any) => {
            this.setRequestTrackId(err, variable);
            if (
              variable.httpService.isPlatformSessionTimeout &&
              variable.httpService.isPlatformSessionTimeout(err)
            ) {
              // send the notification manually to hide any context spinners on page.
              // [TODO]: any spinners on widget listening on this variable will also go off. Need to see an approach to sovle that.
              this.notifyInflight(variable, false, err);
              err._401Subscriber.asObservable().subscribe(
                (response) => resolve(response),
                (e) => reject(e),
              );
            } else {
              reject(err);
            }
          },
        );
        return;
      }

      variable.httpService.sendCall(requestParams, variable, params).then(
        (response: any) => {
          if ((response && response.type) || (response && response.status)) {
            this.setRequestTrackId(response, variable);
            resolve(response);
          }
        },
        (err: any) => {
          this.setRequestTrackId(err, variable);
          if (
            variable.httpService.isPlatformSessionTimeout &&
            variable.httpService.isPlatformSessionTimeout(err)
          ) {
            // send the notification manually to hide any context spinners on page.
            // [TODO]: any spinners on widget listening on this variable will also go off. Need to see an approach to sovle that.
            this.notifyInflight(variable, false, err);
            err._401Subscriber.asObservable().subscribe(
              (response) => resolve(response),
              (e) => reject(e),
            );
          } else {
            reject(err);
          }
        },
      );
    });
  }

  /**
   * This method prepares the options parameter for variable callbacks.
   * @param xhrObj, The xhrObj to be passed
   * @param moreOptions, any other info to be passed in the options param
   */
  prepareCallbackOptions(xhrObj: any, moreOptions?: any): AdvancedOptions {
    let options: AdvancedOptions = {};
    options["xhrObj"] = xhrObj;
    if (moreOptions) {
      extend(options, moreOptions);
    }
    return options;
  }
}
