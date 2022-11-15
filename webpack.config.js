const path = require('path');

module.exports = {
    entry: './index.ts',
    module: {
        rules: [
            {
                test: /\.ts?$/,
                use: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
    resolve: {
        extensions: ['.ts', '.js'],
    },
    devtool: 'inline-source-map',
    output: {
        filename: 'index.js',
        path: path.resolve(__dirname, 'dist/umd'),
        library: {
            type: 'umd',
            name: 'wm_common_variables',
        },
        // prevent error: `Uncaught ReferenceError: self is not define`
        globalObject: 'window',
    },
};