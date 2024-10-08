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
                        const hasNonDefaultCombinator = ((segment[0] === '|') || (segment[0] in this.sys.selector.combinators))
                        let nonDefaultCombinator = hasNonDefaultCombinator ? (segment[0] === '|' ? '||' : segment[0]) : '', combinatorProcessor = this.sys.selector.combinators[nonDefaultCombinator],
                            qualified = combinatorProcessor(track), remainingSegment = segment.slice(nonDefaultCombinator.length).trim()
                        while (remainingSegment) {
                            let indexOfNextClause = -1, writeIndex = 0
                            if (remainingSegment[0] === '[') indexOfNextClause = remainingSegment.indexOf(']', 1) + 1
                            else for (const c in this.sys.selector.clauseOpeners) if ((indexOfNextClause = remainingSegment.indexOf(c, 1)) !== -1) break
                            const noIndexOfNextClause = indexOfNextClause === -1, thisClause = remainingSegment.slice(0, noIndexOfNextClause ? undefined : indexOfNextClause).trim()
                            try {
                                for (let i = 0; i < qualified.length; i++) if (qualified[i].matches(thisClause)) qualified[writeIndex++] = qualified[i]
                            } catch (eeee) {
                                const clauseOpener = thisClause[0]
                                switch (clauseOpener) {
                                    case '@': case '!': case '^': case '$':
                                        const clauseMain = thisClause.slice(1)
                                        for (let i = 0; i < qualified.length; i++) if (this.sys.selector.clauseOpeners[clauseOpener](qualified[i], clauseMain)) qualified[writeIndex++] = qualified[i]
                                        break
                                    case '[':
                                        let indexOfComparator, clauseComparator, clauseInputValueType
                                        for (clauseComparator in this.sys.selector.comparators) if ((indexOfComparator = thisClause.indexOf(clauseComparator, 1)) !== -1) break
                                        const comparatorProcessor = this.sys.selector.comparators[clauseComparator],
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
                                                const clauseFlag = clauseKey[0] in this.sys.selector.flags ? clauseKey[0] : '', clauseProperty = clauseKey.slice(clauseFlag.length)
                                                for (let i = 0, n = qualified[i]; i < qualified.length; i++) if (comparatorProcessor(this.sys.selector.flags[clauseFlag](n = qualified[i], clauseProperty), clauseReferenceValue, clauseFlag, clauseProperty)) qualified[writeIndex++] = n
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