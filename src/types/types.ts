export class IDataSource {
    execute: (operation: Operation, options?: any) => boolean | string | Promise<any>;
}

enum Operation {
    LIST_RECORDS = 'listRecords',
    UPDATE_RECORD = 'updateRecord',
    INSERT_RECORD = 'insertRecord',
    DELETE_RECORD = 'deleteRecord',
    INVOKE = 'invoke',
    UPDATE = 'update',
    NOTIFY = 'notify',
    IS_API_AWARE = 'isApiAware',
    SUPPORTS_CRUD = 'supportsCRUD',
    SUPPORTS_DISTINCT_API = 'supportsDistinctAPI',
    IS_PAGEABLE = 'isPageable',
    IS_SORTABLE = "isSortable",
    GET_OPERATION_TYPE = 'getOperationType',
    GET_RELATED_PRIMARY_KEYS = 'getRelatedTablePrimaryKeys',
    GET_ENTITY_NAME = 'getEntityName',
    SET_INPUT = 'setinput',
    GET_RELATED_TABLE_DATA = 'getRelatedTableData',
    GET_DISTINCT_DATA_BY_FIELDS = 'getDistinctDataByFields',
    GET_AGGREGATED_DATA = 'getAggregatedData',
    GET_MATCH_MODE = 'getMatchMode',
    DOWNLOAD = 'download',
    GET_NAME = 'getName',
    GET_PROPERTIES_MAP = 'getPropertiesMap',
    GET_PRIMARY_KEY = 'getPrimaryKey',
    GET_BLOB_URL = 'getBlobURL',
    SUPPORTS_SERVER_FILTER = 'supportsServerFilter',
    GET_OPTIONS = 'getOptions',
    SEARCH_RECORDS = 'searchRecords',
    GET_REQUEST_PARAMS = 'getRequestParams',
    GET_PAGING_OPTIONS = 'getPagingOptions',
    FETCH_DISTINCT_VALUES = 'fetchDistinctValues',
    GET_UNIQUE_IDENTIFIER = 'getUniqueIdentifier',
    GET_CONTEXT_IDENTIFIER = 'getContextIdentifier',
    IS_UPDATE_REQUIRED = 'isUpdateRequired',
    ADD_ITEM = 'addItem',
    SET_ITEM = 'setItem',
    REMOVE_ITEM = 'removeItem',
    IS_BOUND_TO_LOCALE = 'isBoundToLocale',
    GET_DEFAULT_LOCALE = 'getDefaultLocale',
    CANCEL = 'cancel',
    SET_PAGINATION = 'setPagination'
}

export const DataSource = {
    Operation
};