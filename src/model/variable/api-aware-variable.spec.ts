import { ApiAwareVariable } from './api-aware-variable';

class Concrete extends ApiAwareVariable {}

describe('ApiAwareVariable', () => {
    it('is a base variable carrying the api configuration fields', () => {
        const v = new Concrete();
        v.service = 's';
        v.operation = 'o';
        v.maxResults = 10;
        expect(v.service).toBe('s');
        expect(v.isMuted).toBe(false);
        v.mute();
        expect(v.isMuted).toBe(true);
    });
});
