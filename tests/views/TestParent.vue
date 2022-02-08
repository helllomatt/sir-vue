<template>
    <div id="test-parent">Hello, world I'm a parent!</div>
    <Greeting />
</template>

<script>
import Greeting from './Greeting'

export default {
    components: {
        Greeting,
    },
}
</script>
