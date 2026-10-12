import { NotifyPromise } from './notify-promise';

import {isArray, forEach, isObject, extend} from 'lodash-es';

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
        // ToDo - variable seperation
        variable.httpService.uploadFile(url, cloneFD, variable, {notify: notify}).then((data: any) => {
           resolve(data);
        }, (error: any) => {
            reject(error);
        });
        file._uploadProgress = variable.request;
    });

    return promise;
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
        'paramName' : config.fileParamName
    }, options);
    return uploadWithAjax(files, variable, fd, config.url, options);
}
