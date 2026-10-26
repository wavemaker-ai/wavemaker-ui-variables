import { CRUDCreate } from './crud-create';
import { CRUDDelete } from './crud-delete';
import { CRUDList } from './crud-list';
import { CRUDUpdate } from './crud-update';

const cases: [string, any, string][] = [
    ['create', CRUDCreate, 'create'],
    ['delete', CRUDDelete, 'delete'],
    ['list', CRUDList, 'list'],
    ['update', CRUDUpdate, 'update'],
];

describe.each(cases)('CRUD%s operation', (_name, Ctor, operation) => {
    let manager: any;
    let variable: any;
    let crud: any;

    beforeEach(() => {
        manager = { setInput: jest.fn().mockReturnValue('input'), invoke: jest.fn().mockReturnValue('invoked') };
        variable = { name: 'v' };
        crud = new Ctor(variable, manager);
    });

    it('delegates setInput to the manager with the operation name', () => {
        expect(crud.setInput('k', 'val', { o: 1 })).toBe('input');
        expect(manager.setInput).toHaveBeenCalledWith(variable, 'k', 'val', { o: 1 }, operation);
    });

    it('invokes the manager with the operation set on the options', () => {
        const success = jest.fn();
        const error = jest.fn();
        expect(crud.invoke({ a: 1 }, success, error)).toBe('invoked');
        expect(manager.invoke).toHaveBeenCalledWith(variable, { a: 1, operation }, success, error);
    });

    it('defaults the options to an empty object', () => {
        crud.invoke();
        expect(manager.invoke).toHaveBeenCalledWith(variable, { operation }, undefined, undefined);
    });
});
