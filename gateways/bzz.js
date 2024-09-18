export default E => new E.ProtocolDispatcher([{
    gateway: 'localhost:1633/bzz/{host}/{path}', head: 'localhost:1633/bzz/swarm.eth', auto: true
}, {
    gateway: 'gateway.ethswarm.org/bzz/{host}/{path}', head: 'gateway.ethswarm.org/bzz/swarm.eth', auto: true
}])
