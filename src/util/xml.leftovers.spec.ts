import { xmlToJson } from './utils';

describe('xmlToJson - failure paths', () => {
    it('returns null for input that cannot be converted', () => {
        expect(xmlToJson('')).toBeNull();
        expect(xmlToJson('plain text')).toBeNull();
    });
});
