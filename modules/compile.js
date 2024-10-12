const globalNamespace = crypto.randomUUID(), nativeElementsMap = {
    ...Object.fromEntries(['abbr', 'address', 'article', 'aside', 'b', 'bdi', 'bdo', 'cite', 'code', 'dd', 'dfn', 'dt', 'em', 'figcaption', 'figure', 'footer', 'header',
        'hgroup', 'i', 'kbd', 'main', 'mark', 'nav', 'noscript', 'rp', 'rt', 'ruby', 's', 'samp', 'search', 'section', 'small', 'strong', 'sub', 'summary', 'sup', 'u', 'var', 'wbr'].map(l => [l, 'HTMLElement'])),
    ...Object.fromEntries(['blockquote', 'q'].map(l => [l, 'HTMLQuoteElement'])), ...Object.fromEntries(['col', 'colgroup'].map(l => [l, 'HTMLTableColElement'])),
    ...Object.fromEntries(['del', 'ins'].map(l => [l, 'HTMLModElement'])), ...Object.fromEntries(['h1', 'h2', 'h3', 'h4', 'h5', 'h6'].map(l => [l, 'HTMLHeadingElement'])),
    ...Object.fromEntries(['tbody', 'tfoot', 'thead'].map(l => [l, 'HTMLTableSectionElement'])), ...Object.fromEntries(['td', 'th'].map(l => [l, 'HTMLTableCellElement'])),
    ...{
        a: 'HTMLAnchorElement', area: 'HTMLAreaElement', audio: 'HTMLAudioElement', base: 'HTMLBaseElement', body: 'HTMLBodyElement', br: 'HTMLBRElement', button: 'HTMLButtonElement',
        canvas: 'HTMLCanvasElement', caption: 'HTMLTableCaptionElement', data: 'HTMLDataElement', datalist: 'HTMLDataListElement', details: 'HTMLDetailsElement', dialog: 'HTMLDialogElement',
        div: 'HTMLDivElement', dl: 'HTMLDListElement', embed: 'HTMLEmbedElement', fencedframe: 'HTMLFencedFrameElement', fieldset: 'HTMLFieldSetElement', form: 'HTMLFormElement',
        head: 'HTMLHeadElement', hr: 'HTMLHRElement', html: 'HTMLHtmlElement', iframe: 'HTMLIFrameElement', img: 'HTMLImageElement', input: 'HTMLInputElement', label: 'HTMLLabelElement',
        li: 'HTMLLIElement', link: 'HTMLLinkElement', map: 'HTMLMapElement', menu: 'HTMLMenuElement', meta: 'HTMLMetaElement', meter: 'HTMLMeterElement', object: 'HTMLObjectElement',
        ol: 'HTMLOListElement', optgroup: 'HTMLOptGroupElement', option: 'HTMLOptionElement', output: 'HTMLOutputElement', p: 'HTMLParagraphElement', picture: 'HTMLPictureElement',
        portal: 'HTMLPortalElement', pre: 'HTMLPreElement', progress: 'HTMLProgressElement', script: 'HTMLScriptElement', select: 'HTMLSelectElement', slot: 'HTMLSlotElement',
        source: 'HTMLSourceElement', span: 'HTMLSpanElement', style: 'HTMLStyleElement', table: 'HTMLTableElement', template: 'HTMLTemplateElement', textarea: 'HTMLTextAreaElement',
        time: 'HTMLTimeElement', title: 'HTMLTitleElement', tr: 'HTMLTableRowElement', track: 'HTMLTrackElement', ul: 'HTMLUListElement', video: 'HTMLVideoElement'
    }
}, regexp = {
    defaultValue: /\s+\?\?\s+(.+)\s*$/, extends: /export\s+default\s+class\s+extends\s+`(?<extends>.*)`\s+\{/, label: /^([\@\#]?[a-zA-Z0-9]+[\!\?]?):\s+/,
    directiveHandleMatch: /^([A-Z][A-Z0-9]*)::\s(.*)/, splitter: /\n(?!\s+>>)/gm, segmenter: /\s+>>\s+/g,
}, module = {
    isValidTag: {
        value: function (tag) {
            return !(document.createElement(tag) instanceof HTMLUnknownElement)
        }
    },
    canonicalizeDirectives: { // optimal
        value: async function (directives) {
            directives = directives.trim()
            if (!directives) return 'null'
            const canonicalizedDirectivesMap = {}, canonicalizedDirectives = [], { regexp: sysRegexp } = this.sys, { digest } = this.modules.compile
            for (let directive of directives.split(regexp.splitter)) {
                directive = directive.trim()
                if (!directive || directive.startsWith('|* ')) continue
                directive = directive.replace(regexp.segmenter, ' >> ')
                if (!directive) continue
                canonicalizedDirectivesMap[await digest(directive)] = directive
            }
            for (const directiveDigest of Object.keys(canonicalizedDirectivesMap).sort()) canonicalizedDirectives.push(canonicalizedDirectivesMap[directiveDigest])
            return canonicalizedDirectives.join('\n')
        }
    },
    digest: { // optimal
        value: async function (str) {
            if (typeof str !== 'string') str = String(str)
            const bytes = (new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(str)))), hex = '0123456789abcdef', digest = new Array(bytes.length * 2)
            for (let i = 0, j = 0, l = bytes.length, b; i < l; i++) {
                digest[j++] = hex[(b = bytes[i]) >> 4]
                digest[j++] = hex[b & 15]
            }
            return digest.join('')
        }
    },
    globalNamespace: { value: globalNamespace },
    parsers: {
        value: {
            // ai: async function (expression) { // optimal
            //     const [ai, prompt] = expression.slice(2, -1).trim().split(this.sys.regexp.pipeSplitterAndTrim)
            //     return { ai, prompt }
            // },
            // api: async function (expression) { // optimal
            //     const [api, action] = expression.slice(2, -1).trim().split(this.sys.regexp.pipeSplitterAndTrim)
            //     return { api, action }
            // },
            // command: async function (expression) { // optimal
            //     return { invocation: expression.slice(2, -1).trim() }
            // },
            // console: async function (expression) { // optimal
            //     return { verbose: expression === '$?' }
            // },
            // content: async function (expression) { // optimal
            //     const [collection, article, lang] = expression.slice(2, -1).trim().split(this.sys.regexp.pipeSplitterAndTrim)
            //     return { collection, article, lang }
            // },
            // pattern: async function (expression) { // optimal
            //     expression = expression.slice(1, -1)
            //     expression = (expression.endsWith('\\ ')) ? expression.trimStart() : expression.trim()
            //     expression.replaceAll('\\ ', ' ')
            //     return { pattern: expression }
            // },
            // request: async function (expression) { // optimal
            //     const [url, contentType] = this.expression.slice(1, -1).trim().split(this.sys.regexp.pipeSplitterAndTrim)
            //     return { url, contentType }
            // },
            // router: async function (expression) { // optimal
            //     return { expression, signal: expression === '#' }
            // },
            // selector: async function (expression) { // optimal
            //     return { signal: true, ...(await this.resolveScopedSelector(expression.slice(2, -1))) }
            // },
            // shape: async function (expression) { // optimal
            //     return { shape: this.resolveShape(expression) }
            // },
            // state: async function (expression) { // optimal
            //     expression = expression.trim()
            //     const typeDefault = expression[0] === '@' ? 'field' : 'cell'
            //     expression = expression.slice(1).trim()
            //     const { group: target, shape } = this.modules.compile.getStateGroup(expression, typeDefault)
            //     return { signal: true, target, shape }
            // },
            // transform: async function (expression) { // optimal
            //     return { transform: expression.slice(1, -1).trim() }
            // },
            // type: async function (expression) { // optimal
            //     let mode = 'any', types = []
            //     expression = expression.slice(1, -1).trim()
            //     switch (expression[0]) {
            //         case '|':
            //             if (expression.endsWith('|')) [mode, expression] = ['all', expression.slice(1, -1).trim()]
            //             break
            //         case '?': if (expression.endsWith('?')) [mode, expression] = ['info', expression.slice(1, -1).trim()]
            //     }
            //     for (let typeName of expression.split(',')) {
            //         typeName = typeName.trim()
            //         if (!typeName) continue
            //         const ifMode = typeName[0] !== '!'
            //         types.push({ if: ifMode, name: ifMode ? typeName : typeName.slice(1) })
            //     }
            //     return { types, mode }
            // },
            // value: async function (expression) { // optimal
            //     return { value: expression in this.sys.valueAliases ? this.sys.valueAliases[expression] : JSON.parse(expression) }
            // },
            // variable: async function (expression) { // optimal
            //     return { expression: expression.slice(2, -1).trim() }
            // },
            // wait: async function (expression) { // optimal
            //     return { expression: expression.slice(1, -1).trim() }
            // }
        }
    }
}
export { module }