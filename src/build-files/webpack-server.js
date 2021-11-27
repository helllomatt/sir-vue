const webpack = require('webpack');
const { VueLoaderPlugin } = require('vue-loader-v16');
const { WebpackManifestPlugin } = require('webpack-manifest-plugin');
const nodeExternals = require('webpack-node-externals');
const { mergeWithRules } = require('webpack-merge');

module.exports = (defaultOptions, options, htmlOptions) => {
    return mergeWithRules({
        module: {
            rules: {
                test: 'match',
                use: {
                    loader: 'match',
                    options: 'replace',
                }
            }
        },
        resolve: 'merge',
        externals: 'replace',
        plugins: 'merge'
    })({
        entry: 'entry-server.js',
        mode: options.productionMode ? 'production' : 'development',
        target: 'node',
        output: {
            libraryTarget: 'commonjs2',
            filename: 'bundle-server.[contenthash].js',
        },
        module: {
            rules: [
                {
                    test: /\.vue$/,
                    use: [
                        {
                            loader: require.resolve('vue-loader-v16')
                        },
                    ],
                },
                {
                    test: /\.js$/,
                    exclude: /node_modules/,
                    loader: 'babel-loader',
                },
                {
                    test: /\.css$/,
                    use: [
                        'vue-style-loader',
                        'css-loader',
                        'postcss-loader'
                    ],
                },
            ],
        },
        'resolve': {
            alias: {
                '$$': options.projectDirectory,
                vue: 'vue/dist/vue.runtime.esm-bundler.js',
            },
            'extensions': [
                '.js',
                '.vue',
                '.json',
                '.css',
                '.less'
            ],
            'modules': [
                'node_modules',
            ]
        },
        externals: [
            nodeExternals()
        ],
        plugins: [
            new VueLoaderPlugin(),
            new webpack.DefinePlugin({
                __VUE_OPTIONS_API__: true,
                __VUE_PROD_DEVTOOLS__: !options.productionMode,
            }),
            new webpack.optimize.LimitChunkCountPlugin({
                maxChunks: 1,
            }),
            new WebpackManifestPlugin({
                fileName: 'vue-ssr-manifest.json'
            })
        ],
    }, defaultOptions);
};
