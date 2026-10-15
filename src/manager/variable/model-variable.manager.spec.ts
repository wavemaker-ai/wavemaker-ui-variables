import { ModelVariableManager } from './model-variable.manager';

describe('ModelVariableManager', () => {
    let manager: ModelVariableManager;

    beforeEach(() => {
        manager = new ModelVariableManager();
    });

    describe('removeFirstEmptyObject', () => {
        it('clears the dataset when it has a single, fully-empty object', () => {
            const variable: any = { dataSet: [{ a: '', b: null, c: undefined }] };
            manager.removeFirstEmptyObject(variable);
            expect(variable.dataSet).toEqual([]);
        });

        it('leaves the dataset untouched when it has more than one item', () => {
            const variable: any = { dataSet: [{ a: '' }, { b: '' }] };
            manager.removeFirstEmptyObject(variable);
            expect(variable.dataSet).toHaveLength(2);
        });

        it('leaves the dataset untouched when the single object has a real value', () => {
            const variable: any = { dataSet: [{ a: 'value' }] };
            manager.removeFirstEmptyObject(variable);
            expect(variable.dataSet).toHaveLength(1);
        });

        it('leaves the dataset untouched when it is not an array', () => {
            const variable: any = { dataSet: { a: '' } };
            manager.removeFirstEmptyObject(variable);
            expect(variable.dataSet).toEqual({ a: '' });
        });

        it('treats booleans and numbers as real values, so the row is kept', () => {
            const variable: any = { dataSet: [{ active: false, count: 0 }] };
            manager.removeFirstEmptyObject(variable);
            expect(variable.dataSet).toHaveLength(1);
        });

        it('recurses into nested objects to determine emptiness', () => {
            const variable: any = { dataSet: [{ nested: { a: '', b: '' } }] };
            manager.removeFirstEmptyObject(variable);
            expect(variable.dataSet).toEqual([]);
        });

        it('treats a non-empty nested object as making the row non-empty', () => {
            const variable: any = { dataSet: [{ nested: { a: 'x' } }] };
            manager.removeFirstEmptyObject(variable);
            expect(variable.dataSet).toHaveLength(1);
        });
    });
});
