export default E => new E.ProtocolDispatcher([{
    gateway: function (useHost = {}, gatewayArgs = {}) {
        if (typeof useHost !== 'string') return fetch(`${window.location.protocol}//localhost:1984`, { method: 'HEAD' }).then(r => r.ok ? 'localhost:1984' : 'arweave.net')
        const [txid, ...chunks] = gatewayArgs.path.split('/')
        return (txid.length === 43 && txid.includes('.')) ? `${useHost}/${txid}/${chunks.join('/')}` : `${txid}.arweave.net/${chunks.join('/')}`
    }, auto: true
}])
