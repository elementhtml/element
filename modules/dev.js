const branding = Object.freeze({
    background: '#131B2E',
    text: '#F0F1F3',
    accent1: '#69B4FF', //blue
    accent2: '#50E991', // green
    accent3: '#FFDF6C', //yellow
    error: '#FF6B6B', // red
    ai: '#9B5DE5', //purple
    darkerBackground: '#0C1320',
    icon: 'data:image/webp;base64,UklGRpIAAABXRUJQVlA4TIYAAAAvEAAEEJ+AoG3buKM09uP2noaBtG3y2b3xq/jUtm3D0P+PfjdFTSRbzc/dr//gAAv4L2mjChSkANy+v3d+kbDWxu/IqQCGBFJvWHtt/EHFj2AzBQraSFL2me8e/Kv9hA1E9H8C+Mfeeq/rNGgXB6VbF4C363EyyxkIZj0BqqxrHKT9us8/Ag=='
}), block = `background: url(${branding.icon}) no-repeat left; background-size: 13px; padding: 7px 0 7px 17px; margin: 7px 0;`, line = `font-size: 11px; font-family: monospace; line-height: 1.5em;`,
    formats = Object.freeze({
        answer: `${block} color: ${branding.ai}; font-size: 13px; font-weight: light; font-style: italic; font-family: cursive;`, // used to show responses from @ and @eli AI bots
        answerLine: `${line} color: ${branding.ai}; font-size: 13px; font-weight: light; font-style: italic; font-family: cursive;`,

        command: `${line} color: ${branding.accent2}; font-size: 13px; font-family: monospace;`, // used to highlight commands within other responses
        error: `${block} color: ${branding.error}; font-weight: bold;`, // used to show framework-specific errors, for example: alert about an error caused by an invalid directive
        info: `${block} color: ${branding.accent1}; font-weight: normal; font-style: normal; font-size: 9px; font-family: sans-serif; background-color: ${branding.darkerBackground}37; padding-right: 3px;`, // used to show framework-specific information, for example: informational messages from the framework itself such as an invalid or useless directive but which is not causing an actual error
        response: `${block} color: ${branding.text}; font-weight: normal;`, // used to respond to commands when the response is not otherwise better suited to another format (such as a table)
        responseLine: `${line} color: ${branding.text}; font-weight: normal;`,

        suggestion: `${block} color: ${branding.accent2}93; font-weight: normal; font-style: italic; background-color: ${branding.background}; padding-right: 3px;`, // used to show suggestions for improvement or clarification to the developer, for example: a poorly constructed directive
        title: `${block} color: ${branding.text}; font-size: 13px; font-weight: bold; margin: 11px 0; text-decoration: underline; text-underline-offset: 3px; text-transform: capitalize;`, // used as the titles for tables
        tutorial: `${block} color: ${branding.accent1}; font-weight: normal; background-color: ${branding.accent2}17; padding-right: 3px;`, // used for extended sections with extended 'help' messages showing the developer how to do tasks or use features
        tutorialLine: `${line} color: ${branding.accent1}; font-weight: normal; background-color: ${branding.accent2}17; padding-right: 3px;`,

        warning: `${block} color: ${branding.accent3}; font-weight: bold;`, // used to show framework-specific warnings, for example: a directive which may not be doing what the developer expects it to
        welcome: `${block} background-size: 17px; color: ${branding.accent1}; font-size: 17px; font-weight: bold; display: block; margin-bottom: 13px; border-bottom: 3px dashed ${branding.accent1};`
    }), print = (text, format) => {
        format ??= 'response'
        const blockFormat = formats[format], lineFormat = formats[`${format}Line`]
        for (let i = 0, lines = text.split('\n'), line = lines[i], l = lines.length; i < l; line = lines[++i]) console.log(`%c ${line}`, i === 0 ? blockFormat : lineFormat)
    }

const module = {

    branding: { value: branding },

    commands: {
        value: Object.freeze({
            grab: {
                help: '',
                target: ['dev', 'grab']
            },
            help: {
                help: '',
                target: ['dev', 'console', 'help']
            },
            save: {
                help: '',
                target: ['dev', 'save']
            },
            send: {
                help: '',
                target: ['dev', 'send']
            },
            show: {
                help: '',
                target: ['dev', 'console', 'show']
            },
            stop: {
                help: '',
                target: ['dev', 'console', 'stop']
            }

        })
    },

    console: {
        value: {
            formats,
            help: async function (command) {
                print('Command Overview:', 'title')
                print(`Welcome to the Element Developer Console! Here’s how to interact with the command system:
                
                    1. **Syntax**: 
                       - Commands in the Element framework are typed in the following format:
                         \`\`\`
                         $ \`command arg1 arg2 ...\`
                         \`\`\`
                    
                    2. **Arguments**:
                       - **Separation**: Arguments are separated by spaces. If an argument contains spaces, enclose it in quotes.
                         \`\`\`
                         $ \`command "arg with spaces" arg2\`
                         \`\`\`
                       - **Standard Element Variable Syntax**: Each argument can use the Element variable syntax for dynamic and context-aware command execution.
                    
                    3. **Element Variable Syntax**:
                       - **Basic Syntax**: Variables are identified by specific prefixes:
                         - ** $name **: Represents a label from the local context.
                         - ** @name**: Represents a field, which is typically local to the context or a component.
                         - ** #name **: Represents a cell, which is a globally accessible state value.
                         - ** ~name**: Represents a global context value, like a configuration setting or a constant.
                       - ** Examples **:
                         - ** Labels **: \`$label\`
                        - ** Fields **: \`@field\`
                            - ** Cells **: \`#cell\`
                                - ** Context **: \`~context\`
    
                    4. ** Advanced Variable Parsing **:
                    - Variables can be structured and complex, including arrays and objects.
                       - The system intelligently resolves these based on your application’s state and context, ensuring that each variable is interpreted correctly according to its scope and intended use.
                       - You can combine these with dot notation for nested properties: \`#cell.property\`, \`@field.method()\`.
                    
                    This is a basic overview to get you started. To explore specific commands and their usage, type \`$help [command]\` in the console. For example:
                    \`\`\`
                    $ help show
                    \`\`\`
                    
                    Happy coding! 🚀
                    `, 'response')



            },
            welcome: async function () {
                console.log(`%c Welcome to your Element Developer Experience! 🎉`, formats.welcome);
                console.log(`%c You're now in the driver's seat of your application 🏎️.`, formats.response);
                console.log(`%c Pro Tip #1: Accelerate your workflow! 🚀 Use $\`\` to send direct commands and watch the magic happen! 🪄`, formats.tutorial);
                console.log(`%c Pro Tip #2: Go deep! 🌊 Use $\`help\` to discover available commands, and dive deeper with $\`help [command]\`. For example: $\`help show\` ⚡`, formats.tutorial);
                console.log(`%c Pro Tip #3: Need a hand? 🛟 Summon our AI co-pilot with a quick @\`\`, or check-in with @eli\`\` for friendly, personalized tutorials. 🧙‍♂️`, formats.tutorial);
                console.log(`%c Stay connected! 🌐 Visit us at https://elementhtml.dev/ for complete documentation 📜📚 and an awesome community 🌟🌈. Happy coding! ✨`, formats.suggestion);
            },
            show: function (what, filters = {}, clear = undefined, label = undefined, run = undefined) {
                run ?? true
                let signal
                if (label) {
                    switch (run) {
                        case true:
                            if (this.dev.controllers.console.show[label]) this.dev.controllers.console.show[label].abort()
                            this.dev.controllers.console.show[label] = new AbortController()
                            signal = this.dev.controllers.console.show[label].signal
                            break
                        case false:
                            if (this.dev.controllers.console.show[label]) {
                                this.dev.controllers.console.show[label].abort()
                                delete this.dev.controllers.console.show[label]
                                return
                            }
                    }
                }
                const tableData = this.dev.tabulate(what, filters)
                switch (what) {
                    case 'cells':
                        if (run === true) for (const cellName of Object.keys(this.app.cells).sort())
                            if (filters[cellName] !== false) this.app.cells[cellName].eventTarget.addEventListener('change', () => this.dev.console.show('cells', filters, clear), { signal })
                        break
                    case 'fields':
                        if (run === true) {
                            const { container } = filters
                            const containerElement = document.querySelector(`script[type$=\\/element][id="${container}"]`) ?? document.querySelector(`script[type$=\\/element][name="${container}"]`) ?? document.querySelector(`script[type$=\\/element][data-facet-cid="${container}"]`)
                            const facetInstance = this.app.facets.instances.get(containerElement)
                            for (const fieldName of Object.keys(facetInstance.fields).sort())
                                if (filters[fieldName] !== false) facetInstance.fields[fieldName].eventTarget.addEventListener('change', () => this.dev.console.show('fields', filters, clear), { signal })
                        }
                        break
                }
                if (clear) console.clear()
                console.table(tableData)
            },
            stop: function (label) {
                if (this.dev.controllers.console.show[label]) {
                    this.dev.controllers.console.show[label].abort()
                    delete this.dev.controllers.console.show[label]
                }
            }
        }
    },

    controllers: {
        value: Object.freeze({
            console: Object.freeze({
                show: {}
            })
        })
    },

    invokers: {
        value: {
            $: function (input) {
                let [invocation] = input
                invocation = invocation.trim()
                if (!invocation) return console.error(`No command entered`)
                const [command, ...args] = invocation.split(/(?<!["'])\s+(?![^"']*["'])/).map(s => s.trim())
                if (!(command in this.dev.commands)) return console.error(`Command ${command} not found`)
                const { target = [command] } = this.dev.commands[command]
                let funcScope = this
                for (const s of target) funcScope = funcScope[s]
                if (typeof funcScope !== 'function') return console.error(`Command ${command} not correctly configured: this.${target.join('.')}() is not a valid function.`)
                const func = funcScope, labels = {}, env = { cells: this.app.cells, context: this.app.context }, envelope = { labels, env }
                for (let i = 0, l = args.length; i < l; i++) args[i] = this.resolveVariable(args[i].trim(), { wrapped: false }, { cells: this.flatten(this.app.cells), context: this.env.context })
                const result = func(...args)
                if (result instanceof Promise) {
                    result.then(r => console.log(r)).catch(e => console.error(e))
                } else {
                    return result
                }
            },
            ['@']: function (prompt) {
            },
            ['@eli']: function (prompt) {
            },
        }
    },

    tabulate: {
        value: function (what, filters = {}) {
            if (!filters || (typeof filters !== 'object')) filters = typeof filters == 'string' ? { [filters]: true } : {}
            const tableData = {}
            switch (what) {
                case 'cells':
                    for (const cellName of Object.keys(this.app.cells).sort()) if (filters[cellName] !== false) tableData[`#${cellName}`] = { value: this.app.cells[cellName].get() }
                    break
                case 'fields':
                    const { container } = filters
                    if (!container) throw new Error('No facet container specified')
                    const containerElement = document.querySelector(`script[type$=\\/element][id="${container}"]`) ?? document.querySelector(`script[type$=\\/element][name="${container}"]`) ?? document.querySelector(`script[type$=\\/element][data-facet-cid="${container}"]`)
                    if (!containerElement) throw new Error(`Facet container ${container} not found.`)
                    const facetInstance = this.app.facets.instances.get(containerElement)
                    if (!facetInstance) throw new Error(`A facet instance for container ${container} was not found.`)
                    for (const fieldName of Object.keys(facetInstance.fields).sort()) if (filters[fieldName] !== false) tableData[`@${fieldName}`] = { value: facetInstance.fields[fieldName].get() }
                    break
            }
            return tableData
        }
    },

    export: {
        enumerable: true, value: {
            unit: {
                value: function (unitType, identifier, format) {
                    if (unitType !== 'component' && unitType !== 'facet') throw new Error(`Invalid unitType ${unitType}`)
                    let unitClass
                    if (!identifier) throw new Error(`An identifier is required`)
                    if (identifier instanceof HTMLElement) {
                        if (unitType === 'component') identifier = this.app.components.virtuals.get(identifier) ?? identifier
                        unitClass = unitType === 'component' ? identifier.constructor : this.app.facets.instances.get(identifier).constructor
                    } else if (identifier.prototype) {
                        unitClass = unitType === 'component' ? (identifier.prototype instanceof this.Component ? identifier : undefined)
                            : (identifier.prototype instanceof this.Facet ? identifier : undefined)
                    } else if (typeof identifier === 'string') {
                        unitClass = this.app[`${unitType}s`].classes[identifier]
                    }
                    if (!unitClass) throw new Error(`No ${unitType} found with identifier ${identifier}`)
                    switch (format) {
                        case 'string':
                            const unitClassString = unitClass.toString()
                            if (unitType === 'facet') return unitClassString
                            const componentClassString = this.Component.toString()
                            if (unitClassString === componentClassString) return `class ${identifier} extends E.Component {}`
                            return unitClassString
                        default:
                            return unitClass
                    }
                }
            },
            component: {
                enumerable: true, value: function (id, format) {
                    return this.dev.export.unit('component', id, format)
                }
            },
            facet: {
                enumerable: true, value: function (cid, format) {
                    return this.dev.export.unit('facet', cid, format)
                }
            },
            package: {
                enumerable: true, value: async function (includes = {}, options = {}, overrides = {}) {
                    if (!includes || (typeof includes !== 'object')) throw new Error(`Invalid includes object`)
                    const includesScopes = new Map(), openingLine = 'const Package = {};', closingLine = 'export default Package;',
                        allowPackages = new Set(includes.packages instanceof Set ? this.app.packages.keys().filter(k => !includes.packages.has(k)) : (Array.isArray(includes.packages)
                            ? this.app.packages.keys().filter(p => includes.packages.includes(p)) : this.app.packages.keys()))
                    for (const a in this.env) {
                        if (!Array.isArray(includes[a])) includes[a] ??= new Set()
                        if (!this.app.archives.has(a)) this.app.archives.set(a, new Map())
                        if (!this.app.packages.has(a)) this.app.packages.set(a, new Map())
                        let packagesA, includesA = includes[a]
                        switch (a) {
                            case 'context':
                                includesScopes.set(a, Array.from(new Set(includesA instanceof Set ? Object.keys(this.env[a]).filter(k => !includesA.has(k)) : includesA)))
                                break
                            case 'helpers': case 'hooks': case 'loaders':
                                includesScopes.set(a, Array.from(new Set(includesA instanceof Set ? Object.keys(this.app.archives[a] ?? {}).filter(k => !includesA.has(k)) : includesA)))
                                break
                            default:
                                packagesA = this.app.packages.get(a)
                                includesScopes.set(a, Array.from(new Set(includesA instanceof Set ? Object.keys((a === 'components' || a === 'facets') ? this.app[a].classes : this.env[a])
                                    .filter(k => !includesA.has(k)) : includesA)).filter(c => !packagesA.has(c) || allowPackages.has(packagesA.get(c))))
                        }
                        const includesScopesA = includesScopes.get(a), overridesA = overrides[a] ?? {}
                        if (overridesA && (typeof overridesA === 'object')) for (const ov in overridesA) if (!includesScopesA.includes(ov)) includesScopesA.push(ov)
                        includesScopesA.sort()
                    }
                    let packageSource = `${openingLine}`
                    for (const [scope, scopeItems] of includesScopes) {
                        if (!scopeItems.length) continue
                        const manualScopes = new Set(['options', 'namespaces'])
                        let scopeInitialized = false
                        if (!manualScopes.has(scope)) scopeInitialized = !!(packageSource += `\n\nPackage.${scope} ??= {}`)
                        const scopeOptions = options[scope] ?? {}
                        switch (scope) {
                            case 'components':
                                const idReplacers = scopeOptions.replacers?.id
                                for (const id of scopeItems) {
                                    let renderId = id
                                    if (idReplacers) {
                                        for (let r of idReplacers) {
                                            if (typeof r === 'string') r = { pattern: document.location.origin, replaceWith: r, flags: undefined }
                                            renderId = renderId.replace(new RegExp(r.pattern, r.flags), r.replaceWith)
                                        }
                                    }
                                    packageSource += `\nPackage.${scope}['${renderId}'] = E => (${this.dev.export.component((overrides[scope] ?? {})[id] ?? id, 'string')})`
                                }
                                break
                            case 'context':
                                for (const key of scopeItems) try { packageSource += `\nPackage.${scope}['${key}'] = ${JSON.stringify((overrides[scope] ?? {})[key] ?? this.env.context[key] ?? 'null')}` } catch (e) {
                                    throw new Error(`${scope} key ${key} could not be exported`)
                                }
                                break
                            case 'facets':
                                for (const cid of scopeItems) packageSource += `\nPackage.${scope}['${cid}'] = E => (${this.dev.export.facet((overrides[scope] ?? {})[cid] ?? cid, 'string')})`
                                break
                            case 'helpers': case 'hooks': case 'loaders':
                                const isHooks = scope === 'hooks', hookPackages = isHooks ? scopeOptions.packages : new Set(), hookPackagesIsSet = hookPackages instanceof Set
                                if (isHooks && (hookPackagesIsSet || Array.isArray(hookPackages))) {
                                    for (const hookName of scopeItems) {
                                        let packagesWithHooksWithThisName = this.app.packages[scope][hookName]
                                        if (!packagesWithHooksWithThisName) continue
                                        for (const hookPackage of packagesWithHooksWithThisName) {
                                            if (hookPackagesIsSet ? !hookPackages.has(hookPackage) : hookPackages.includes(hookPackage)) {
                                                packageSource += `\nPackage.${scope}['${hookName}'] ??= []\n`
                                                packageSource += `\nPackage.${scope}['${hookName}'].push(${((overrides[scope] ?? {})[hookName] ?? this.app.archives[scope][hookName][hookPackage]).toString()})`
                                            }
                                        }
                                    }
                                } else {
                                    for (const n of scopeItems) packageSource += `\nPackage.${scope}['${n}'] = ${((overrides[scope] ?? {})[n] ?? this.app.archives[scope][n]).toString()}`
                                }
                                break
                            case 'namespaces':
                                const nsReplacers = scopeOptions.replacers?.id
                                for (const n of scopeItems) if (n !== 'e') {
                                    let renderNamespace = this.env[scope][n]
                                    if (nsReplacers) {
                                        for (let r of nsReplacers) {
                                            if (typeof r === 'string') r = { pattern: document.location.origin, replaceWith: r, flags: undefined }
                                            renderNamespace = renderNamespace.replace(new RegExp(r.pattern, r.flags), r.replaceWith)
                                        }
                                    }
                                    if (!scopeInitialized) scopeInitialized = !!(packageSource += `\n\nPackage.${scope} ??= {}`)
                                    packageSource += `\nPackage.${scope}['${n}'] = '${(overrides[scope] ?? {})[n] ?? renderNamespace}'`
                                }
                                break
                            case 'options':
                                const currentOptionsToString = JSON.stringify(this.env[scope]), builtinOptionsToString = JSON.stringify(this.app.archives.get(scope))
                                if (currentOptionsToString !== builtinOptionsToString) {
                                    const builtInOptions = JSON.parse(builtinOptionsToString)
                                    for (const key of scopeItems) try {
                                        if (this.env[scope][key] === undefined) throw new Error(`${scope} key ${key} is undefined`)
                                        const builtInOptionString = JSON.stringify(builtInOptions[key]), currentOptionString = JSON.stringify((overrides[scope] ?? {})[key] ?? this.env[scope][key] ?? null)
                                        if (builtInOptionString !== currentOptionString) {
                                            if (!scopeInitialized) scopeInitialized = !!(packageSource += `\n\nPackage.${scope} ??= {}`)
                                            packageSource += `\nPackage.${scope}['${key}'] = ${currentOptionString}`
                                        }
                                    } catch (e) {
                                        throw new Error(`${scope} key ${key} could not be exported`)
                                    }
                                }
                                break
                            case 'regexp':
                                for (const n of scopeItems) if (this.env[scope][n]) packageSource += `\nPackage.${scope}['${n}'] = new RegExp("${((overrides[scope] ?? {})[n] ?? this.env[scope][n]).source}", "${((overrides[scope] ?? {})[n] ?? this.env[scope][n]).flags}")`
                                break
                            case 'templates':
                                for (const n of scopeItems) if (this.env[scope][n]) packageSource += `\nPackage.${scope}['${n}'] = E => { const t = document.createElement('template'); t.innerHTML = \`${(overrides[scope] ?? {})[n] ?? this.env[scope][n].innerHTML ?? ''}\`; return t }`
                                break
                            case 'transforms':
                                for (const n of scopeItems) {
                                    const transform = ((overrides[scope] ?? {})[n]) ?? this.env[scope][n] ?? ((this.app[scope][n] ?? [])[0])
                                    if (!transform) throw new Error(`${scope} ${n} could not be found`)
                                    packageSource += `\nPackage.${scope}['${n}'] = \`${transform}\``
                                }
                                break
                            case 'types':
                                for (const n of scopeItems) if (this.env[scope][n]) try { packageSource += `\nPackage.${scope}['${n}'] = ${JSON.stringify((overrides[scope] ?? {})[n] ?? this.env[scope][n] ?? {})}` } catch (e) {
                                    throw new Error(`${scope} ${n} could not be exported`)
                                }
                                break
                        }
                    }
                    packageSource += `\n\n${closingLine}`
                    return packageSource
                }
            },

            application: {
                enumerable: true, value: async function* (options = { as: 'auto' }, manifest = {}) {
                    if (typeof manifest === 'string') manifest = await fetch(this.resolveUrl(manifest)).then(r => r.json())
                    manifest.base ??= document.location.href.split('/').slice(0, -1).join('/')
                    options ??= { as: 'auto' }
                    if (typeof options === 'string') options = { as: options }
                    if (typeof options !== 'object') options = { as: 'auto' }
                    options.as ??= 'auto'
                    const mergeVars = (obj) => { for (const v in vars) for (const k in obj) if (typeof obj[k] === 'string') obj[k] = obj[k].replace(new RegExp(`\\$\\{${v}}`, 'g'), vars[v]) },
                        slashesRegExp = /^\/|\/$/g, { base, blocks = {}, vars = {}, pages = { '': {} }, assets = {}, frameworkSrc = 'https://cdn.jsdelivr.net/gh/elementhtml/element/element.js?load&packages' } = manifest,
                        fileToDataURL = file => new Promise(r => {
                            const reader = new FileReader()
                            reader.onload = () => r(reader.result)
                            reader.readAsDataURL(file)
                        }), optionsAs = typeof options.as === 'string' ? { [options.as]: '.*' } : (options.as ?? {}), isBinaryFile = f => {
                            return new Promise(r => {
                                const reader = new FileReader()
                                reader.onloadend = (e) => r(new Uint8Array(e.target.result).some(byte => byte === 0))
                                reader.readAsArrayBuffer(f.slice(0, 512))
                            })
                        }, renderFile = async (fp, f) => {
                            for (const asFunc in optionsAs) if (optionsAs[asFunc].test(fp)) {
                                if (asFunc === 'auto') {
                                    return (await isBinaryFile(f)) ? await fileToDataURL(f) : await f.text()
                                } else {
                                    return (asFunc === 'dataurl') ? await fileToDataURL(f) : (f[asFunc] ? await f[asFunc]() : (asFunc === 'file' ? f : undefined))
                                }
                            }
                            return f
                        }
                    for (const rx in optionsAs) if (optionsAs[rx]) optionsAs[rx] = new RegExp(optionsAs[rx])
                    Object.assign(vars, { name: vars.name ?? manifest.name, title: vars.title ?? manifest.title, description: vars.description ?? manifest.description, image: vars.image ?? manifest.image })
                    let { pwa, robots, sitemap } = manifest, sitemapObj, sitemapDefaults
                    switch (typeof sitemap) {
                        case 'boolean':
                            if (sitemap) {
                                sitemapObj = {}
                                sitemapDefaults = { changefreq: 'weekly', priority: 0.5, lastmod: new Date().toISOString() }
                            }
                            break
                        case 'object':
                            sitemapObj = {}
                            sitemapDefaults = { changefreq: sitemap.changefreq ?? 'weekly', priority: sitemap.priority ?? 0.5, lastmod: sitemap.lastmod ?? (new Date().toISOString()) }
                            break
                    }
                    if (!base) return
                    for (const pathname in pages) {
                        if (pathname.match(slashesRegExp)) continue
                        const page = pages[pathname]
                        mergeVars(page)
                        const { source = globalThis.location.href, name = vars.name, title = vars.title, description = vars.description, image = vars.image } = page,
                            filepath = pathname ? (pathname.endsWith('.html') ? pathname : `${pathname}/index.html`) : 'index.html',
                            canonicalUrl = new URL(pathname, base).href, canonicalImage = (new URL(image, base)).href,
                            sourceUrl = new URL(source, globalThis.location.href).href, sourceFetch = await fetch(sourceUrl),
                            sourceText = sourceFetch.ok ? (await sourceFetch.text()) : undefined
                        if (!sourceText) continue
                        const template = document.createElement('html')
                        template.innerHTML = sourceText
                        const head = template.querySelector('head')
                        if (!head) continue
                        const elementFrameworkPreloadElement = head.querySelector('link[rel="modulepreload"][href*="element.js?"]'),
                            elementFrameworkModuleElement = head.querySelector('script[type="module"][src*="element.js?"]')
                        if (!elementFrameworkModuleElement) continue
                        if (elementFrameworkPreloadElement) {
                            const newFrameworkPreloadElement = document.createElement('link')
                            newFrameworkPreloadElement.setAttribute('rel', 'modulepreload')
                            newFrameworkPreloadElement.setAttribute('href', frameworkSrc)
                            elementFrameworkPreloadElement.replaceWith(newFrameworkPreloadElement)
                        }
                        const newFrameworkModuleElement = document.createElement('script')
                        newFrameworkModuleElement.setAttribute('type', 'module')
                        newFrameworkModuleElement.setAttribute('src', frameworkSrc)
                        elementFrameworkModuleElement.replaceWith(newFrameworkModuleElement)
                        const importMapElement = head.querySelector('script[type="importmap"]')
                        if (importMapElement) importMapElement.remove()
                        if (this.app.compile) for (const facetContainer of template.querySelectorAll(`script[type="directives/element"],script[type="facet/element"]:not([src])`)) {
                            const src = facetContainer.getAttribute('src'), textContent = facetContainer.textContent
                            const directives = await this.compile?.canonicalizeDirectives(src ? await fetch(this.resolveUrl(src)).then(r => r.text()) : textContent)
                            if (!directives) break
                            const facetCid = await this.compile?.cid(directives), newFacetContainer = document.createElement('script')
                            newFacetContainer.setAttribute('src', facetCid)
                            newFacetContainer.setAttribute('type', 'application/element')
                            facetContainer.replaceWith(newFacetContainer)
                        }
                        page.meta ??= {}
                        if (description) page.meta.description ??= description
                        page.link ??= {}
                        if (image) page.link.icon = image
                        for (const metaType of ['link', 'meta', 'og', 'schema', 'twitter']) if (page[metaType] && (typeof page[metaType] === 'object')) mergeVars(page[metaType])
                        const metaMaps = {
                            link: { icon: image, canonical: canonicalUrl, manifest: page.link?.manifest ?? (pwa ? 'manifest.json' : undefined), ...(page.link ?? {}) },
                            meta: { 'application-name': name, ...(page.meta ?? {}) },
                            og: { type: 'website', site_name: name, title, image: canonicalImage, url: canonicalUrl, description: page.meta?.description, ...(page.og ?? {}) },
                            schema: {
                                '@context': 'https://schema.org', '@type': 'WebSite', name, headline: title, image: canonicalImage,
                                url: canonicalUrl, description: page.meta?.description, keywords: page.meta?.keywords, author: page.meta?.author, ...(page.schema ?? {})
                            },
                            twitter: { card: 'summary_large_image', image: canonicalImage, url: canonicalUrl, description: page.meta?.description, ...(page.twitter ?? {}) }
                        }
                        switch (page.robots && !metaMaps.meta['robots']) {
                            case true: metaMaps.meta['robots'] = 'index, follow'; break
                            case false: metaMaps.meta['robots'] = 'noindex, nofollow'; break
                            default: if (typeof page.robots === 'string') metaMaps.meta['robots'] = page.robots
                        }
                        if (sitemapDefaults) sitemapObj[canonicalUrl] = { ...(typeof page.sitemap === 'object' ? page.sitemap : {}), ...sitemapDefaults }
                        if (title) {
                            const titleElement = head.querySelector('title') ?? head.insertAdjacentElement('afterbegin', document.createElement('title'))
                            let titleText = title
                            for (const v in vars) titleText = titleText.replace(new RegExp(`\\$\\{${v}}`, 'g'), vars[v])
                            titleElement.textContent = titleText
                        }
                        for (const type in metaMaps) {
                            const placeholder = head.querySelector(`meta[name="element-${type}"]`) ?? (page[type] ? head.insertAdjacentElement('beforeend', document.createElement('meta')) : undefined)
                            if (!placeholder) continue
                            if (type === 'schema') {
                                const schemaElement = document.createElement('script')
                                schemaElement.setAttribute('type', 'application/ld+json')
                                if (placeholder.content) metaMaps.schema = Object.fromEntries(placeholder.content.split(',').map(s => s.trim()).filter(s => s).map(s => metaMaps.schema[s]))
                                schemaElement.textContent = JSON.stringify(metaMaps.schema)
                                placeholder.replaceWith(schemaElement)
                                return
                            }
                            if (placeholder.content) metaMaps[type] = Object.fromEntries(placeholder.content.split(',').map(s => s.trim()).filter(s => s).map(s => metaMaps[type][s]))
                            const metaTemplate = document.createElement('template')
                            for (const n in metaMaps[type]) {
                                if (metaMaps[type][n] == null) continue
                                let el
                                switch (type) {
                                    case 'link':
                                        el = document.createElement('link')
                                        el.setAttribute('rel', n)
                                        el.setAttribute('href', metaMaps[type][n])
                                        break
                                    case 'meta': case 'og': case 'twitter':
                                        el = document.createElement('meta')
                                        el.setAttribute(type === 'og' ? 'property' : 'name', type === 'meta' ? n : `${type}:${n}`)
                                        el.setAttribute('content', metaMaps[type][n])
                                        break
                                }
                                metaTemplate.content.appendChild(el)
                            }
                            placeholder.replaceWith(...metaTemplate.content.cloneNode(true).children)
                        }
                        let swPlaceholder = pwa ? head.querySelector(`meta[name="element-sw"]`) : undefined
                        if (!swPlaceholder && pwa) swPlaceholder = head.insertAdjacentElement('beforeend', document.createElement('meta'))
                        if (swPlaceholder) {
                            const swElement = document.createElement('script'),
                                swFilename = (swPlaceholder.content ? (swPlaceholder.content.endsWith('.js') ? swPlaceholder.content : `${swPlaceholder.content}.js`) : 'sw.js').trim()
                            swElement.setAttribute('type', 'application/javascript')
                            swElement.textContent = `navigator.serviceWorker.register('/${swFilename}', { scope: '/' }).catch(function(err) { console.log('ServiceWorker registration failed: ', err); });`
                            swPlaceholder.replaceWith(swElement)
                            assets[swFilename] ??= new File([new Blob(['// empty service worker'], { type: 'application/javascript' })], swFilename, { type: 'application/javascript' })
                        }
                        for (const blockPlaceholder of head.querySelectorAll('meta[name="element-block"]')) {
                            const block = blockPlaceholder.content.trim()
                            if (!block) continue
                            let blockTemplateInnerHTML = (page.blocks ?? {})[block] ?? (blocks ?? {})[block]
                            for (const v in vars) blockTemplateInnerHTML = blockTemplateInnerHTML.replace(new RegExp(`\\$\\{${v}}`, 'g'), vars[v])
                            const blockTemplate = document.createElement('template')
                            blockTemplate.innerHTML = blockTemplateInnerHTML
                            blockPlaceholder.replaceWith(...blockTemplate.content.cloneNode(true).children)
                        }
                        let file = new File([new Blob([template.outerHTML], { type: 'text/html' })], filepath.split('/').pop(), { type: 'text/html' })
                        yield { filepath, file: await renderFile(filepath, file) }
                    }
                    assets['packages/main.js'] ??= new File([new Blob([await this.dev.export.package()], { type: 'application/javascript' })], 'main.js', { type: 'application/javascript' })
                    if (pwa) {
                        const pwaDefaults = {
                            name: vars.title ?? vars.name,
                            short_name: vars.name,
                            description: vars.description,
                            icons: [],
                            start_url: '/index.html',
                            display: 'standalone',
                            background_color: '#ffffff',
                            theme_color: '#ffffff',
                            orientation: 'portrait'
                        }
                        if (pwa === true) pwa = { ...pwaDefaults }
                        for (const n in pwaDefaults) pwa[n] ??= pwaDefaults[n]
                        if (pwa.icons.length === 0) {
                            if (vars.image) {
                                pwaDefaults.icons.push({ src: vars.image, sizes: '48x48', type: `image/${vars.image.split('.').pop()}` })
                            } else if (assets['favicon.ico']) {
                                pwaDefaults.icons.push({ src: 'favicon.ico', sizes: '48x48', type: 'image/x-icon' })
                            }
                        }
                        mergeVars(pwa)
                        assets['manifest.json'] ??= new File([new Blob([JSON.stringify(pwa, null, 4)], { type: 'application/json' })], 'manifest.json', { type: 'application/json' })
                    }
                    if (robots === true) robots = ['User-agent: *', 'Disallow:'].join('\n')
                    if (robots) assets['robots.txt'] ??= new File([new Blob([robots], { type: 'text/plain' })], 'robots.txt', { type: 'text/plain' })
                    if (sitemap) {
                        let sitemapContent = []
                        if (typeof sitemap === 'string') sitemapContent = [sitemap]
                        if (sitemapObj) {
                            const urlsetElement = document.createElement('urlset'), urlElements = []
                            urlsetElement.setAttribute('xmlns', 'http://www.sitemaps.org/schemas/sitemap/0.9')
                            for (const loc in sitemapObj) urlElements[urlElements.push(document.createElement('url')) - 1].innerHTML = (`<loc>${loc}</loc>` + Object.entries(sitemapObj[loc]).map(e => `<${e[0]}>${e[1]}</${e[0]}>`).join(''))
                            urlsetElement.replaceChildren(...urlElements)
                            sitemapContent = [`<?xml version="1.0" encoding="UTF-8"?>`, urlsetElement.outerHTML]
                        }
                        assets['sitemap.xml'] ??= new File([new Blob([sitemapContent.join('\n')], { type: 'application/xml' })], 'sitemap.xml', { type: 'application/xml' })
                    }
                    for (const filepath in assets) {
                        if (!assets[filepath]) continue
                        let file = assets[filepath]
                        if (file === true) file = filepath
                        if (file instanceof Blob) {
                            file = new File([file], filepath.split('/').pop(), { type: file.type })
                        } else if (typeof file === 'string') {
                            const sourceFetch = await fetch(file)
                            if (sourceFetch.status !== 200) continue
                            file = await sourceFetch.blob()
                            file = new File([file], filepath.split('/').pop(), { type: file.type })
                        }
                        if (!(file instanceof File)) continue
                        yield { filepath, file: await renderFile(filepath, file) }
                    }
                }
            }
        }
    },

    grab: {
        enumerable: true, value: async function (what = 'application', ...args) {
            let useFunc
            switch (what) {
                case 'component': case 'facet':
                    args[1] ??= 'string'
                    const appWhats = this.app[`${what}s`].classes, endsWithTest = what === 'component' ? `${args[0]}.html`.replace('.html.html', '.html') : args[0]
                    if (!appWhats[args[0]]) {
                        for (const i in appWhats) {
                            if (i.endsWith(endsWithTest)) {
                                args[0] = i
                                break
                            }
                        }
                    }
                case 'package':
                    return await this.dev.export[what](...args)
                case 'application':
                    const application = {}
                    for await (const fileEntry of this.dev.export.application(...args)) {
                        let { filepath, file } = fileEntry
                        application[filepath] ??= file
                    }
                    return application
            }
        }
    },
    save: {
        enumerable: true, value: async function (what = 'application', dir = undefined, ...args) {
            switch (what) {
                case 'component': case 'facet': case 'package':
                    args.unshift(dir)
                    const suggestedName = `${(typeof args[0] === 'string' ? (args[0] ?? what) : what)}.js`.replace('.js.js', '.js'),
                        sourceCode = await E.dev.grab(what, ...args), fileHandle = await window.showSaveFilePicker({
                            types: [{
                                description: 'JavaScript Files',
                                accept: { 'application/javascript': ['.js'] }
                            }], suggestedName
                        }), writable = await fileHandle.createWritable()
                    await writable.write(new Blob([sourceCode], { type: 'application/javascript' }))
                    await writable.close()
                    return
                case 'application':
                    let useDir = dir
                    if (!dir || !(dir instanceof FileSystemDirectoryHandle)) {
                        if (dir !== undefined) args.unshift(dir)
                        useDir = await window.showDirectoryPicker({ mode: 'readwrite' })
                    }
                    console.log(`Creating application within the "${useDir.name}" directory...`)
                    for await (const { filepath, file } of this.dev.export.application(...args)) {
                        const pathParts = filepath.split('/'), fileName = pathParts.pop()
                        for (const part of pathParts) useDir = await useDir.getDirectoryHandle(part, { create: true })
                        const fileHandle = await useDir.getFileHandle(fileName, { create: true }), writableStream = await fileHandle.createWritable()
                        await writableStream.write(file)
                        await writableStream.close()
                        console.log('Created: ', filepath)
                    }
                    return console.log(`Finished creating application.`)
            }
        }
    },
    send: {
        enumerable: true, value: async function (what = 'application', adaptor = undefined, ...args) {
            if (typeof adaptor === 'string') try { adaptor = (await import(adaptor)).default } catch (e) {
                throw new Error(`Could not import adaptor "${adaptor}"`)
            }
            if (!(adaptor instanceof Function)) return await this.dev.save(what, adaptor, ...args)
            switch (what) {
                case 'component': case 'facet': case 'package':
                    const fileName = `${(typeof args[0] === 'string' ? (args[0] ?? what) : what)}.js`.replace('.js.js', '.js'), sourceCode = await E.dev.grab(what, ...args),
                        file = new File(new Blob([sourceCode], { type: 'application/javascript' }), fileName, { type: 'application/javascript' })
                    console.log(`Send of ${what} ${fileName} starting...`)
                    for await (const progress of adaptor(what, fileName, file)) console.log(`${fileName} ${progress}...`)
                    console.log(`Send of ${what} ${fileName} completed`)
                    return
                case 'application':
                    console.log(`Publishing application to "${adaptor.name}"...`)
                    for await (const { filepath, file } of this.dev.export.application(...args)) {
                        console.log(`${filepath} starting...`)
                        for await (const progress of adaptor(what, filepath, file)) console.log(`${filepath} ${progress}...`)
                        console.log(`${filepath} completed.`)
                    }
                    return console.log(`Application published to "${adaptor.name}".`)
            }
        }
    }
}
export { module }