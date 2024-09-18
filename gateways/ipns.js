export default E => new E.ProtocolDispatcher([{
    gateway: '{path|/|0}.ipns.localhost:8080/{path|/|1:}', head: 'ipns.localhost:8080', auto: true
}, {
    gateway: '{path|/|0}.ipns.dweb.link/{path|/|1:}', head: 'ipns.dweb.link', auto: true
}])
