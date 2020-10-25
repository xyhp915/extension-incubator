<template>
  <p class="num-wrap">
    <strong>
      已输入 {{ num }} 字符 ～
    </strong>
  </p>
</template>

<script>
export default {
  props: {
    num: {
      type: Number,
      default: 0
    }
  }
}
</script>

<style scoped>
.num-wrap {
  background-color: #42b983;
  font-size: 32px;
  color: black;
  padding: 20px;
}
</style>