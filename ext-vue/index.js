import Vue from 'vue'
import Counter from './Counter'

let store = Vue.observable({
  connected: false,
  inputChars: ''
})

let app = null
const chan = new MessageChannel()

// region establish message channel
setTimeout(() => {
  postMessage(':establish :ext-vue',
    '*',
    [chan.port2])
})

chan.port1.onmessage = (e) => {
  const data = e.data

  if (data === ':established') {
    store.connected = true
    return
  }

  if (data && data.action === 'input-value-changed') {
    store.inputChars = data.payload.value
  }
}

// endregion

export async function mount ({ host }) {
  const root = host.querySelector('#app-vue')

  app = new Vue({
    render (h) {
      return h('section', [
        h('h3', {
          style: {
            color: store.connected ? 'green' : ''
          }
        }, store.connected ? 'Connected!' : 'Connecting'),
        h(Counter, {
          props: {
            num: store.inputChars.length
          }
        })
      ])
    }
  })

  app.$mount(root)
}