export interface HttpClientService {
    send: (options, variable) => void;
    sendCallAsObservable?: (options) => void;
    getLocale?: () => void;
    sendCall:  (options, variable) => void;
    cancel: (variable, $file?) => void;
    uploadFile: (url: any, data: any, variable: any, options?: any) => void;
}
