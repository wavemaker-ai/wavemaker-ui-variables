import { VARIABLE_CONSTANTS } from '../../constants/variables.constants';
import {
    debounceVariableCall,
    formatDate,
    getErrMessage,
    getTarget,
    getTargetNodeKey,
    initiateCallback,
    internalBoundNodeMap,
    setValueToNode,
    updateInternalNodes,
    wmSetDependency,
    appManager,
    httpService,
    metadataService,
    navigationService,
    routerService,
    toasterService,
    oauthService,
    securityService,
    dialogService,
} from './variables.utils';

const CATEGORY = VARIABLE_CONSTANTS.CATEGORY;

describe('variables.utils (ui-variables) - additional paths', () => {
    afterEach(() => {
        jest.useRealTimers();
    });

    describe('wmSetDependency', () => {
        it('stores every kind of dependency', () => {
            const ref = (name: string) => ({ name });
            ['appManager', 'http', 'metadata', 'navigationService', 'router', 'toaster', 'oAuth', 'security', 'dialog'].forEach((type) => wmSetDependency(type, ref(type)));
            wmSetDependency('unknown', ref('x'));
            expect(appManager).toEqual({ name: 'appManager' });
            expect(httpService).toEqual({ name: 'http' });
            expect(metadataService).toEqual({ name: 'metadata' });
            expect(navigationService).toEqual({ name: 'navigationService' });
            expect(routerService).toEqual({ name: 'router' });
            expect(toasterService).toEqual({ name: 'toaster' });
            expect(oauthService).toEqual({ name: 'oAuth' });
            expect(securityService).toEqual({ name: 'security' });
            expect(dialogService).toEqual({ name: 'dialog' });
        });
    });

    describe('getTarget', () => {
        it('chooses the node that receives the bound values', () => {
            expect(getTarget({ category: CATEGORY.MODEL })).toBe('dataSet');
            expect(getTarget({ category: CATEGORY.LIVE, operation: 'read' })).toBe('filterFields');
            expect(getTarget({ category: CATEGORY.LIVE, operation: 'insert' })).toBe('inputFields');
            expect(getTarget({ category: CATEGORY.SERVICE })).toBe('dataBinding');
        });
    });

    describe('getTargetNodeKey', () => {
        it('uses the last segment or the unwrapped bracket key', () => {
            expect(getTargetNodeKey('a.b.c')).toBe('c');
            expect(getTargetNodeKey("['my.param']")).toBe('my.param');
            expect(getTargetNodeKey('["x"]')).toBe('x');
        });
    });

    describe('setValueToNode and the automatic update', () => {
        let invokeSpy: jest.Mock;

        beforeEach(() => {
            jest.useFakeTimers();
            invokeSpy = jest.fn();
        });

        const bind = (variable: any, target: string, value: any, root: string, obj: any = {}, noUpdate?: boolean) =>
            setValueToNode(target, { target, ...obj }, root, variable, value, noUpdate);

        it('fills the filter fields of a live read variable and lists the records', () => {
            const variable: any = { name: 'v', category: CATEGORY.LIVE, operation: 'read', autoUpdate: true, filterFields: {}, listRecords: invokeSpy };
            bind(variable, 'name', 'x', 'filterFields', { type: 'string' });
            expect(variable.filterFields.name).toEqual({ value: 'x', type: 'string' });
            jest.advanceTimersByTime(150);
            expect(invokeSpy).toHaveBeenCalledTimes(1);
        });

        it('copies a complete binding object into the filter fields', () => {
            const variable: any = { name: 'v', category: CATEGORY.LIVE, operation: 'read', filterFields: {} };
            bind(variable, 'dataBinding', { a: 1, b: 2 }, 'filterFields');
            expect(variable.filterFields).toMatchObject({ a: { value: 1 }, b: { value: 2 } });
        });

        it('fills the input fields of live write variables and calls the write function', () => {
            const insertRecord = jest.fn();
            const variable: any = { name: 'v', category: CATEGORY.LIVE, operation: 'insert', autoUpdate: true, inputFields: {}, insertRecord };
            bind(variable, 'name', 'x', 'inputFields');
            expect(variable.inputFields.name).toBe('x');
            jest.advanceTimersByTime(150);
            expect(insertRecord).toHaveBeenCalledTimes(1);

            bind(variable, 'dataBinding', { id: 1 }, 'inputFields');
            expect(variable.inputFields).toEqual({ id: 1 });
        });

        it('invokes crud list variables only', () => {
            const list: any = { name: 'c', category: CATEGORY.CRUD, operationType: 'list', autoUpdate: true, invoke: invokeSpy, dataBinding: {} };
            const create: any = { name: 'c2', category: CATEGORY.CRUD, operationType: 'create', autoUpdate: true, invoke: invokeSpy, dataBinding: {} };
            bind(list, 'a', 1, 'dataBinding');
            bind(create, 'a', 1, 'dataBinding');
            jest.advanceTimersByTime(150);
            expect(invokeSpy).toHaveBeenCalledTimes(1);
        });

        it('invokes service and login variables', () => {
            const service: any = { name: 's', category: CATEGORY.SERVICE, autoUpdate: true, invoke: invokeSpy, dataBinding: {} };
            const login: any = { name: 'l', category: CATEGORY.LOGIN, autoUpdate: true, invoke: invokeSpy, dataBinding: {} };
            bind(service, 'a', 1, 'dataBinding');
            bind(login, 'a', 1, 'dataBinding');
            jest.advanceTimersByTime(150);
            expect(invokeSpy).toHaveBeenCalledTimes(2);
        });

        it('assigns the value on device variables and invokes them', () => {
            const device: any = { name: 'd', category: CATEGORY.DEVICE, autoUpdate: true, invoke: invokeSpy, dataBinding: {} };
            bind(device, 'level', 5, 'dataBinding');
            expect(device.level).toBe(5);
            jest.advanceTimersByTime(150);
            expect(invokeSpy).toHaveBeenCalledTimes(1);
        });

        it('does not invoke for static values, undefined values or when autoUpdate is off', () => {
            const variable: any = { name: 's', category: CATEGORY.SERVICE, autoUpdate: true, invoke: invokeSpy, dataBinding: {} };
            bind(variable, 'a', 1, 'dataBinding', {}, true);
            bind(variable, 'b', undefined, 'dataBinding', { value: undefined });
            variable.autoUpdate = false;
            bind(variable, 'c', 1, 'dataBinding');
            jest.advanceTimersByTime(150);
            expect(invokeSpy).not.toHaveBeenCalled();
        });

        it('falls back to the value of the binding object', () => {
            const variable: any = { name: 's', category: CATEGORY.SERVICE, dataBinding: {} };
            bind(variable, 'a', undefined, 'dataBinding', { value: 'fallback' });
            expect(variable.dataBinding.a).toBe('fallback');
        });

        it('collects multi value params into slots', () => {
            const variable: any = { name: 's', category: CATEGORY.SERVICE, dataBinding: {} };
            const first = { collectionFormat: 'multi' };
            const second = { collectionFormat: 'multi', multiIndex: 0 };
            bind(variable, 'q', 'a', 'dataBinding', first);
            bind(variable, 'q', 'b', 'dataBinding', { collectionFormat: 'multi' });
            expect(variable.dataBinding.q).toEqual(['a', 'b']);
            bind(variable, 'q', 'z', 'dataBinding', second);
            expect(variable.dataBinding.q[0]).toBe('z');
            variable.dataBinding.single = 'x';
            bind(variable, 'single', 'y', 'dataBinding', { collectionFormat: 'multi' });
            expect(variable.dataBinding.single).toEqual(['x', 'y']);
        });

        it('reuses the slot of a repeated binding', () => {
            const variable: any = { name: 's', category: CATEGORY.SERVICE, dataBinding: {} };
            const node = { target: 'q', collectionFormat: 'multi' };
            setValueToNode('q', node, 'dataBinding', variable, 'a');
            setValueToNode('q', node, 'dataBinding', variable, 'b');
            expect(variable.dataBinding.q).toEqual(['b']);
        });

        it('ignores bindings whose parent cannot hold the value', () => {
            const variable: any = { name: 's', category: CATEGORY.SERVICE, dataBinding: undefined };
            expect(() => bind(variable, 'a.b', 1, 'dataBinding')).not.toThrow();
        });

        it('swallows rejected promises of the automatic update', async () => {
            const variable: any = { name: 's', category: CATEGORY.SERVICE, autoUpdate: true, invoke: jest.fn().mockRejectedValue('x'), dataBinding: {} };
            bind(variable, 'a', 1, 'dataBinding');
            jest.advanceTimersByTime(150);
            await Promise.resolve();
            expect(variable.invoke).toHaveBeenCalled();
        });
    });

    describe('updateInternalNodes', () => {
        it('restores nested values after the parent node was computed', () => {
            const variable: any = { name: 'emp', category: CATEGORY.SERVICE, dataBinding: { dept: { name: 'HR' } } };
            internalBoundNodeMap.set(variable, { emp: { dataBinding: { 'dept.budget': { q1: 1 }, dept: { name: 'HR' } } } });
            updateInternalNodes('dept', 'dataBinding', variable);
            expect(variable.dataBinding.dept.budget).toEqual({ q1: 1 });
        });

        it('does nothing when no nested node is bound', () => {
            const variable: any = { name: 'emp', category: CATEGORY.SERVICE, dataBinding: {} };
            expect(() => updateInternalNodes('dept', 'dataBinding', variable)).not.toThrow();
        });
    });

    describe('initiateCallback', () => {
        const notification = (message?: string) => ({ getMessage: jest.fn().mockReturnValue(message), invoke: jest.fn() });
        const context = (action: any) => ({ Actions: { [VARIABLE_CONSTANTS.DEFAULT_VAR.NOTIFICATION]: action } });

        it('does nothing for variables that skip callbacks', () => {
            const handler = jest.fn();
            initiateCallback('onSuccess', { _skipInitiateCallback: true, onSuccess: handler, _context: {} }, 'd');
            expect(handler).not.toHaveBeenCalled();
        });

        it('reports errors through the default notification', () => {
            const action = notification();
            initiateCallback(VARIABLE_CONSTANTS.EVENT.ERROR, { _context: context(action) }, 'failed');
            expect(action.invoke).toHaveBeenCalledWith({ message: 'failed' }, undefined, undefined);
        });

        it('prefers the configured message and falls back to a generic one', () => {
            const configured = notification('Configured');
            initiateCallback(VARIABLE_CONSTANTS.EVENT.ERROR, { _context: context(configured) }, 'raw');
            expect(configured.invoke).toHaveBeenCalledWith({ message: 'Configured' }, undefined, undefined);

            const generic = notification();
            initiateCallback(VARIABLE_CONSTANTS.EVENT.ERROR, { _context: context(generic) }, { code: 1 });
            expect(generic.invoke).toHaveBeenCalledWith({ message: 'An error has occured. Please check the app logs.' }, undefined, undefined);
        });

        it('does not notify when skipped, handled or when the action does not exist', () => {
            const action = notification();
            initiateCallback(VARIABLE_CONSTANTS.EVENT.ERROR, { _context: context(action) }, 'x', undefined, true);
            initiateCallback(VARIABLE_CONSTANTS.EVENT.ERROR, { onError: jest.fn(), _context: context(action) }, 'x');
            expect(action.invoke).not.toHaveBeenCalled();
            expect(() => initiateCallback(VARIABLE_CONSTANTS.EVENT.ERROR, { _context: { Actions: {} } }, 'x')).not.toThrow();
        });

        it('calls the handler with variable, data and options', () => {
            const handler = jest.fn().mockReturnValue('r');
            const variable: any = { onSuccess: handler, _context: 'ctx' };
            expect(initiateCallback('onSuccess', variable, 'data', { o: 1 })).toBe('r');
            expect(handler).toHaveBeenCalledWith('ctx', { variable, data: 'data', options: { o: 1 } });
        });

        it('passes the data filter for live read variables and input data for other variables in onBeforeUpdate', () => {
            const handler = jest.fn();
            const live: any = { category: 'wm.LiveVariable', operation: 'read', onBeforeUpdate: handler, _context: 'c' };
            initiateCallback(VARIABLE_CONSTANTS.EVENT.BEFORE_UPDATE, live, 'filter', 'opt');
            expect(handler).toHaveBeenLastCalledWith('c', { variable: live, dataFilter: 'filter', options: 'opt' });
            const service: any = { category: 'wm.ServiceVariable', onBeforeUpdate: handler, _context: 'c' };
            initiateCallback(VARIABLE_CONSTANTS.EVENT.BEFORE_UPDATE, service, 'input', 'opt');
            expect(handler).toHaveBeenLastCalledWith('c', { variable: service, inputData: 'input', options: 'opt' });
        });

        it('treats a missing handler as a no-op', () => {
            expect(initiateCallback('onSuccess', { _context: {} }, 'd')).toBeUndefined();
        });
    });

    describe('formatDate', () => {
        const formatter = { format: jest.fn((epoch: any, pattern: string) => `${epoch}|${pattern}`) };

        beforeEach(() => formatter.format.mockClear());

        it('returns the epoch for timestamps and formats other date types', () => {
            expect(formatDate(1700000000000, 'timestamp', formatter)).toBe(1700000000000);
            expect(formatDate(1700000000000, 'date', formatter)).toContain('1700000000000|');
            expect(formatDate(new Date(1700000000000), 'datetime', formatter)).toContain('1700000000000|');
        });

        it('converts numeric strings and qualified type names', () => {
            expect(formatDate('1700000000000', 'java.sql.Timestamp', formatter)).toBe(1700000000000);
        });

        it('formats lists value by value', () => {
            expect(formatDate([1700000000000], 'timestamp', formatter)).toEqual([1700000000000]);
        });

        it('keeps invalid values of non time types', () => {
            const warn = jest.spyOn(console, 'warn').mockImplementation(() => undefined);
            expect(formatDate('not a date', 'date', formatter)).toBeNaN();
            warn.mockRestore();
        });

        it('builds an epoch for time only values', () => {
            formatDate('10:30:00', 'time', formatter);
            expect(formatter.format).toHaveBeenCalled();
        });

        it('returns undefined for undefined values', () => {
            expect(formatDate(undefined, 'date', formatter)).toBeUndefined();
        });
    });

    describe('getErrMessage', () => {
        it('maps well known http statuses to localized messages', () => {
            expect(getErrMessage({ status: 404 }, { MESSAGE_404_ERROR: 'Not here' })).toBe('Not here');
            expect(getErrMessage({ status: 401 }, {})).toBe('Requested resource requires authentication');
            expect(getErrMessage({ status: 403 }, { LABEL_FORBIDDEN_MESSAGE: 'Nope' })).toBe('Nope');
        });

        it('falls back to a generic message', () => {
            expect(getErrMessage({ status: 500 }, {})).toBe('Service Call Failed');
        });

        it('builds the message from the error details of the service', () => {
            const err = { status: 500, error: { errors: { error: [{ message: 'Bad {0}', parameters: ['input'] }, { parameters: ['second'] }] } } };
            const message = getErrMessage(err, {});
            expect(message).toContain('Bad input');
            expect(message).toContain('second');
        });

        it('parses json strings and uses the data property', () => {
            const body = JSON.stringify({ errors: { error: [{ message: 'From json' }] } });
            expect(getErrMessage({ status: 500, data: body }, {})).toBe('From json');
        });

        it('falls back when the error list is empty', () => {
            expect(getErrMessage({ status: 404, error: { errors: { error: [] } } }, {})).toBe('Requested resource not found');
        });
    });

    describe('debounceVariableCall', () => {
        it('coalesces rapid calls', () => {
            jest.useFakeTimers();
            const variable: any = { run: jest.fn() };
            debounceVariableCall(variable, 'run');
            debounceVariableCall(variable, 'run');
            jest.advanceTimersByTime(150);
            expect(variable.run).toHaveBeenCalledTimes(1);
        });
    });
});
