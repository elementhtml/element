export default E => new E.ProtocolDispatcher([{
    gateway: '{path|/|0}.ipfs.localhost:8080/{path|/|1:}', head: 'ipfs.localhost:8080', auto: true
}, {
    gateway: '{path|/|0}.ipfs.dweb.link/{path|/|1:}', head: 'ipfs.dweb.link', auto: true
}])
