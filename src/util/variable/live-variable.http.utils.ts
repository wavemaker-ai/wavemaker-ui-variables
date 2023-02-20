import { getClonedObject, removeExtraSlashes } from '../utils';

import { VARIABLE_URLS } from '../../constants/variables.constants';
import { httpService } from './variables.utils';

declare const _;

const isStudioMode = false;

export const parseConfig = (serviceParams: any): any => {

    let val, param, config;
    const urlParams = serviceParams.urlParams;

    /*get the config out of baseServiceManager*/
    if (VARIABLE_URLS.hasOwnProperty(serviceParams.target) && VARIABLE_URLS[serviceParams.target].hasOwnProperty(serviceParams.action)) {
        config = getClonedObject(VARIABLE_URLS[serviceParams.target][serviceParams.action]);

        /*To handle dynamic urls, append the serviceParams.config.url with the static url(i.e., config.url)*/
        if (serviceParams.config) {
            config.url = (serviceParams.config.url || '') + config.url;
            config.method = serviceParams.config.method || config.method;
            config.headers = config.headers || {};

            // TODO[Shubham] - change to for - of
            for (const key in serviceParams.config.headers) {
                val = serviceParams.config.headers[key];
                config.headers[key] = val;
            }
        }
        /* check for url parameters to replace the url */
        if (urlParams) {
            for (param in urlParams) {
                if (urlParams.hasOwnProperty(param)) {
                    val = urlParams[param];
                    if (!_.isUndefined(val) && val !== null) {
                        config.url = config.url.replace(new RegExp(':' + param, 'g'), val);
                    }
                }
            }
        }

        /* check for data */
        if (serviceParams.params) {
            config.params = serviceParams.params;
        }
        /* check for data */
        if (!_.isUndefined(serviceParams.data)) {
            config.data = serviceParams.data;
        }
        /* check for data parameters, written to support old service calls (.json calls) */
        if (serviceParams.dataParams) {
            config.data.params = serviceParams.dataParams;
        }
        /* check for headers */
        if (serviceParams.headers) {
            config.headers = serviceParams.headers;
        }

        /* set extra config flags */
        config.byPassResult    = serviceParams.byPassResult;
        config.isDirectCall    = serviceParams.isDirectCall;
        config.isExtURL        = serviceParams.isExtURL;
        config.preventMultiple = serviceParams.preventMultiple;
        config.responseType    = serviceParams.responseType;

        return config;
    }

    return null;
};

export const generateConnectionParams = (params, action) => {
    let connectionParams,
        urlParams,
        requestData;
    requestData = params.data;

    urlParams = {
        projectID        : params.projectID,
        service          : !_.isUndefined(params.service) ? params.service : 'services',
        dataModelName    : params.dataModelName,
        entityName       : params.entityName,
        queryName        : params.queryName,
        queryParams      : params.queryParams,
        procedureName    : params.procedureName,
        procedureParams  : params.procedureParams,
        id               : params.id,
        relatedFieldName : params.relatedFieldName,
        page             : params.page,
        size             : params.size,
        sort             : params.sort
    };
    connectionParams = {
        target    : 'DATABASE',
        action    : action,
        urlParams : urlParams,
        data      : requestData || '',
        config    : {
            'url' : params.url
        }
    };

    connectionParams = parseConfig(connectionParams);
    // TODO: Remove after backend fix
    connectionParams.url = removeExtraSlashes(connectionParams.url);

    return connectionParams;
};

const initiateAction = (action, params, successCallback?, failureCallback?, noproxy?) => {
    let connectionParams,
        urlParams,
        requestData,
        param,
        val,
        config,
        headers,
        httpDetails;

    /*
    config      = getClonedObject(config[action]);
    headers     = config && config.headers;

    requestData = params.data;

    urlParams = {
        projectID        : params.projectID,
        service          : !_.isUndefined(params.service) ? params.service : 'services',
        dataModelName    : params.dataModelName,
        entityName       : params.entityName,
        queryName        : params.queryName,
        queryParams      : params.queryParams,
        procedureName    : params.procedureName,
        procedureParams  : params.procedureParams,
        id               : params.id,
        relatedFieldName : params.relatedFieldName,
        page             : params.page,
        size             : params.size,
        sort             : params.sort
    };
    */
    if (params.url && isStudioMode && !noproxy) {
/*
        /!* Check for url parameters to replace the URL.
         * So the variable parameters in the URL will be replaced by the actual parameter values.*!/
        if (urlParams) {
            for (param in urlParams) {
                if (urlParams.hasOwnProperty(param)) {
                    val = urlParams[param];
                    if (!_.isUndefined(val) && val !== null) {
                        config.url = config.url.replace(new RegExp(':' + param, 'g'), val);
                    }
                }
            }
        }
        headers = headers || {};
        headers.skipSecurity = 'true';
        headers['Content-Type'] = headers['Content-Type'] || 'application/json';
        /!*(!$rootScope.preferences.workspace.loadXDomainAppDataUsingProxy is added in endpointAddress to differentiate desktop from saas*!/
        if (action === 'testRunQuery') {
            headers['Content-Type'] = undefined;
            httpDetails = {
                'endpointAddress'   : $window.location.protocol + (!$rootScope.preferences.workspace.loadXDomainAppDataUsingProxy ? ('//' + $window.location.host) : '') + params.url + config.url,
                'method'            : config.method,
                'content-Type'      : 'multipart/form-data',
                'headers'           : headers
            };
            requestData.append(SWAGGER_CONSTANTS.WM_HTTP_JSON, new Blob([JSON.stringify(httpDetails)], {
                type: 'application/json'
            }));
            connectionParams = {
                'data': requestData,
                'headers': headers,
                'urlParams'         : {
                    projectID: $rootScope.project.id
                }
            };
        } else {
            connectionParams = {
                'data': {
                    'endpointAddress'   : $window.location.protocol + (!$rootScope.preferences.workspace.loadXDomainAppDataUsingProxy ? ('//' + $window.location.host) : '') + params.url + config.url,
                    'method'            : config.method,
                    'requestBody'       : JSON.stringify(requestData),
                    'headers'           : headers
                },
                'urlParams'         : {
                    projectID: $rootScope.project.id
                }
            };
        }
        WebService.testRestService(connectionParams, function (response) {
            var parsedData = getValidJSON(response.responseBody),
                errMsg,
                localeObject;
            if (parsedData.hasOwnProperty('result')) {
                triggerFn(successCallback, parsedData.result);
            } else if (parsedData.hasOwnProperty('error')) {
                triggerFn(failureCallback, (parsedData.error && parsedData.error.message) || parsedData.error);
            } else if (parsedData.hasOwnProperty('errorDetails')) {
                localeObject = $rootScope.locale || $rootScope.appLocale;
                errMsg = getClonedObject(localeObject[parsedData.errorDetails.code]);
                triggerFn(failureCallback, replace(errMsg, parsedData.errorDetails.data) || parsedData.errorDetails);
            } else {
                triggerFn(successCallback, parsedData);
            }
        }, failureCallback);*/
    } else {
        connectionParams = generateConnectionParams(params, action);
        params.operation = action;
        return httpService.sendCallAsObservable({
            url: connectionParams.url,
            method: connectionParams.method,
            data: connectionParams.data,
            headers: connectionParams.headers
        }, params);
    }
};

export const LVService = {
    searchTableDataWithQuery: (params, successCallback, failureCallback) => initiateAction('searchTableDataWithQuery', params, successCallback, failureCallback),
    executeAggregateQuery: (params, successCallback, failureCallback) => initiateAction('executeAggregateQuery', params, successCallback, failureCallback),
    searchTableData: (params, successCallback, failureCallback) => initiateAction('searchTableData', params, successCallback, failureCallback),
    readTableData: (params, successCallback, failureCallback) => initiateAction('readTableData', params, successCallback, failureCallback),
    insertTableData: (params, successCallback, failureCallback) => initiateAction('insertTableData', params, successCallback, failureCallback),
    insertMultiPartTableData: (params, successCallback, failureCallback) => initiateAction('insertMultiPartTableData', params, successCallback, failureCallback),
    updateTableData: (params, successCallback, failureCallback) => initiateAction('updateTableData', params, successCallback, failureCallback),
    updateCompositeTableData: (params, successCallback, failureCallback) => initiateAction('updateCompositeTableData', params, successCallback, failureCallback),
    periodUpdateCompositeTableData: (params, successCallback, failureCallback) => initiateAction('periodUpdateCompositeTableData', params, successCallback, failureCallback),
    updateMultiPartTableData: (params, successCallback, failureCallback) => initiateAction('updateMultiPartTableData', params, successCallback, failureCallback),
    updateMultiPartCompositeTableData: (params, successCallback, failureCallback) => initiateAction('updateMultiPartCompositeTableData', params, successCallback, failureCallback),
    deleteTableData: (params, successCallback, failureCallback) => initiateAction('deleteTableData', params, successCallback, failureCallback),
    deleteCompositeTableData: (params, successCallback, failureCallback) => initiateAction('deleteCompositeTableData', params, successCallback, failureCallback),
    periodDeleteCompositeTableData: (params, successCallback, failureCallback) => initiateAction('periodDeleteCompositeTableData', params, successCallback, failureCallback),
    exportTableData: params => initiateAction('exportTableData', params),
    getDistinctDataByFields: params => initiateAction('getDistinctDataByFields', params),
    countTableDataWithQuery: (params, successCallback, failureCallback) => initiateAction('countTableDataWithQuery', params, successCallback, failureCallback)
};
