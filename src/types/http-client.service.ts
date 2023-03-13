export interface HttpClientService {
    send: (options, variable) => void;
    sendCallAsObservable?: (options) => void;
    getLocale?: () => void;
    sendCall:  (options, variable) => void;
}
