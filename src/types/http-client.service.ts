export interface HttpClientService {
    send: (options, variable) => void;
    sendCallAsObservable?: (options) => void;
    getErrMessage?: (err: any) => void;
}
