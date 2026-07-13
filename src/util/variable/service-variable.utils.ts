import { extractType, isDefined, isDateTimeType, getBlob, replace } from "../../util/utils";

import { $rootScope, CONSTANTS, SWAGGER_CONSTANTS, VARIABLE_CONSTANTS, WS_CONSTANTS } from '../../constants/variables.constants';
import { isFileUploadSupported } from './variables.utils';
import { getAccessToken } from './../oAuth.utils';
import { formatDate} from "./variables.utils";
import { PaginationUtils } from '../../util/variable/pagination.utils';

import {includes, toLower, get, isObject, isArray, forEach, isUndefined, join, isEmpty, isNull, concat, toUpper, map, reject} from 'lodash-es';


/**
 * returns true if a Service variable is:
 *  - for a query/procedure
 *  - performs a PUT/POST operation, i.e, takes a Request Body as input
 * @param variable
 * @returns {any}
 */
const isBodyTypeQueryOrProcedure = (variable) => {
    return (includes(['QueryExecution', 'ProcedureExecution'], variable.controller)) && (includes(['put', 'post'], variable.operationType));
};

const appendQueryParam = (queryParams: string, paramName: string, paramValue: any, preEncoded = false) => {
    const encodedValue = preEncoded ? paramValue : encodeURIComponent(paramValue);
    const pair = `${paramName}=${encodedValue}`;
    return queryParams ? `${queryParams}&${pair}` : `?${pair}`;
};

/**
 * Expands a query param value into the list of {value, preEncoded} entries to append to the
 * URL, based on its collectionFormat:
 *  - 'multi' -> one entry per array element, appended by the caller as repeated query keys
 *               (type=a&type=b)
 *  - any other array -> a single comma-joined value (type=a,b); each element is encoded
 *               individually so the joining commas stay literal (unambiguously the separator)
 *               while a comma inside an element's own value stays escaped as %2C
 *  - scalar values are returned as a single-element list
 */
const getQueryParamValues = (param: any, paramValue: any) => {
    if (isArray(paramValue)) {
        if (param.collectionFormat === 'multi') {
            return map(paramValue, (value) => ({value, preEncoded: false}));
        }
        return [{value: map(paramValue, (value) => encodeURIComponent(value)).join(','), preEncoded: true}];
    }
    return [{value: paramValue, preEncoded: false}];
};

/**
 * returns true if the variable is a Query service variable
 * @param {string} controller
 * @param {string} serviceType
 * @returns {boolean}
 */
const isQueryServiceVar = (controller: string, serviceType: string) => {
    return controller === VARIABLE_CONSTANTS.CONTROLLER_TYPE.QUERY && serviceType === VARIABLE_CONSTANTS.SERVICE_TYPE.DATA;
};

/**
 * Append given value to the formdata
 * @param formData
 * @param param - Param from which value has to be taken
 * @param paramValue - Value which is to be appended to formdata
 */
const getFormData = (formData, param, paramValue) => {
    const paramType = toLower(extractType(get(param, 'items.type') || param.type)),
        paramContentType = CONSTANTS.isStudioMode ? param['x-WM-CONTENT_TYPE'] : param.contentType;
    if (isFileUploadSupported()) {
        if ((paramType !== 'file') && (paramContentType === 'string' || !paramContentType)) {
            if (isObject(paramValue)) {
                paramValue = JSON.stringify(paramValue);
            }
            formData.append(param.name, paramValue);
        } else {
            if (isArray(paramValue) && paramType === 'file') {
                forEach(paramValue, function (fileObject) {
                    formData.append(param.name, (fileObject && fileObject.content) || getBlob(fileObject), fileObject.name);
                });
            } else {
                formData.append(param.name, getBlob(paramValue, paramContentType), paramValue && paramValue.name);
            }
        }
        return formData;
    }
};

/**
 * Check for missing required params and format the date/time param values
 * @param inputData
 * @param params
 * @returns {{requestBody: {}; missingParams: any[]}}
 */
const processRequestBody = (inputData, params, variable) => {
    const requestBody = {},
        missingParams = [];
    let paramValue;
    forEach(params, function (param) {
        paramValue = get(inputData, param.name);
        if (!isUndefined(paramValue) && paramValue !== '' && paramValue !== null && !param.readOnly) {
            // ToDo - variable seperation
            paramValue = isDateTimeType(param.type) ? formatDate(paramValue, param.type, variable.dateFormatter) : paramValue;
            // Construct ',' separated string if param is not array type but value is an array
            if (isArray(paramValue) && toLower(extractType(param.type)) === 'string') {
                paramValue = join(paramValue, ',');
            }
            requestBody[param.name] = paramValue;
        } else if (param.required) {
            missingParams.push(param.name || param.id);
        }
    });
    return {
        'requestBody': requestBody,
        'missingParams': missingParams
    };
};

/**
 * Done only for HTTP calls made via the proxy server
 * Goes though request headers, appends 'X-' to certain headers
 * these headers need not be processed at proxy server and should directly be passed to the server
 * e.g. Authorization, Cookie, etc.
 * @param headers
 * @returns {{}}
 */
const cloakHeadersForProxy = (headers) => {
    const _headers = {},
        UNCLOAKED_HEADERS = VARIABLE_CONSTANTS.REST_SERVICE.UNCLOAKED_HEADERS,
        CLOAK_PREFIX = VARIABLE_CONSTANTS.REST_SERVICE.PREFIX.CLOAK_HEADER_KEY;
    forEach(headers, function (val, key) {
        if (includes(UNCLOAKED_HEADERS, key.toUpperCase())) {
            _headers[key] = val;
        } else {
            _headers[CLOAK_PREFIX + key] = val;
        }
    });

    return _headers;
};

export class ServiceVariableUtils {
    /**
     * prepares the HTTP request info for a Service Variable
     * @param variable
     * @param operationInfo
     * @param inputFields
     * @returns {any}
     */
    static constructRequestParams(variable, operationInfo, inputFields, options?) {
        variable = variable || {};

        // operationInfo is specifically null for un_authorized access
        if (operationInfo === null) {
            return {
                'error' : {
                    'type': VARIABLE_CONSTANTS.REST_SERVICE.ERR_TYPE.USER_UNAUTHORISED,
                    'message': VARIABLE_CONSTANTS.REST_SERVICE.ERR_MSG.USER_UNAUTHORISED,
                    'field': '_wmServiceOperationInfo'
                }
            };
        } else if (isEmpty(operationInfo)) {
            return {
                'error' : {
                    'type': VARIABLE_CONSTANTS.REST_SERVICE.ERR_TYPE.METADATA_MISSING,
                    'message': VARIABLE_CONSTANTS.REST_SERVICE.ERR_MSG.METADATA_MISSING,
                    'field': '_wmServiceOperationInfo'
                }
            };
        } else if (operationInfo && operationInfo.invalid) {
            return {
                'error' : {
                    'type': VARIABLE_CONSTANTS.REST_SERVICE.ERR_TYPE.CRUD_OPERATION_MISSING,
                    'message': VARIABLE_CONSTANTS.REST_SERVICE.ERR_MSG.CRUD_OPERATION_MISSING,
                    'field': '_wmServiceOperationInfo'
                }
            };
        }

        const directPath = operationInfo.directPath || '',
            relativePath = operationInfo.basePath ? operationInfo.basePath + operationInfo.relativePath : operationInfo.relativePath,
            isBodyTypeQueryProcedure = isBodyTypeQueryOrProcedure(variable);
        let queryParams = '',
            bodyInfo,
            headers = {},
            requestBody,
            url,
            requiredParamMissing = [],
            target,
            pathParamRex,
            invokeParams,
            authDetails = null,
            uname,
            pswd,
            method,
            formData,
            isProxyCall,
            paramValueInfo,
            params,
            securityDefnObj,
            accessToken,
            withCredentials;

        function getFormDataObj() {
            if (formData) {
                return formData;
            }
            formData = new FormData();
            return formData;
        }

        securityDefnObj = get(operationInfo.securityDefinitions, '0');

        if (securityDefnObj) {
            switch (securityDefnObj.type) {
                case VARIABLE_CONSTANTS.REST_SERVICE.SECURITY_DEFN.OAUTH2:
                    accessToken = getAccessToken(securityDefnObj[VARIABLE_CONSTANTS.REST_SERVICE.OAUTH_PROVIDER_KEY], null);
                    if (accessToken) {
                        headers[VARIABLE_CONSTANTS.REST_SERVICE.AUTH_HDR_KEY] = VARIABLE_CONSTANTS.REST_SERVICE.PREFIX.AUTH_HDR_VAL.OAUTH + ' ' + accessToken;
                    } else {
                        return {
                            'error': {
                                'type' : VARIABLE_CONSTANTS.REST_SERVICE.ERR_TYPE.NO_ACCESSTOKEN,
                                'message' : VARIABLE_CONSTANTS.REST_SERVICE.ERR_MSG.NO_ACCESSTOKEN
                            },
                            'securityDefnObj': securityDefnObj
                        };
                    }
                    break;
                case VARIABLE_CONSTANTS.REST_SERVICE.SECURITY_DEFN.BASIC:
                    uname = inputFields['wm_auth_username'];
                    pswd = inputFields['wm_auth_password'];
                    if (uname && pswd) {
                        // TODO[VIBHU]: bas64 encoding alternative.
                        headers[VARIABLE_CONSTANTS.REST_SERVICE.AUTH_HDR_KEY] = VARIABLE_CONSTANTS.REST_SERVICE.PREFIX.AUTH_HDR_VAL.BASIC + ' ' + btoa(uname + ':' + pswd);
                        authDetails = {
                            'type': VARIABLE_CONSTANTS.REST_SERVICE.AUTH_TYPE.BASIC
                        };
                    } else {
                        return {
                            'error': {
                                'type' : VARIABLE_CONSTANTS.REST_SERVICE.ERR_TYPE.NO_CREDENTIALS,
                                'message': VARIABLE_CONSTANTS.REST_SERVICE.ERR_MSG.NO_CREDENTIALS
                            },
                            'securityDefnObj': securityDefnObj
                        };
                    }
                    break;
            }
        }
        // set query params, if pagination info is present and the info should be present in query
        PaginationUtils.checkPaginationAtQuery(operationInfo, variable, options);

        operationInfo.proxySettings = operationInfo.proxySettings || {web: true, mobile: false};
        method = operationInfo.httpMethod || operationInfo.methodType;
        isProxyCall = (function () {
            // ToDo - variable seperation
            // if (CONSTANTS.hasCordova) {
                return operationInfo.proxySettings.mobile;
            // }
            return operationInfo.proxySettings.web;
        }());
        withCredentials = operationInfo.proxySettings.withCredentials;
        url = isProxyCall ? relativePath : directPath;

        /* loop through all the parameters */
        forEach(operationInfo.parameters, function (param) {
            // Set params based on current workspace
            function setParamsOfChildNode() {
                if (inputFields) {
                    // specific case for body type query/procedure variable with query params
                    if (inputFields[param.name] && isObject(inputFields[param.name])) {
                        paramValueInfo = inputFields[param.name];
                    } else {
                        paramValueInfo = inputFields;
                    }
                    params = get(operationInfo, ['definitions', param.type]);
                } else {
                    // For Api Designer
                    paramValueInfo = paramValue || {};
                    params = param.children;
                }
            }

            let paramValue = param.sampleValue;

            if ((isDefined(paramValue) && paramValue !== null && paramValue !== '') || (isBodyTypeQueryProcedure && param.type !== 'file')) {
                // Format dateTime params for dataService variables
                if (variable.serviceType === VARIABLE_CONSTANTS.SERVICE_TYPE.DATA && isDateTimeType(param.type)) {
                    // ToDo - variable seperation
                    paramValue = formatDate(paramValue, param.type, variable.dateFormatter);
                }
                // Construct ',' separated string if param is not array type but value is an array
                if (isArray(paramValue) && toLower(extractType(param.type)) === 'string' && variable.serviceType === VARIABLE_CONSTANTS.SERVICE_TYPE.DATA) {
                    paramValue = join(paramValue, ',');
                }
                switch (param.parameterType.toUpperCase()) {
                    case 'QUERY':
                        // Ignore null valued query params for queryService variable
                        if (isNull(paramValue) && isQueryServiceVar(variable.controller, variable.serviceType)) {
                            break;
                        }
                        /* A query param may resolve to multiple values (collectionFormat 'multi').
                         * getQueryParamValues returns one entry per repeated key, so append each as
                         * a separate name=value pair (type=a&type=b) instead of a single joined value. */
                        getQueryParamValues(param, paramValue).forEach(({value: queryValue, preEncoded}) => {
                            if (isNull(queryValue) && isQueryServiceVar(variable.controller, variable.serviceType)) {
                                return;
                            }
                            queryParams = appendQueryParam(queryParams, param.name, queryValue, preEncoded);
                        });
                        break;
                    case 'PATH':
                        /* replacing the path param based on the regular expression in the relative path */
                        pathParamRex = new RegExp('\\s*\\{\\s*' + param.name + '(:\\.\\+)?\\s*\\}\\s*');
                        url = url.replace(pathParamRex, paramValue);
                        break;
                    case 'HEADER':
                        headers[param.name] = paramValue;
                        break;
                    case 'BODY':
                        // For post/put query methods wrap the input
                        if (isBodyTypeQueryProcedure) {
                            setParamsOfChildNode();
                            bodyInfo = processRequestBody(paramValueInfo, params, variable);
                            requestBody = bodyInfo.requestBody;
                            requiredParamMissing = concat(requiredParamMissing, bodyInfo.missingParams);
                        } else {
                            requestBody = paramValue;
                        }
                        break;
                    case 'FORMDATA':
                        if (isBodyTypeQueryProcedure && param.name === SWAGGER_CONSTANTS.WM_DATA_JSON) {
                            setParamsOfChildNode();
                            // Process query/procedure formData non-file params params
                            bodyInfo = processRequestBody(paramValueInfo, params, variable);
                            requestBody = getFormData(getFormDataObj(), param, bodyInfo.requestBody);
                            requiredParamMissing = concat(requiredParamMissing, bodyInfo.missingParams);
                        } else if(operationInfo?.consumes && operationInfo.consumes[0] === WS_CONSTANTS.CONTENT_TYPES.FORM_URL_ENCODED) {
                            // when the content-type is 'application/x-www-form-urlencoded'
                            requestBody = (requestBody && requestBody.length > 0 ? `${requestBody}&` : '') 
                                + `${encodeURIComponent(param.name)}=${encodeURIComponent(param.sampleValue)}`;
                        } else {
                            requestBody = getFormData(getFormDataObj(), param, paramValue);
                        }
                        break;
                }
            } else if (param.required) {
                requiredParamMissing.push(param.name || param.id);
            }
        });

        // if required param not found, return error
        if (requiredParamMissing.length) {
            return {
                'error': {
                    'type': VARIABLE_CONSTANTS.REST_SERVICE.ERR_TYPE.REQUIRED_FIELD_MISSING,
                    'field': requiredParamMissing.join(','),
                    'message': replace(VARIABLE_CONSTANTS.REST_SERVICE.ERR_MSG.REQUIRED_FIELD_MISSING, [requiredParamMissing.join(',')]),
                    'skipDefaultNotification': true
                }
            };
        }

        // Setting appropriate content-Type for request accepting request body like POST, PUT, etc
        if (!includes(WS_CONSTANTS.NON_BODY_HTTP_METHODS, toUpper(method))) {
            /*Based on the formData browser will automatically set the content type to 'multipart/form-data' and webkit boundary*/
            if (!(operationInfo.consumes && (operationInfo.consumes[0] === WS_CONSTANTS.CONTENT_TYPES.MULTIPART_FORMDATA))) {
                headers['Content-Type'] = (operationInfo.consumes && operationInfo.consumes[0]) || 'application/json';
            }
        }

        // if the consumes has application/x-www-form-urlencoded and
        // if the http request of given method type can have body send the queryParams as Form Data
        if (includes(operationInfo.consumes, WS_CONSTANTS.CONTENT_TYPES.FORM_URL_ENCODED)
            && !includes(WS_CONSTANTS.NON_BODY_HTTP_METHODS, (method || '').toUpperCase())) {
            // remove the '?' at the start of the queryParams
            if (queryParams) {
                requestBody = (requestBody ? requestBody + '&' : '') + queryParams.substring(1);
            }
            headers['Content-Type'] = WS_CONSTANTS.CONTENT_TYPES.FORM_URL_ENCODED;
        } else {
            url += queryParams;
        }

        /*
         * for proxy calls:
         *  - cloak the proper headers (required only for REST services)
         *  - prepare complete url from relativeUrl
         */
        if (isProxyCall) {
            // avoiding cloakHeadersForProxy when the method is invoked from apidesigner.
            headers = (variable.serviceType !== VARIABLE_CONSTANTS.SERVICE_TYPE.REST && variable.serviceType !== VARIABLE_CONSTANTS.SERVICE_TYPE.OPENAPI) || operationInfo.skipCloakHeaders ? headers : cloakHeadersForProxy(headers);
            if (variable.getPrefabName() && VARIABLE_CONSTANTS.REST_SUPPORTED_SERVICES.indexOf(variable.serviceType) !== -1) {
                /* if it is a prefab variable (used in a normal project), modify the url */
                url = 'prefabs/' + variable.getPrefabName() + url;
                target = 'invokePrefabRestService';
            } else if (!variable.getPrefabName()) {
                url = 'services' + url;
            }
            url = $rootScope.project.deployedUrl + url;
        }

        // If pagination info exists, process info in request headers or body based on the metadata
        const paginationInfo = PaginationUtils.getPaginationInfo(operationInfo, variable);
        if (paginationInfo && variable.pagination) {
            const resp = PaginationUtils.setPaginationAtReq(paginationInfo, operationInfo, variable, headers, requestBody, url, options);
            if (resp) {
                if (resp['headers']) {
                    headers = resp['headers'];
                } else if (resp['requestBody']) {
                    requestBody = resp['requestBody']
                } else if (resp['url']) {
                    url = resp['url']
                }
            }
        }

        /*creating the params needed to invoke the service. url is generated from the relative path for the operation*/
        invokeParams = {
            'projectID': $rootScope.project.id,
            'url': url,
            'target': target,
            'method': method,
            'headers': headers,
            'data': requestBody,
            'authDetails': authDetails,
            'isDirectCall': !isProxyCall,
            'isExtURL': variable.serviceType === VARIABLE_CONSTANTS.SERVICE_TYPE.REST,
            'withCredentials': withCredentials
        };

        return invokeParams;
    }

    static isFileUploadRequest(variable) {
        // temporary fix, have to find proper solution for deciding weather to upload file through variable
        return variable.service === 'FileService' && variable.operation === 'uploadFile';
    }

    static isFileDeleteRequest(variable) {
        return variable.service === 'FileService' && variable.operation === 'deleteFile';
    }

    /**
     * This method returns array of query param names for variable other then page,size,sort
     * @params {params} params of the variable
     */
    static excludePaginationParams(params) {
        return map(reject(params, (param) => {
            return includes(VARIABLE_CONSTANTS.PAGINATION_PARAMS, param.name);
        }), function (param) {
            return param.name;
        });
    }
}
