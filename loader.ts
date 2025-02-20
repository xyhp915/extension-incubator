import type { PromiseFn, Lifecycles } from './types'
import { run } from './sandbox'

const MATCH_ANY_OR_NO_PROPERTY = /["'=\w\s\/]*/
const SCRIPT_URL_RE = new RegExp(
  '<\\s*script' +
  MATCH_ANY_OR_NO_PROPERTY.source +
  '(?:src="(.+?)")' +
  MATCH_ANY_OR_NO_PROPERTY.source +
  '(?:\\/>|>[\\s]*<\\s*\\/script>)?',
  'g'
)
const SCRIPT_CONTENT_RE = new RegExp(
  '<\\s*script' +
  MATCH_ANY_OR_NO_PROPERTY.source +
  '>([\\w\\W]+?)<\\s*\\/script>',
  'g'
)
const SCRIPT_URL_OR_CONTENT_RE = new RegExp(
  '(?:' + SCRIPT_URL_RE.source + ')|(?:' + SCRIPT_CONTENT_RE.source + ')',
  'g'
)
const MATCH_NONE_QUOTE_MARK = /[^"]/
const CSS_URL_RE = new RegExp(
  '<\\s*link[^>]*' +
  'href="(' +
  MATCH_NONE_QUOTE_MARK.source +
  '+.css' +
  MATCH_NONE_QUOTE_MARK.source +
  '*)"' +
  MATCH_ANY_OR_NO_PROPERTY.source +
  '>(?:\\s*<\\s*\\/link>)?',
  'g'
)
const STYLE_RE = /<\s*style\s*>([^<]*)<\s*\/style>/g
const CSS_URL_OR_STYLE_RE = new RegExp(
  '(?:' + CSS_URL_RE.source + ')|(?:' + STYLE_RE.source + ')',
  'g'
)
const BODY_CONTENT_RE = /<\s*body[^>]*>([\w\W]*)<\s*\/body>/
const SCRIPT_ANY_RE = /<\s*script[^>]*>[\s\S]*?(<\s*\/script[^>]*>)/g
const TEST_URL = /^(?:https?):\/\/[-a-zA-Z0-9.]+/
const HTML_LIKE_COMMENT_RE = /\/\*[\s\S]*?\*\/|([^\\:]|^)\/\/.*|<!--[\s\S]*?-->/

export async function importHtml (
  app: { name: string, url: string }
): Promise<{
  lifecycle: Lifecycles
  styleNodes: HTMLStyleElement[]
  bodyNode: HTMLTemplateElement
}> {
  let template = await request(app.url as string)

  template = template.replace(HTML_LIKE_COMMENT_RE, '')

  const styleNodes = await loadCSS(template)
  const bodyNode = loadBody(template)
  const lifecycle = await loadScript(template, app.name)
  return { lifecycle, styleNodes, bodyNode }
}

export function request (url: string, option?: RequestInit): Promise<string> {
  return fetch(url, {
    // mode: 'no-cors',
    ...option
  }).then((res) => res.text())
}

export async function loadScript (
  template: string,
  name: string
): Promise<Lifecycles> {
  const scriptsToLoad = await Promise.all(
    parseScript(template).map((v: string) => {
      if (TEST_URL.test(v)) return request(v)
      return v
    })
  )

  let bootstrap: PromiseFn[] = []
  let unmount: PromiseFn[] = []
  let mount: PromiseFn[] = []

  scriptsToLoad.forEach((script) => {
    // TODO: improve
    const global = run(script, {})
    const lifecycles = global[name] || global.module.exports

    if (lifecycles) {
      bootstrap =
        typeof lifecycles.bootstrap === 'function'
          ? [...bootstrap, lifecycles.bootstrap]
          : bootstrap
      mount =
        typeof lifecycles.mount === 'function'
          ? [...mount, lifecycles.mount]
          : mount
      unmount =
        typeof lifecycles.unmount === 'function'
          ? [...unmount, lifecycles.unmount]
          : unmount
    }
  })

  return { bootstrap, unmount, mount }
}

function parseScript (template: string): string[] {
  const scriptList = []
  SCRIPT_URL_OR_CONTENT_RE.lastIndex = 0
  let match
  while ((match = SCRIPT_URL_OR_CONTENT_RE.exec(template))) {
    let captured
    if (match[1]) {
      captured = match[1].trim()
      if (!TEST_URL.test(captured)) {
        captured = window.location.origin + captured
      }
    } else if (match[2]) {
      captured = match[2].trim()
    }
    captured && scriptList.push(captured)
  }
  return scriptList
}

async function loadCSS (template: string): Promise<HTMLStyleElement[]> {
  const styles = await Promise.all(
    parseCSS(template).map((v: string) => {
      if (TEST_URL.test(v)) return request(v)
      return v
    })
  )
  return toStyleNodes(styles)

  function toStyleNodes (s: string[]): HTMLStyleElement[] {
    return s.map((style) => {
      const styleNode = document.createElement('style')
      styleNode.appendChild(document.createTextNode(style))
      return styleNode
    })
  }
}

function parseCSS (template: string): string[] {
  const cssList: string[] = []
  CSS_URL_OR_STYLE_RE.lastIndex = 0
  let match
  while ((match = CSS_URL_OR_STYLE_RE.exec(template))) {
    let captured
    if (match[1]) {
      captured = match[1].trim()
      if (!TEST_URL.test(captured)) {
        captured = window.location.origin + captured
      }
    } else if (match[2]) {
      captured = match[2].trim()
    }
    captured && cssList.push(captured)
  }
  return cssList
}

function loadBody (template: string): HTMLTemplateElement {
  let bodyContent = template.match(BODY_CONTENT_RE)?.[1] ?? ''
  bodyContent = bodyContent.replace(SCRIPT_ANY_RE, scriptReplacer)

  const body = document.createElement('template')
  body.innerHTML = bodyContent
  return body

  function scriptReplacer (substring: string): string {
    const matchedURL = SCRIPT_URL_RE.exec(substring)
    if (matchedURL) {
      return `<!-- Original script url: ${matchedURL[1]} -->`
    }
    return `<!-- Original script: inline script -->`
  }
}
