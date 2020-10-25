import EventEmitter from 'eventemitter3'
import { importHtml } from './loader'
import { Lifecycle, Lifecycles } from './types'

const mixinLife: Lifecycles = {
  load: [],
  bootstrap: [],
  mount: [],
  unmount: []
}

/**
 * @param fns
 */
function compose<T = any> (
  fns: ((ctx: T) => Promise<any>)[]
): (ctx: T) => Promise<void> {
  fns = Array.isArray(fns) ? fns : [fns]
  return (ctx: T): Promise<void> =>
    fns.reduce((p, fn) => p.then(() => fn(ctx)), Promise.resolve())
}

interface ExtensionLifeCircle {
  mount (): Promise<any>

  unmount (): Promise<any>

  bootstrap (): Promise<any>

  setup (el: HTMLElement): Promise<any>
}

export enum Status {
  NOT_LOADED = 'NOT_LOADED',
  LOADING = 'LOADING',
  NOT_BOOTSTRAPPED = 'NOT_BOOTSTRAPPED',
  BOOTSTRAPPING = 'BOOTSTRAPPING',
  NOT_MOUNTED = 'NOT_MOUNTED',
  MOUNTING = 'MOUNTING',
  MOUNTED = 'MOUNTED',
  UPDATING = 'UPDATING',
  UPDATED = 'UPDATED',
  UNMOUNTING = 'UNMOUNTING'
}

/**
 * A Extension Runtime
 */
class AppExtensionImpl extends EventEmitter implements ExtensionLifeCircle {
  private _loaded: boolean = false
  private _status: Status = Status.NOT_LOADED
  private _host?: DocumentFragment
  private _bootstrap?: (ctx: any) => Promise<void>
  private _mount?: (ctx: any) => Promise<void>
  private _unmount?: (ctx: any) => Promise<void>

  /**
   * @param _name unique extension name
   * @param _url main resource entry
   */
  constructor (
    private _name: string,
    private _url: string
  ) {
    super()
  }

  /**
   * load sandbox & parse assets
   * @private
   */
  private async load () {
    if (this._loaded || this._status === Status.LOADING) {
      return
    }

    this._status = Status.LOADING

    this._host = await this.loadShadowDOM()

    const { lifecycle, bodyNode, styleNodes } = await importHtml(this)

    this.lifecycleCheck(lifecycle)

    this._host?.appendChild(bodyNode.content.cloneNode(true))

    for (const k of (styleNodes).reverse()) {
      this._host!.insertBefore(k, this._host!.firstChild)
    }

    this._status = Status.NOT_BOOTSTRAPPED

    this._bootstrap = compose(mixinLife.bootstrap.concat(lifecycle.bootstrap))
    this._mount = compose(mixinLife.mount.concat(lifecycle.mount))
    this._unmount = compose(mixinLife.unmount.concat(lifecycle.unmount))

    this._loaded = true
  }

  /**
   * TODO: improve
   * @param lifecycle
   * @private
   */
  private lifecycleCheck (lifecycle: Lifecycle | Lifecycles) {
    const keys = ['bootstrap', 'mount', 'unmount']
    keys.forEach((key) => {
      if (!(key in lifecycle)) {
        console.error(
          `It looks like that you didn't export the lifecycle hook [${key}], which would cause a mistake.`
        )
      }
    })
  }

  async setup (root: HTMLElement) {
    if (root) {
      const node = document.createElement(this._name)
      root.append(node)
    }

    await this.load()
    await this.bootstrap()

    await this.mount()

    return this
  }

  async bootstrap () {
    if (this._status !== Status.NOT_BOOTSTRAPPED) {
      return
    }

    this._status = Status.BOOTSTRAPPING
    await this._bootstrap!(this)
    this._status = Status.NOT_MOUNTED
  }

  async mount () {
    if (this._status !== Status.NOT_MOUNTED) {
      return
    }

    this._status = Status.MOUNTING
    await this._mount!(this)
    this._status = Status.MOUNTED
  }

  async unmount () {
    if (this._status !== Status.MOUNTED) {
      return
    }

    this._status = Status.UNMOUNTING
    await this._unmount!(this)
    this._status = Status.NOT_MOUNTED
  }

  get name (): string {
    return this._name
  }

  get url (): string {
    return this._url
  }

  get host (): DocumentFragment {
    return this._host!
  }

  /**
   * @private
   */
  private async loadShadowDOM (): Promise<DocumentFragment> {
    const { name } = this

    return new Promise((resolve, reject) => {
      class ExtensionUIImpl extends HTMLElement {
        static get tag (): string {
          return name
        }

        constructor () {
          super()
          resolve(this.attachShadow({ mode: 'open' }))
        }
      }

      const hasDef = window.customElements.get(this.name)
      if (!hasDef) {
        customElements.define(name, ExtensionUIImpl)
      }
    })
  }

  /**
   * @param args
   * @private
   */
  private debug (...args: any[]) {
    console.debug(`🔌 [${this._name}] `, ...args)
  }
}

// region load extensions
const loadedExts = new WeakSet()
const establishedExtsChan = new Map<string, MessagePort>()
const IS_DEV = process.env.NODE_ENV === 'development'
const PUBLIC_URL = IS_DEV ? 'http://localhost:8080' : window.location.origin

const exB = new AppExtensionImpl('ext-b', `${PUBLIC_URL}/ext-b.html`)
exB.setup(document.querySelector('#app') as HTMLElement).catch(console.error)

const exD = new AppExtensionImpl('ext-react', `${PUBLIC_URL}/ext-react/${IS_DEV ? 'dist/' : ''}index.html`)
exD.setup(document.querySelector('#react-slot') as HTMLElement).catch(console.error)

const exC = new AppExtensionImpl('ext-vue', `${PUBLIC_URL}/ext-vue/${IS_DEV ? 'dist/' : ''}index.html`)
exC.setup(document.querySelector('#vue-slot') as HTMLElement).catch(console.error)

const exA = new AppExtensionImpl('ext-a', `${PUBLIC_URL}/ext-a.html`)
exA.setup(document.querySelector('#ext-a-slot') as HTMLElement).catch(console.error)

loadedExts.add(exA)
loadedExts.add(exB)
loadedExts.add(exC)
loadedExts.add(exD)

// endregion

const myInput = document.querySelector('.my-input')! as HTMLInputElement

// region communication ...
window.addEventListener('message', (e) => {
  const ch = e.ports[0]
  const msg = e.data

  if (ch && msg && msg.startsWith(':establish')) {
    const k = msg.split(/\s+/)[1]
    ch.onmessage = oncomingMsgFromExts
    establishedExtsChan.set(k, ch)
    ch.postMessage(':established')
    console.warn(k, ' [:established]')
  }
})

/**
 * @param e
 */
function oncomingMsgFromExts (e: MessageEvent) {
  const { action, payload } = e.data

  switch (action) {
    case 'update-input-value':
      myInput.value = payload.value
      myInput.dispatchEvent(new Event('input'))
      break
    default:
  }
}

/**
 * @param action
 * @param payload
 */
function broadcastMsgToExts (action: string, payload: any) {
  for (const [k, p] of establishedExtsChan.entries()) {
    // TODO: k
    p.postMessage({
      action, payload
    })
  }
}

// endregion

// region host events (business)
{
  myInput.addEventListener('input', (e) => {
    broadcastMsgToExts('input-value-changed', { value: (e.target! as HTMLInputElement).value })
  }, false)
}
// endregion
