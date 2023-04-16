// declare const X2JS: any;
// @ts-ignore
import X2JS from 'x2js';
import _ from 'lodash';
export const DataType = {
    INTEGER : 'integer',
    BIG_INTEGER : 'big_integer',
    SHORT : 'short',
    FLOAT : 'float',
    BIG_DECIMAL : 'big_decimal',
    DOUBLE : 'double',
    LONG : 'long',
    BYTE : 'byte',
    STRING : 'string',
    CHARACTER : 'character',
    TEXT : 'text',
    DATE : 'date',
    TIME : 'time',
    TIMESTAMP : 'timestamp',
    DATETIME : 'datetime',
    LOCALDATETIME : 'localdatetime',
    BOOLEAN : 'boolean',
    LIST : 'list',
    CLOB : 'clob',
    BLOB : 'blob'
}
export const DEFAULT_FORMATS = {
    DATE : "yyyy-MM-dd",
    TIME : "HH:mm:ss",
    TIMESTAMP : "timestamp",
    DATETIME : "yyyy-MM-ddTHH:mm:ss",
    LOCALDATETIME : "yyyy-MM-ddTHH:mm:ss",
    DATETIME_ORACLE : "yyyy-MM-dd HH:mm:ss",
    DATE_TIME : "yyyy-MM-dd HH:mm:ss"
}
const REGEX = {
    SNAKE_CASE: /[A-Z]/g,
    ANDROID: /Android/i,
    IPHONE: /iPhone/i,
    IPOD: /iPod/i,
    IPAD: /iPad/i,
    MAC: /Mac/i,
    ANDROID_TABLET: /android|android 3.0|xoom|sch-i800|playbook|tablet|kindle/i,
    MOBILE: /Mobile/i,
    WINDOWS: /Windows Phone/i,
    SUPPORTED_IMAGE_FORMAT: /\.(bmp|gif|jpe|jpg|jpeg|tif|tiff|pbm|png|ico)$/i,
    SUPPORTED_FILE_FORMAT: /\.(txt|js|css|html|script|properties|json|java|xml|smd|xmi|sql|log|wsdl|vm|ftl|jrxml|yml|yaml|md|less|jsp)$/i,
    SUPPORTED_AUDIO_FORMAT: /\.(mp3|ogg|webm|wma|3gp|wav|m4a)$/i,
    SUPPORTED_VIDEO_FORMAT: /\.(mp4|ogg|webm|wmv|mpeg|mpg|avi|mov)$/i,
    PAGE_RESOURCE_PATH: /^\/pages\/.*\.(js|css|html|json)$/,
    MIN_PAGE_RESOURCE_PATH: /.*(page.min.html)$/,
    VALID_EMAIL: /^[a-zA-Z][\w.+]+@[a-zA-Z_]+?\.[a-zA-Z.]{1,4}[a-zA-Z]$/,
    VALID_WEB_URL: /^(http[s]?:\/\/)(www\.){0,1}[a-zA-Z0-9=:?\/\.\-]+(\.[a-zA-Z]{2,5}[\.]{0,1})?/,
    VALID_WEBSOCKET_URL: /^(ws[s]?:\/\/)(www\.){0,1}[a-zA-Z0-9=:?\/\.\-]+(\.[a-zA-Z]{2,5}[\.]{0,1})?/,
    VALID_RELATIVE_URL: /^(?!www\.|(?:http|ftp)s?:\/\/|[A-Za-z]:\\|\/\/).*/,
    REPLACE_PATTERN: /\$\{([^\}]+)\}/g,
    ZIP_FILE: /\.zip$/i,
    EXE_FILE: /\.exe$/i,
    NO_QUOTES_ALLOWED: /^[^'|"]*$/,
    NO_DOUBLE_QUOTES_ALLOWED: /^[^"]*$/,
    VALID_HTML: /<[a-z][\s\S]*>/i,
    VALID_PASSWORD: /^[0-9a-zA-Z-_.@&*!#$%]+$/,
    SPECIAL_CHARACTERS: /[^A-Z0-9a-z_]+/i,
    APP_SERVER_URL_FORMAT: /^(http[s]?:\/\/)(www\.){0,1}[a-zA-Z0-9\.\-]+([:]?[0-9]{2,5}|\.[a-zA-Z]{2,5}[\.]{0,1})\/+[^?#&=]+$/,
    JSON_DATE_FORMAT: /\d{4}-[0-1]\d-[0-3]\d(T[0-2]\d:[0-5]\d:[0-5]\d.\d{1,3}Z$)?/,
    DATA_URL: /^\s*data:([a-z]+\/[a-z0-9-+.]+(;[a-z-]+=[a-z0-9-]+)?)?(;base64)?,([a-z0-9!$&',()*+;=\-._~:@\/?%\s]*)\s*$/i
}
const NUMBER_TYPES = ['int', DataType.INTEGER, DataType.FLOAT, DataType.DOUBLE, DataType.LONG, DataType.SHORT, DataType.BYTE, DataType.BIG_INTEGER, DataType.BIG_DECIMAL];
export const noop = (...args: any) => { };
function* idGenerator(token: any) {
    let id = 1;
    while (1) {
        yield `${token}${id++}`;
    }
}
export const isValidWebURL = (url: string): boolean => {
    return (REGEX.VALID_WEB_URL).test(url);
};

/*Function to check whether the specified object is a pageable object or not.*/
export const isPageable = (obj: any): boolean => {
    const pageable = {
        'content': [],
        'first': true,
        'last': true,
        'number': 0,
        'numberOfElements': 10,
        'size': 20,
        'sort': null,
        'totalElements': 10,
        'totalPages': 1
    };
    // paginated object may or may not contain 'empty' property. In either case, Pageable should return as true.
    const paginatedObj = _.omit(obj, 'empty');
    return (_.isEqual(_.keys(pageable), _.keys(paginatedObj).sort()));
};

export class IDGenerator {
    private generator: Iterator<any>;

    constructor(key: string) {
        this.generator = idGenerator(key);
    }

    public nextUid(): string {
        return this.generator.next().value;
    }
}
// ToDo - variable seperation
export const hasCordova = () => {
    return !!window['cordova'];
};

export const removeExtraSlashes = function (url) {
    const base64regex = /^data:image\/([a-z]{2,});base64,/;
    if (_.isString(url)) {
        /*
        * support for mobile apps having local file path url starting with file:/// and
        * support for base64 format
        * */
        if (_.startsWith(url, 'file:///') || base64regex.test(url)) {
            return url;
        }
        return url.replace(new RegExp('([^:]\/)(\/)+', 'g'), '$1');
    }
};
export const isDefined = (v: any) => 'undefined' !== typeof v;
export const isObject = (v: any) => null !== v && 'object' === typeof v;
/* returns true if the provided data type matches number type */
export const isNumberType = (type: any): boolean => {
    return (NUMBER_TYPES.indexOf(extractType(type).toLowerCase()) !== -1);
};

/*
* extracts and returns the last bit from full typeRef of a field
* e.g. returns 'String' for typeRef = 'java.lang.String'
* @params: {typeRef} type reference
*/
export const extractType = (typeRef: string): string => {
    let type;
    if (!typeRef) {
        return DataType.STRING;
    }
    type = typeRef && typeRef.substring(typeRef.lastIndexOf('.') + 1);
    type = type && type.toLowerCase();
    type = type === DataType.LOCALDATETIME ? DataType.DATETIME : type;
    return type;
};
/*Function to check if date time type*/
export const isDateTimeType = (type: string) => {
    if (_.includes(type, '.')) {
        type = _.toLower(extractType(type));
    }
    return _.includes([DataType.DATE, DataType.TIME, DataType.TIMESTAMP, DataType.DATETIME, DataType.LOCALDATETIME], type);
};
export const getValidJSON = (content: any) => {
    if (!content) {
        return undefined;
    }
    try {
        const parsedIntValue = parseInt(content, 10);
        /*obtaining json from editor content string*/
        return isObject(content) || !isNaN(parsedIntValue) ? content : JSON.parse(content);
    } catch (e) {
        /*terminating execution if new variable object is not valid json.*/
        return undefined;
    }
};
export const xmlToJson = (xmlString: string) => {
    const x2jsObj = new X2JS({ 'emptyNodeForm': 'content', 'attributePrefix': '', 'enableToStringFunc': false });
    let json = x2jsObj.xml2js(xmlString);
    if (json) {
        json = _.get(json, Object.keys(json)[0]);
    }
    return json;
};
/*
 * Util method to replace patterns in string with object keys or array values
 * Examples:
 * Utils.replace('Hello, ${first} ${last} !', {first: 'wavemaker', last: 'ng'}) --> Hello, wavemaker ng
 * Utils.replace('Hello, ${0} ${1} !', ['wavemaker','ng']) --> Hello, wavemaker ng
 * Examples if parseError is true:
 * Utils.replace('Hello, {0} {1} !', ['wavemaker','ng']) --> Hello, wavemaker ng
 */
export const replace = (template: any, map: any, parseError?: boolean) => {
    let regEx = REGEX.REPLACE_PATTERN;
    if (!template) {
        return;
    }
    if (parseError) {
        regEx = /\{([^\}]+)\}/g;
    }

    return template.replace(regEx, function (match: any, key: any) {
        return _.get(map, key);
    });
};
/**
 * prepare a blob object based on the content and content type provided
 * if content is blob itself, simply returns it back
 * @param val
 * @param valContentType
 * @returns {*}
 */
export const getBlob = (val: any, valContentType?: any) => {
    if (val instanceof Blob) {
        return val;
    }
    const jsonVal = getValidJSON(val);
    if (jsonVal && jsonVal instanceof Object) {
        val = new Blob([JSON.stringify(jsonVal)], { type: valContentType || 'application/json' });
    } else {
        val = new Blob([val], { type: valContentType || 'text/plain' });
    }
    return val;
};

/**
 * Returns a deep cloned replica of the passed object/array
 * @param object object/array to clone
 * @returns a clone of the passed object
 */
export const getClonedObject = (object: any) => {
    return _.cloneDeep(object);
};
/**
 * this method checks if a given string starts with the given string
 */
export const stringStartsWith = (str: string, startsWith: string, ignoreCase?: boolean): boolean => {
    if (!str) {
        return false;
    }

    const regEx = new RegExp('^' + startsWith, ignoreCase ? 'i' : '');

    return regEx.test(str);
};
/*function to check if fn is a function and then execute*/
export function triggerFn(fn: any, ...argmnts: any) {
    /* Use of slice on arguments will make this function not optimizable
    * https://github.com/petkaantonov/bluebird/wiki/Optimization-killers#32-leaking-arguments
    * */

    let start = 1;
    const len = arguments.length, args = new Array(len - start);
    for (start; start < len; start++) {
        args[start - 1] = arguments[start];
    }

    if (_.isFunction(fn)) {
        return fn.apply(null, args);
    }
}

/*
 * Util method to find the value of a key in the object
 * if key not found and create is true, an object is created against that node
 * Examples:
 * var a = {
 *  b: {
 *      c : {
 *          d: 'test'
 *      }
 *  }
 * }
 * Utils.findValue(a, 'b.c.d') --> 'test'
 * Utils.findValue(a, 'b.c') --> {d: 'test'}
 * Utils.findValue(a, 'e') --> undefined
 * Utils.findValue(a, 'e', true) --> {} and a will become:
 * {
 *   b: {
 *      c : {
 *          d: 'test'
 *      }
 *  },
 *  e: {
 *  }
 * }
 */
export const findValueOf = (obj: any, key: any, create?: any) => {

    if (!obj || !key) {
        return;
    }

    if (!create) {
        return _.get(obj, key);
    }

    const parts = key.split('.'),
        keys: any = [];

    let skipProcessing;

    parts.forEach((part: any) => {
        if (!parts.length) { // if the part of a key is not valid, skip the processing.
            skipProcessing = true;
            return false;
        }

        const subParts = part.match(/\w+/g);
        let subPart;

        while (subParts.length) {
            subPart = subParts.shift();
            keys.push({ 'key': subPart, 'value': subParts.length ? [] : {} }); // determine whether to create an array or an object
        }
    });

    if (skipProcessing) {
        return undefined;
    }

    keys.forEach((_key: any) => {
        let tempObj = obj[_key.key];
        if (!isObject(tempObj)) {
            tempObj = getValidJSON(tempObj);
            if (!tempObj) {
                tempObj = _key.value;
            }
        }
        obj[_key.key] = tempObj;
        obj = tempObj;
    });

    return obj;
};
