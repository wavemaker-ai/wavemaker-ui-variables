// ToDo - variable seperation
export const CONSTANTS = {
    // hasCordova: window['cordova'] !== undefined,
    // isWaveLens: window['WaveLens'] !== undefined,
    isStudioMode: false,
    isRunMode: true,
    XSRF_COOKIE_NAME: 'wm_xsrf_token',
    DEFAULT_TIMER_DELAY: 500,
    WIDGET_DOESNT_EXIST : 'The widget you\'re trying to navigate to doesn\'t exist on this page'
};
export const VARIABLE_CONSTANTS = {
    CATEGORY: {
        MODEL: 'wm.Variable',
        LIVE: 'wm.LiveVariable',
        CRUD: 'wm.CrudVariable',
        SERVICE: 'wm.ServiceVariable',
        WEBSOCKET: 'wm.WebSocketVariable',
        NAVIGATION: 'wm.NavigationAction',
        NOTIFICATION: 'wm.NotificationAction',
        TIMER: 'wm.TimerAction',
        LOGIN: 'wm.LoginAction',
        LOGOUT: 'wm.LogoutAction',
        DEVICE: 'wm.DeviceVariable'
    },
    EVENTS: ['onBefore',
        'onBeforeUpdate',
        'onResult',
        'onBeforeOpen',
        'onOpen',
        'onBeforeMessageSend',
        'onMessageReceive',
        'onProgress',
        'onError',
        'onBeforeDatasetReady',
        'onCanUpdate',
        'onClick',
        'onHide',
        'onOk',
        'onCancel',
        'onBeforeClose',
        'onClose',
        'onTimerFire',
        'onSuccess',
        'onOnline',
        'onOffline'],
    EVENT: {
        'CAN_UPDATE': 'onCanUpdate',
        'BEFORE': 'onBefore',
        'BEFORE_UPDATE': 'onBeforeUpdate',
        'PREPARE_SETDATA': 'onBeforeDatasetReady',
        'RESULT': 'onResult',
        'ERROR': 'onError',
        'ABORT': 'onAbort',
        'PROGRESS': 'onProgress',
        'CLICK': 'onClick',
        'HIDE': 'onHide',
        'OK': 'onOk',
        'CANCEL': 'onCancel',
        'CLOSE': 'onClose',
        'TIMER_FIRE': 'onTimerFire',
        'SUCCESS': 'onSuccess',
        'BEFORE_OPEN': 'onBeforeOpen',
        'OPEN': 'onOpen',
        'BEFORE_SEND': 'onBeforeMessageSend',
        'MESSAGE_RECEIVE': 'onMessageReceive',
        'BEFORE_CLOSE': 'onBeforeClose'
    },
    OWNER: {
        'APP': 'App',
        'PAGE': 'Page'
    },
    REST_SUPPORTED_SERVICES: ['JavaService', 'SoapService', 'FeedService', 'RestService', 'SecurityServiceType', 'DataService', 'WebSocketService', 'OpenAPIService'],
    PAGINATION_PARAMS: ['page', 'size', 'sort'],
    REST_SERVICE: {
        'BASE_PATH_KEY': 'x-WM-BASE_PATH',
        'RELATIVE_PATH_KEY': 'x-WM-RELATIVE_PATH',
        'OAUTH_PROVIDER_KEY': 'x-WM-PROVIDER_ID',
        'AUTH_HDR_KEY': 'Authorization',
        'SECURITY_DEFN': {
            'BASIC': 'basic',
            'OAUTH2': 'oauth2',
        },
        'AUTH_TYPE': {
            'BASIC': 'BASIC',
            'OAUTH': 'OAUTH2',
            'NONE': 'NONE',
        },
        'CONTENT_TYPE_KEY': 'x-WM-CONTENT_TYPE',
        'ACCESSTOKEN_PLACEHOLDER': {
            'LEFT': '',
            'RIGHT': '.access_token'
        },
        ERR_TYPE: {
            NO_ACCESSTOKEN: 'missing_accesstoken',
            NO_CREDENTIALS: 'no_credentials',
            METADATA_MISSING: 'metadata_missing',
            CRUD_OPERATION_MISSING: 'crud_operation_missing',
            USER_UNAUTHORISED: 'user_unauthorised',
            REQUIRED_FIELD_MISSING: 'required_field_missing',
        },
        ERR_MSG: {
            NO_ACCESSTOKEN: 'Access token missing',
            NO_CREDENTIALS: 'No credentials present',
            METADATA_MISSING: 'Metadata missing for "$variable"',
            USER_UNAUTHORISED: 'Unauthorized User',
            CRUD_OPERATION_MISSING: 'Operation "$operation" not allowed for "$variable"',
            REQUIRED_FIELD_MISSING: 'Required field(s) missing: "${0}"'
        },
        UNCLOAKED_HEADERS: ['CONTENT-TYPE', 'ACCEPT', 'CONTENT-LENGTH', 'ACCEPT-ENCODING', 'ACCEPT-LANGUAGE'],
        PREFIX: {
            AUTH_HDR_VAL: {
                BASIC: 'Basic',
                OAUTH: 'Bearer'
            },
            CLOAK_HEADER_KEY: 'X-WM-'
        }
    },
    SERVICE_TYPE: {
        JAVA: 'JavaService',
        REST: 'RestService',
        SOAP: 'SoapService',
        FEED: 'FeedService',
        DATA: 'DataService',
        SECURITY: 'SecurityServiceType',
        WEBSOCKET: 'WebSocketService',
        OPENAPI: 'OpenAPIService'
    },
    CONTROLLER_TYPE: {
        QUERY: 'QueryExecution',
        PROCEDURE: 'ProcedureExecution'
    },
    HTTP_STATUS_CODE: {
        CORS_FAILURE: -1,
        UNAUTHORIZED: 401,
        FORBIDDEN: 403
    },
    EXPORT_TYPES_MAP: {
        'EXCEL' : '.xlsx',
        'CSV' : '.csv'},
    DEFAULT_VAR : {
        'NOTIFICATION' : 'appNotification'
    }
};

export const WS_CONSTANTS = {
    NON_BODY_HTTP_METHODS: ['GET', 'HEAD'],
    CONTENT_TYPES: {
        FORM_URL_ENCODED: 'application/x-www-form-urlencoded',
        MULTIPART_FORMDATA: 'multipart/form-data',
        OCTET_STREAM: 'application/octet-stream'
    }
};

export const DB_CONSTANTS = {
    'DATABASE_MATCH_MODES': {
        'like'             : 'LIKE',
        'start'            : 'STARTING_WITH',
        'startignorecase'  : 'STARTING_WITH_IGNORECASE',
        'end'              : 'ENDING_WITH',
        'endignorecase'    : 'ENDING_WITH_IGNORECASE',
        'anywhere'         : 'CONTAINING',
        'anywhereignorecase': 'CONTAINING_IGNORECASE',
        'nowhere'          : 'DOES_NOT_CONTAIN',
        'nowhereignorecase': 'DOES_NOT_CONTAIN_IGNORECASE',
        'exact'            : 'EQUALS',
        'exactignorecase'  : 'EQUALS_IGNORECASE',
        'notequals'        : 'NOT_EQUALS',
        "notequalsignorecase": "NOT_EQUALS_IGNORECASE",
        'between'          : 'BETWEEN',
        'in'               : 'IN',
        "notin"            : "NOTIN",
        'lessthan'         : 'LESS_THAN',
        'lessthanequal'    : 'LESS_THAN_OR_EQUALS',
        'greaterthan'      : 'GREATER_THAN',
        'greaterthanequal' : 'GREATER_THAN_OR_EQUALS',
        'null'             : 'NULL',
        'isnotnull'        : 'IS_NOT_NULL',
        'empty'            : 'EMPTY',
        'isnotempty'       : 'IS_NOT_EMPTY',
        'nullorempty'      : 'NULL_OR_EMPTY'
    },
    'DATABASE_EMPTY_MATCH_MODES': ['NULL', 'IS_NOT_NULL', 'EMPTY', 'IS_NOT_EMPTY', 'NULL_OR_EMPTY'],
    'DATABASE_RANGE_MATCH_MODES': ['IN', 'NOTIN', 'BETWEEN', 'LESS_THAN', 'LESS_THAN_OR_EQUALS', 'GREATER_THAN', 'GREATER_THAN_OR_EQUALS', 'NOT_EQUALS'],
    'DATABASE_NULL_EMPTY_MATCH': {
        'NULL'          : 'NULL',
        'IS_NOT_NULL'   : 'IS_NOT_NULL',
        'EMPTY'         : 'NULL',
        'IS_NOT_EMPTY'  : 'IS_NOT_NULL',
        'NULL_OR_EMPTY' : 'NULL'
    },
    'DATABASE_MATCH_MODES_WITH_QUERY': {
        'LIKE'                   : '${0} like ${1}',
        'STARTING_WITH'          : '${0} like ${1}',
        'STARTING_WITH_IGNORECASE': '${0} like ${1}',
        'ENDING_WITH'            : '${0} like ${1}',
        'ENDING_WITH_IGNORECASE' : '${0} like ${1}',
        'CONTAINING'             : '${0} like ${1}',
        'CONTAINING_IGNORECASE'  : '${0} like ${1}',
        'DOES_NOT_CONTAIN'       : '${0} not like ${1}',
        'DOES_NOT_CONTAIN_IGNORECASE': '${0} not like ${1}',
        'EQUALS'                 : '${0}=${1}',
        'EQUALS_IGNORECASE'      : '${0}=${1}',
        'NOT_EQUALS'             : '${0}!=${1}',
        "NOT_EQUALS_IGNORECASE"  : "${0}!=${1}",
        'BETWEEN'                : '${0} between ${1}',
        'IN'                     : '${0} in ${1}',
        'NOTIN'                  : "${0} not in ${1}",
        'LESS_THAN'              : '${0}<${1}',
        'LESS_THAN_OR_EQUALS'    : '${0}<=${1}',
        'GREATER_THAN'           : '${0}>${1}',
        'GREATER_THAN_OR_EQUALS' : '${0}>=${1}',
        'NULL'                   : '${0} is null',
        'IS_NOT_NULL'            : '${0} is not null',
        'EMPTY'                  : '${0}=\'\'',
        'IS_NOT_EMPTY'           : '${0}<>\'\'',
        'NULL_OR_EMPTY'          : '(${0} is null or ${0}=\'\')'
    },
    'DATABASE_STRING_MODES': ['LIKE', 'STARTING_WITH', 'STARTING_WITH_IGNORECASE', 'ENDING_WITH', 'ENDING_WITH_IGNORECASE', 'CONTAINING', 'CONTAINING_IGNORECASE', 'DOES_NOT_CONTAIN', 'DOES_NOT_CONTAIN_IGNORECASE', 'EQUALS', 'EQUALS_IGNORECASE', 'NOT_EQUALS', "NOT_EQUALS_IGNORECASE"]
};

export const SWAGGER_CONSTANTS = {
    WM_DATA_JSON: 'wm_data_json',
    WM_HTTP_JSON: 'wm_httpRequestDetails'
};

export const VARIABLE_URLS = {
    DATABASE: {
    searchTableData: {
        url: '/:service/:dataModelName/:entityName/search?page=:page&size=:size&:sort',
            method: 'POST'
    },
    searchTableDataWithQuery: {
        url: '/:service/:dataModelName/:entityName/filter?page=:page&size=:size&:sort',
            method: 'POST',
            headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        }
    },
    readTableData: {
        url: '/:service/:dataModelName/:entityName?page=:page&size=:size&:sort',
            method: 'GET'
    },
    insertTableData: {
        url: '/:service/:dataModelName/:entityName',
            method: 'POST'
    },
    insertMultiPartTableData: {
        url: '/:service/:dataModelName/:entityName',
            method: 'POST',
            headers: {}
            // ,transformRequest: WM.identity
    },
    updateTableData: {
        url: '/:service/:dataModelName/:entityName/:id',
            method: 'PUT'
    },
    updateMultiPartTableData: {
        url: '/:service/:dataModelName/:entityName/:id',
            method: 'POST',
            headers: {}
            // ,transformRequest: WM.identity
    },
    deleteTableData: {
        url: '/:service/:dataModelName/:entityName/:id',
            method: 'DELETE'
    },
    updateCompositeTableData: {
        url: '/:service/:dataModelName/:entityName/composite-id?:id',
            method: 'PUT'
    },
    periodUpdateCompositeTableData: {
        url: '/:service/:dataModelName/:entityName/composite-id/periods?:id',
            method: 'PUT'
    },
    updateMultiPartCompositeTableData: {
        url: '/:service/:dataModelName/:entityName/composite-id?:id',
            method: 'POST',
            headers: {}
            // , transformRequest: WM.identity
    },
    deleteCompositeTableData: {
        url: '/:service/:dataModelName/:entityName/composite-id?:id',
            method: 'DELETE'
    },
    periodDeleteCompositeTableData: {
        url: '/:service/:dataModelName/:entityName/composite-id/periods?:id',
            method: 'DELETE'
    },
    getDistinctDataByFields: {
        url: '/:service/:dataModelName/:entityName/aggregations?page=:page&size=:size&:sort',
            method: 'POST'
    },
    exportTableData: {
        url: '/services/:dataModelName/:entityName/export?:sort',
            method: 'POST'
    },
    readTableRelatedData: {
        url: '/:service/:dataModelName/:entityName/:id/:relatedFieldName?page=:page&size=:size&:sort',
            method: 'GET'
    },
    executeNamedQuery: {
        url: '/:service/:dataModelName/queryExecutor/queries/:queryName?page=:page&size=:size&:queryParams',
            method: 'GET'
    },
    executeCustomQuery: {
        url: '/:service/:dataModelName/queries/execute?page=:page&size=:size',
            method: 'POST'
    },
    executeAggregateQuery: {
        url: '/services/:dataModelName/:entityName/aggregations?page=:page&size=:size&sort=:sort',
            method: 'POST'
    },
    executeNamedProcedure: {
        url: '/:service/:dataModelName/procedureExecutor/procedure/execute/:procedureName?page=:page&size=:size&:procedureParams',
            method: 'GET'
    },
    countTableDataWithQuery: {
        url: '/:service/:dataModelName/:entityName/count?:queryParams',
        method: 'GET'
    }
},
    oauthConfiguration : {
        getAuthorizationUrl: {
            url: 'services/oauth2/:providerId/authorizationUrl',
                method: 'GET'
        }
    }
};

export const $rootScope = {
    project: {
        deployedUrl: './',
        id: 'temp_id'
    },
    projectName: 'test_project_name',
    isApplicationType: true
};
