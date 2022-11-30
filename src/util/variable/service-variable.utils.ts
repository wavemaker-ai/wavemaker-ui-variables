import { extractType, isDefined, isDateTimeType, getBlob, replace } from "../../util/utils";

import { $rootScope, CONSTANTS, SWAGGER_CONSTANTS, VARIABLE_CONSTANTS, WS_CONSTANTS } from '../../constants/variables.constants';
import { isFileUploadSupported } from './variables.utils';
import { getAccessToken } from './../oAuth.utils';
import { formatDate} from "./variables.utils";
import { PaginationUtils } from '../../util/variable/pagination.utils';

// declare const _: any;
import _ from 'lodash';


/**
 * returns true if a Service variable is:
 *  - for a query/procedure
 *  - performs a PUT/POST operation, i.e, takes a Request Body as input
 * @param variable
 * @returns {any}
 */
const isBodyTypeQueryOrProcedure = (variable) => {
    return (_.includes(['QueryExecution', 'ProcedureExecution'], variable.controller)) && (_.includes(['put', 'post'], variable.operationType));
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
    const paramType = _.toLower(extractType(_.get(param, 'items.type') || param.type)),
        paramContentType = CONSTANTS.isStudioMode ? param['x-WM-CONTENT_TYPE'] : param.contentType;
    if (isFileUploadSupported()) {
        if ((paramType !== 'file') && (paramContentType === 'string' || !paramContentType)) {
            if (_.isObject(paramValue)) {
                paramValue = JSON.stringify(paramValue);
            }
            formData.append(param.name, paramValue);
        } else {
            if (_.isArray(paramValue) && paramType === 'file') {
                _.forEach(paramValue, function (fileObject) {
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
const processRequestBody = (inputData, params) => {
    const requestBody = {},
        missingParams = [];
    let paramValue;
    _.forEach(params, function (param) {
        paramValue = _.get(inputData, param.name);
        if (!_.isUndefined(paramValue) && paramValue !== '' && paramValue !== null && !param.readOnly) {
            // ToDo - variable seperation
            paramValue = isDateTimeType(param.type) ? formatDate(paramValue, param.type) : paramValue;
            // Construct ',' separated string if param is not array type but value is an array
            if (_.isArray(paramValue) && _.toLower(extractType(param.type)) === 'string') {
                paramValue = _.join(paramValue, ',');
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
    _.forEach(headers, function (val, key) {
        if (_.includes(UNCLOAKED_HEADERS, key.toUpperCase())) {
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
        } else if (_.isEmpty(operationInfo)) {
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

        securityDefnObj = _.get(operationInfo.securityDefinitions, '0');

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
        _.forEach(operationInfo.parameters, function (param) {
            // Set params based on current workspace
            function setParamsOfChildNode() {
                if (inputFields) {
                    // specific case for body type query/procedure variable with query params
                    if (inputFields[param.name] && _.isObject(inputFields[param.name])) {
                        paramValueInfo = inputFields[param.name];
                    } else {
                        paramValueInfo = inputFields;
                    }
                    params = _.get(operationInfo, ['definitions', param.type]);
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
                    paramValue = formatDate(paramValue, param.type);
                }
                // Construct ',' separated string if param is not array type but value is an array
                if (_.isArray(paramValue) && _.toLower(extractType(param.type)) === 'string' && variable.serviceType === VARIABLE_CONSTANTS.SERVICE_TYPE.DATA) {
                    paramValue = _.join(paramValue, ',');
                }
                switch (param.parameterType.toUpperCase()) {
                    case 'QUERY':
                        // Ignore null valued query params for queryService variable
                        if (_.isNull(paramValue) && isQueryServiceVar(variable.controller, variable.serviceType)) {
                            break;
                        }
                        if (!queryParams) {
                            queryParams = '?' + param.name + '=' + encodeURIComponent(paramValue);
                        } else {
                            queryParams += '&' + param.name + '=' + encodeURIComponent(paramValue);
                        }
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
                            bodyInfo = processRequestBody(paramValueInfo, params);
                            requestBody = bodyInfo.requestBody;
                            requiredParamMissing = _.concat(requiredParamMissing, bodyInfo.missingParams);
                        } else {
                            requestBody = paramValue;
                        }
                        break;
                    case 'FORMDATA':
                        if (isBodyTypeQueryProcedure && param.name === SWAGGER_CONSTANTS.WM_DATA_JSON) {
                            setParamsOfChildNode();
                            // Process query/procedure formData non-file params params
                            bodyInfo = processRequestBody(paramValueInfo, params);
                            requestBody = getFormData(getFormDataObj(), param, bodyInfo.requestBody);
                            requiredParamMissing = _.concat(requiredParamMissing, bodyInfo.missingParams);
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
        if (!_.includes(WS_CONSTANTS.NON_BODY_HTTP_METHODS, _.toUpper(method))) {
            /*Based on the formData browser will automatically set the content type to 'multipart/form-data' and webkit boundary*/
            if (!(operationInfo.consumes && (operationInfo.consumes[0] === WS_CONSTANTS.CONTENT_TYPES.MULTIPART_FORMDATA))) {
                headers['Content-Type'] = (operationInfo.consumes && operationInfo.consumes[0]) || 'application/json';
            }
        }

        // if the consumes has application/x-www-form-urlencoded and
        // if the http request of given method type can have body send the queryParams as Form Data
        if (_.includes(operationInfo.consumes, WS_CONSTANTS.CONTENT_TYPES.FORM_URL_ENCODED)
            && !_.includes(WS_CONSTANTS.NON_BODY_HTTP_METHODS, (method || '').toUpperCase())) {
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
            headers = variable.serviceType !== VARIABLE_CONSTANTS.SERVICE_TYPE.REST || operationInfo.skipCloakHeaders ? headers : cloakHeadersForProxy(headers);
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

    /**
     * This method returns array of query param names for variable other then page,size,sort
     * @params {params} params of the variable
     */
    static excludePaginationParams(params) {
        return _.map(_.reject(params, (param) => {
            return _.includes(VARIABLE_CONSTANTS.PAGINATION_PARAMS, param.name);
        }), function (param) {
            return param.name;
        });
    }
}
