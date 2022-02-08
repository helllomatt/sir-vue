# SIR VUE

![npm publish](https://github.com/helllomatt/sir-vue/actions/workflows/npm-publish.yml/badge.svg)

Vue SSR renderer

For more help setting things up and using the library, check out the [wiki](https://github.com/helllomatt/sir-vue/wiki).

## Installation

```
$ npm install --save sir-vue vue@next express
```

## The Most Basic Usage

First thing is to set up the folder structure:

```
project/
    views/
        Index.vue
    index.js
```

`index.js`

```js
const app = require('express')()
require('sir-vue').CreateRenderer({ app })

app.get('/', (req, res) => {
    res.vue('Index.vue')
})

const server = app.listen(8080, () => {
    const address = server.address()
    console.log(`Listening on ${address.address}:${address.port}`)
})
```

`views/Index.vue`

```vue
<template>Hello, world!</template>
```
