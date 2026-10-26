import { upload } from './file-upload.util';

describe('file-upload.util upload', () => {
    let variable: any;

    beforeEach(() => {
        variable = {
            request: 'req',
            httpService: { uploadFile: jest.fn().mockResolvedValue({ ok: true }) },
        };
    });

    const run = (files: any, fd: any, options?: any) =>
        new Promise<{ result: any; error: any }>((resolve) => {
            const promise: any = upload(files, variable, fd, { url: '/upload', fileParamName: 'file' }, options);
            promise.then((result: any) => resolve({ result, error: null }), (error: any) => resolve({ result: null, error }));
        });

    it('posts the file under the configured param name and resolves with the response', async () => {
        const file: any = new File(['abc'], 'a.txt');
        const fd = new FormData();
        fd.append('name', 'value');

        const { result } = await run(file, fd);

        expect(result).toEqual({ ok: true });
        const [url, formData, v, extra] = variable.httpService.uploadFile.mock.calls[0];
        expect(url).toBe('/upload');
        expect((formData as FormData).get('name')).toBe('value');
        expect(((formData as FormData).get('file') as File).name).toBe('a.txt');
        expect(v).toBe(variable);
        expect(typeof extra.notify).toBe('function');
        expect(file._uploadProgress).toBe('req');
    });

    it('appends every file when an array is passed', async () => {
        const files: any = [new File(['1'], 'one.txt'), new File(['2'], 'two.txt')];
        await run(files, new FormData());
        const formData: FormData = variable.httpService.uploadFile.mock.calls[0][1];
        expect(formData.getAll('file').map((f: any) => f.name)).toEqual(['one.txt', 'two.txt']);
    });

    it('uses the content property of a file descriptor when present', async () => {
        const blob = new Blob(['x']);
        await run({ content: blob, name: 'c.bin' }, new FormData());
        const formData: FormData = variable.httpService.uploadFile.mock.calls[0][1];
        expect((formData.get('file') as File).name).toBe('c.bin');
    });

    it('does not copy file entries from the original form data', async () => {
        const fd = new FormData();
        fd.append('keep', 'yes');
        fd.append('skip', new File(['z'], 'skip.txt'));
        await run(new File(['a'], 'a.txt'), fd);
        const formData: FormData = variable.httpService.uploadFile.mock.calls[0][1];
        expect(formData.get('keep')).toBe('yes');
        expect(formData.get('skip')).toBeNull();
    });

    it('iterates plain object form data when forEach is not available', async () => {
        await run(new File(['a'], 'a.txt'), { field: 'v', files: [new File(['q'], 'q.txt')] });
        const formData: FormData = variable.httpService.uploadFile.mock.calls[0][1];
        expect(formData.get('field')).toBe('v');
        expect(formData.getAll('file')).toHaveLength(1);
    });

    it('lets options override the param name', async () => {
        await run(new File(['a'], 'a.txt'), new FormData(), { paramName: 'custom' });
        const formData: FormData = variable.httpService.uploadFile.mock.calls[0][1];
        expect(formData.get('custom')).not.toBeNull();
    });

    it('rejects with the http service error', async () => {
        variable.httpService.uploadFile.mockRejectedValue('boom');
        const { error } = await run(new File(['a'], 'a.txt'), new FormData());
        expect(error).toBe('boom');
    });
});
