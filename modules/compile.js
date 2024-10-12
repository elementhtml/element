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

}
export { module }