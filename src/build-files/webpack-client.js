const webpack = require('webpack');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const { VueLoaderPlugin } = require('vue-loader-v16');
const { mergeWithRules } = require('webpack-merge');

module.exports = (defaultOptions, options, htmlOptions = {}) => {
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
        entry: 'entry-client.js',
        mode: 'development',
        devtool: 'source-map',
        output: {
            filename: 'bundle-client.[contenthash].js',
            publicPath: '/',
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
                    loader: 'babel-loader',
                    options: {
                        presets: ['@babel/preset-env'],
                    }
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
                'node_modules'
            ]
        },
        externals: [

        ],
        plugins: [
            new VueLoaderPlugin(),
            new webpack.DefinePlugin({
                __VUE_OPTIONS_API__: true,
                __VUE_PROD_DEVTOOLS__: true,
            }),
            new webpack.optimize.LimitChunkCountPlugin({
                maxChunks: 1
            }),
            new HtmlWebpackPlugin({
                ...htmlOptions,
                publicPath: options.publicPrefix,
                template: options.templateFile,
                scriptLoading: 'blocking'
            }),
        ],
    }, defaultOptions);
};