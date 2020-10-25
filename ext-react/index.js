import React, { useEffect, useState } from 'react'
import ReactDOM from 'react-dom'

let actions = {}
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
function Counter (props) {
  return (
    <p className="num-wrap" style={{
      backgroundColor: '#3d69bf',
      fontSize: '32px',
      color: 'black',
      padding: '20px'
    }}>
      <strong>
        已输入 {props.num} 字符 ～
      </strong>
    </p>
  )
}

/**
 * @param props
 * @constructor
 */
function App (props) {
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
      <Counter num={inputChars.length} />
    </>
  )
}

/**
 * @param host
 * @returns {Promise<void>}
 */
export function mount ({ host }) {
  const root = host.querySelector('#app')

  ReactDOM.render(<App />, root)
}