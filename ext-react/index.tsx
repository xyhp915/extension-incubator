import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'
// @ts-ignore
import md from 'marked'

let actions: any = {}
const chan = new MessageChannel()

// region establish message channel
setTimeout(() => {
  postMessage(':establish :ext-react',
    '*',
    [chan.port2])
})

chan.port1.onmessage = (e) => {
  const data = e.data

  if (data === ':established') {
    actions.setConnected(true)
    return
  }

  if (data && data.action === 'input-value-changed') {
    actions.setInputChars(data.payload.value)
  }
}

// endregion

/**
 * @param props
 * @constructor
 */
function MdDisplay (props: { content: string }) {
  if (!props.content) {
    return null
  }

  return (
    <div className="md-display" style={{
      backgroundColor: '#f1f1f1',
      color: 'black',
      fontSize: '22px',
      padding: '10px'
    }}>
      <div className="inner markdown-body"
           dangerouslySetInnerHTML={{ __html: md(props.content) }}
      />
    </div>
  )
}

/**
 * @param props
 * @constructor
 */
function App (props: any) {
  const [connected, setConnected] = useState(false)
  const [inputChars, setInputChars] = useState('')

  useEffect(() => {
    actions = {
      setConnected,
      setInputChars
    }
  }, [])

  return (
    <>
      <h3>{connected ? <span
        style={{ color: 'green' }}>Connected!</span> : 'Connecting...'}</h3>
      <MdDisplay content={inputChars}/>
    </>
  )
}

/**
 * @param host
 * @returns {Promise<void>}
 */
export function mount ({ host }: { host: ShadowRoot }) {
  const root = host.querySelector('#app')

  ReactDOM.render(<App/>, root)
}