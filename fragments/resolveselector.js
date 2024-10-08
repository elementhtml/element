const isRgb = /rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/, isRgba = /rgba\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*,\s*([\d.]+)\s*\)/,
    colorUtils = {
        calculateLuminance: function (color) {
            const [r, g, b] = colorUtils.toArray(color)
            return 0.2126 * r + 0.7152 * g + 0.0722 * b
        },
        canonicalize: function (color, includeAlpha) {
            if ((includeAlpha && color.startsWith('rgba(')) || (!includeAlpha && color.startsWith('rgb('))) return color
            const oldHeadColor = document.head.style.getPropertyValue('color')
            document.head.style.setProperty('color', color)
            let computedColor = window.getComputedStyle(document.head).getPropertyValue('color')
            document.head.style.setProperty('color', oldHeadColor)
            const colorArray = colorUtils.toArray(computedColor, includeAlpha)
            return includeAlpha ? `rgba(${colorArray[1]}, ${colorArray[2]}, ${colorArray[3]}, ${colorArray[4]})` : `rgb(${colorArray[1]}, ${colorArray[2]}, ${colorArray[3]})`
        },
        rgbToHsl: function (r, g, b) {
            r /= 255, g /= 255, b /= 255;
            const max = Math.max(r, g, b), min = Math.min(r, g, b), d = max - min
            let h, s, l = (max + min) / 2
            if (max === min) return [0, 0, l * 100]
            s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
            switch (max) {
                case r: h = (g - b) / d + (g < b ? 6 : 0); break
                case g: h = (b - r) / d + 2; break
                case b: h = (r - g) / d + 4; break
            }
            h /= 6
            return [h * 360, s * 100, l * 100]
        },
        toArray: function (color, includeAlpha) {
            if (Array.isArray(color)) return color
            if (!color.startsWith('rgb')) color = colorUtils.canonicalize(color)
            const useRx = color.startsWith('rgba') ? isRgba : isRbg,
                [, r, g, b, a = 1] = color.match(useRx) ?? [, 0, 0, 0, (includeAlpha ? 0 : 1)]
            return includeAlpha ? [r, g, b, a] : [r, g, b]
        }
    }, selectorUtils = Object.freeze({
        clauseOpeners: {
            '[': true, '#': true, '.': true,
            '@': function (n, c) { return n.getAttribute('name') === c },
            '^': function (n, c) { return n.getAttribute('itemprop') === c },
            '$': function (n, c) { return n.value === c }
        },
        combinators: {
            '>': function (sc) { return Array.from(sc.chilren()) },
            '+': function (sc) { return sc.nextElementSibling() ?? [] },
            '~': function (sc) {
                const siblings = []
                let sibling = sc.nextElementSibling
                while (sibling) {
                    siblings.push(sibling)
                    sibling = sibling.nextElementSibling
                }
                return siblings
            },
            '||': function (sc) {
                const colgroup = sc.closest('colgroup'), colElements = Array.from(colgroup.children), table = sc.closest('table'), matchedCells = []
                let totalColumns = 0, colStart = 0, colEnd = 0;
                for (const col of colElements) {
                    const span = parseInt(col.getAttribute('span') || '1', 10), colIsSc = col === sc
                    if (colIsSc) colStart = totalColumns
                    totalColumns += span
                    if (colIsSc) colEnd = totalColumns - 1
                }
                for (const row of table.querySelectorAll('tr')) {
                    let currentColumn = 0
                    for (const cell of row.children) {
                        const colspan = parseInt(cell.getAttribute('colspan') || '1', 10), cellStart = currentColumn, cellEnd = currentColumn + colspan - 1
                        if ((cellStart >= colStart && cellStart <= colEnd) || (cellEnd >= colStart && cellEnd <= colEnd)) matchedCells.push(cell);
                        currentColumn += colspan
                    }
                }
                return matchedCells
            },
            '': function (sc) { return Array.from(sc.querySelectorAll('*')) }
        },
        comparators: {
            '~=': function (iv, rv, f, p) { return iv === rv || iv.split(this.sys.regexp.spaceSplitter).includes(rv) },
            '|=': function (iv, rv, f, p) { return iv === rv || iv.startsWith(`${rv}-`) },
            '^=': function (iv, rv, f, p) { return iv.startsWith(rv) },
            '$=': function (iv, rv, f, p) { return iv.endsWith(rv) },
            '*=': function (iv, rv, f, p) { return iv.includes(rv) },
            '/=': function (iv, rv, f, p) { return (new RegExp(rv)).test(iv) },
            '==': function (iv, rv, f, p) { return ((f === '&') && (p?.endsWith('olor'))) ? (colorUtils.canonicalize(iv, true) === colorUtils.canonicalize(rv, true)) : (iv == rv) },
            '<=': function (iv, rv, f, p) { return (((f === '&') && (p?.endsWith('olor')))) ? colorUtils.rgbToHsl(...colorUtils.toArray(iv))[0] <= colorUtils.rgbToHsl(...colorUtils.toArray(rv))[0] : parseFloat(iv) <= parseFloat(rv) },
            '>=': function (iv, rv, f, p) { return (((f === '&') && (p?.endsWith('olor')))) ? colorUtils.rgbToHsl(...colorUtils.toArray(iv))[0] >= colorUtils.rgbToHsl(...colorUtils.toArray(rv))[0] : parseFloat(iv) >= parseFloat(rv) },
            '=': function (iv, rv, f, p) { return ((f === '&') && (p?.endsWith('olor'))) ? (colorUtils.canonicalize(iv) === colorUtils.canonicalize(rv)) : (iv == rv) },
            '<': function (iv, rv, f, p) { return (f === '&' && p?.endsWith('olor')) ? colorUtils.calculateLuminance(iv) < colorUtils.calculateLuminance(rv) : parseFloat(iv) < parseFloat(rv) },
            '>': function (iv, rv, f, p) { return (f === '&' && p?.endsWith('olor')) ? colorUtils.calculateLuminance(iv) > colorUtils.calculateLuminance(rv) : parseFloat(iv) > parseFloat(rv) },
            '': function (iv, rv, f, p) { return (f === '&' && p?.endsWith('olor')) ? (colorUtils.toArray(iv, true)[3] > 0) : !!iv }
        },
        flags: {
            '%': function (n, cp) { return `${n.style.getPropertyValue(cp)}` },
            '&': function (n, cp) { return `${window.getComputedStyle(n)[cp]}` },
            '?': function (n, cp) { return n.dataset[cp] },
            '$': function (n, cp) { return `${n[cp]}` },
            '@': function (n, cp) { return n.getAttribute(cp) },
            '': function (n, cp) { return n.getAttribute(cp) },
        }
    })


export default async function (selector, scope, isMulti, sliceSignature) {
    const matches = [], branches = selector.split(this.sys.regexp.selectorBranchSplitter)
    for (const branch of branches) {
        const branchMatches = []
        try {
            branchMatches.push(...(isMulti ? Array.from(scope.querySelectorAll(branch)) : [scope.querySelector(branch)].filter(n => !!n)))
        } catch (ee) {
            const segments = branch.split(this.sys.regexp.selectorSegmentSplitter)
            let segmentTracks = [scope]
            for (const segment of segments) {
                const newTracks = []
                for (const track of segmentTracks) {
                    try {
                        newTracks.push(...Array.from(track.querySelectorAll(`:scope ${segment}`)))
                    } catch (eee) {
                        const hasNonDefaultCombinator = ((segment[0] === '|') || (segment[0] in selectorUtils.combinators))
                        let nonDefaultCombinator = hasNonDefaultCombinator ? (segment[0] === '|' ? '||' : segment[0]) : '', combinatorProcessor = selectorUtils.combinators[nonDefaultCombinator],
                            qualified = combinatorProcessor(track), remainingSegment = segment.slice(nonDefaultCombinator.length).trim()
                        while (remainingSegment) {
                            let indexOfNextClause = -1, writeIndex = 0
                            if (remainingSegment[0] === '[') indexOfNextClause = remainingSegment.indexOf(']', 1) + 1
                            else for (const c in selectorUtils.clauseOpeners) if ((indexOfNextClause = remainingSegment.indexOf(c, 1)) !== -1) break
                            const noIndexOfNextClause = indexOfNextClause === -1, thisClause = remainingSegment.slice(0, noIndexOfNextClause ? undefined : indexOfNextClause).trim()
                            try {
                                for (let i = 0; i < qualified.length; i++) if (qualified[i].matches(thisClause)) qualified[writeIndex++] = qualified[i]
                            } catch (eeee) {
                                const clauseOpener = thisClause[0]
                                switch (clauseOpener) {
                                    case '@': case '!': case '^': case '$':
                                        const clauseMain = thisClause.slice(1)
                                        for (let i = 0; i < qualified.length; i++) if (selectorUtils.clauseOpeners[clauseOpener](qualified[i], clauseMain)) qualified[writeIndex++] = qualified[i]
                                        break
                                    case '[':
                                        let indexOfComparator, clauseComparator, clauseInputValueType
                                        for (clauseComparator in selectorUtils.comparators) if ((indexOfComparator = thisClause.indexOf(clauseComparator, 1)) !== -1) break
                                        const comparatorProcessor = selectorUtils.comparators[clauseComparator],
                                            clauseKey = clauseComparator ? thisClause.slice(1, indexOfComparator).trim() : thisClause.slice(1, -1)
                                        let clauseReferenceValue = clauseComparator ? thisClause.slice(indexOfComparator + clauseComparator.length, -1).trim() : undefined
                                        if (clauseReferenceValue && (clauseReferenceValue.length > 1) && (clauseReferenceValue[0] == '"' || clauseReferenceValue[0] == "'") && (clauseReferenceValue.endsWith('"') || clauseReferenceValue.endsWith("'"))) clauseReferenceValue = clauseReferenceValue.slice(1, -1)
                                        switch (clauseKey) {
                                            case '...': clauseInputValueType = 'textContent'
                                            case '..': clauseInputValueType ??= 'innerText'
                                            case '<>': clauseInputValueType ??= 'innerHTML'
                                                for (let i = 0; i < qualified.length; i++) if (comparatorProcessor(qualified[i][clauseInputValueType], clauseReferenceValue)) qualified[writeIndex++] = qualified[i]
                                                break
                                            case '.':
                                                for (let i = 0, n = qualified[i], tc = n.textContent; i < qualified.length; i++) if (comparatorProcessor(this.sys.isHTML.test(tc = (n = qualified[i]).textContent) ? n.innerHTML : tc, clauseReferenceValue)) qualified[writeIndex++] = n
                                                break
                                            default:
                                                const clauseFlag = clauseKey[0] in selectorUtils.flags ? clauseKey[0] : '', clauseProperty = clauseKey.slice(clauseFlag.length)
                                                for (let i = 0, n = qualified[i]; i < qualified.length; i++) if (comparatorProcessor(selectorUtils.flags[clauseFlag](n = qualified[i], clauseProperty), clauseReferenceValue, clauseFlag, clauseProperty)) qualified[writeIndex++] = n
                                        }
                                }
                            }
                            qualified.length = writeIndex
                            if (!qualified.length) break
                            remainingSegment = remainingSegment.slice(thisClause.length)
                        }
                        newTracks.push(...qualified)
                    }
                }
                segmentTracks = newTracks
            }
            branchMatches.push(...segmentTracks)
        }
        if (!branchMatches.length) continue
        if (!isMulti) return branchMatches[0]
        matches.push(...branchMatches)
    }
    return isMulti ? this.sliceAndStep(sliceSignature, matches) : matches[0]
}