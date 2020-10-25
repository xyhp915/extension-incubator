async function mount ({ host }) {
  // TODO: message channel handled by SDK
  const extMsgChan = new MessageChannel()
  const el = host.querySelector('#appx')
  const wrap = document.createElement('section')
  const statusEl = el.querySelector('h4')

  el.append(wrap)

  extMsgChan.port1.onmessage = (e) => {
    let data = e.data

    if (data === ':established') {
      statusEl.innerHTML =
        `<span style="color: green; ">Connected!</span>
         <p><code>typeof window.indexedDB</code>---&gt; ${typeof indexedDB}</p>
        `
      return
    }

    const item = document.createElement('p')
    item.innerHTML = `[${(new Date()).toLocaleTimeString()}]<strong>${JSON.stringify(data)}</strong>`
    wrap.prepend(item)
  }

  // establish message channel
  setTimeout(() => {
    postMessage(':establish :ext-a',
      '*',
      [extMsgChan.port2])
  })
}

window['ext-a'] = {
  mount
}

