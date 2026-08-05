import { triggerFn } from './utils';

import { NotifyPromise } from './notify-promise';

import {isArray, forEach, isObject, find, extend} from 'lodash-es';

enum UPLOAD_STATUS {
    QUEUED        = 'queued',
    IN_PROGRESS   = 'inprogress',
    SUCCESS       = 'success',
    ERROR         = 'error',
    ABORTED       = 'abort'
}

function transformEvent(event: any) {
    event.target = event.target || {
        status: event.responseCode,
        response: event.response
    };
    return event;
}

class FileTransferObject {
    name: string;
    size: string;
    status: string;
    transferFn: Function;
    abortFn: Function;
    promise: any;
    progress: number;

    constructor(file: any, transferFn: any, promise: any, abortFn: any) {
        this.name = file.name;
        this.size = file.size || '';
        this.status = UPLOAD_STATUS.QUEUED;
        this.transferFn = transferFn;
        this.promise = promise;
        this.abortFn = abortFn;
    }

    start() {
        if (this.status === UPLOAD_STATUS.QUEUED) {
            this.status = UPLOAD_STATUS.IN_PROGRESS;
            triggerFn(this.transferFn);
        }
    }

    then(onSuccess: any, onError: any, onProgress: any) {
        const self = this;
        this.promise.then(function (event: any) {
            self.status = UPLOAD_STATUS.SUCCESS;
            triggerFn(onSuccess, event);
        }, function (event: any) {
            self.status = UPLOAD_STATUS.ERROR;
            triggerFn(onError, event);
        }, function (event: any) {
            self.progress = Math.round(event.loaded / event.total * 100);
            triggerFn(onProgress, event);
        });
        return this;
    }

    finally(onFinal?: any) {
        this.promise.finally(onFinal);
    }

    /* aborts the file upload */
    abort() {
        this.status = UPLOAD_STATUS.ABORTED;
        triggerFn(this.abortFn);
        this.finally();
    }

}

class AjaxFileTransferObject extends FileTransferObject {
    constructor(file: any, transferFn: any, promise: any, abortFn: any) {
        super(file, transferFn, promise, abortFn);
    }
}

/* upload file using fileTransfer */
function uploadWithFileTransfer(file: any, url: any, options: any) {}

function appendFileToFormData(file: any, fd: any, options: any) {
    /* append file to form data */
    if (isArray(file)) {
        forEach(file, function (fileObject: any) {
            fd.append(options.paramName, fileObject.content || fileObject, fileObject.name);
        });
    } else if (isObject(file)) {
        fd.append(options.paramName, file.content || file, file.name);
    }
}

/* upload file with ajax calling */
function uploadWithAjax(file: any, variable: any, fd: any, url: any, options: any) {
    const cloneFD = new FormData();
    const iterate = (value: any, key: any) => {
        const fileObject = (isArray(value) ? value[0] : value);
        if (!(fileObject instanceof File || fileObject instanceof Blob)) {
            cloneFD.append(key, value);
        }
    };
    // The foreeach method on form data doesn't exist in IE. Hence we check if it exists
    // or else use the lodash forEach
    if (fd.forEach) {
        fd.forEach(iterate);
    } else {
        forEach(fd, iterate);
    }
    appendFileToFormData(file, cloneFD, options);

    const promise = new NotifyPromise((resolve: any, reject: any, notify: any) => {
        const request = variable.invokeHttp
            ? variable.invokeHttp({
                ...options.requestParams,
                url,
                data: cloneFD,
                onUploadProgress: (event: any) => {
                    if (event.total) {
                        notify(Math.round(event.loaded * 100 / event.total));
                    }
                }
            }, options.params)
            : variable.httpService.uploadFile(url, cloneFD, variable, {notify: notify});
        variable.request = request;
        request.then((data: any) => {
           resolve(data);
        }, (error: any) => {
            reject(error);
        });
        file._uploadProgress = variable.request;
    });

    return promise;
}

/* upload the file - IE9 support */
// function uploadWithIframe(file, url, options) {}

/* upload the next file depending on the status */
function starNextFileTransfer(fts: any) {
    const ft = find(fts, function (f: any) {
        return f.status === UPLOAD_STATUS.QUEUED;
    });
    if (ft) {
        ft.start();
        ft.finally(starNextFileTransfer.bind(undefined, fts));
    }
}

/* upload the max no of files at once i.e. two at once based on max*/
function startFileTransfers(fts: any, max: any) {
    let i = 0;
    const len = fts.length;
    while (i < max && i < len) {
        starNextFileTransfer(fts);
        i++;
    }
}

function isMobileApp() {
    return false;
}

/**
 * This function uploads the file to the given url endpoint.
 *
 * @param file file to upload
 * @param url http endpoint to which the file has to be submitted.
 * @param options
 * @returns a promise to listen for success, event, onProgress.
 *  One can also abort the upload by simply calling abort function.
 */
export function upload(files: any, variable: any, fd: any, config: any, options?: any) {
    options = extend({
        'paramName' : config.fileParamName,
        'requestParams': config.requestParams,
        'params': config.params
    }, options);
    return uploadWithAjax(files, variable, fd, config.url, options);
    // let fileTransfers = [],
    //     url = config.uploadUrl;
    // options = extend({
    //     'paramName' : config.fileParamName
    // }, options);
    //
    // if (isMobileApp()) {
    //     forEach(files, function (file) {
    //         fileTransfers.push(uploadWithFileTransfer(file, url, options));
    //     });
    // } else if ((window as any).FormData) {
    //     forEach(files, function (file) {
    //         fileTransfers.push(uploadWithAjax(file, url, options));
    //     });
    // } else {
    //     forEach(files, function (file) {
    //         fileTransfers.push(uploadWithIframe(file, url, options));
    //     });
    // }
    // startFileTransfers(fileTransfers, 2);
    // return fileTransfers;
}
