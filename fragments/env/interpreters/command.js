export default function (envelope, value) {
    const { descriptor, variables } = envelope, { invocation } = descriptor,
        wrapped = variables && true, valueEnvelope = variables && Object.freeze({ ...envelope, value })
    $([variables?.invocation ? this.resolveVariable(invocation, valueEnvelope, { wrapped }) : invocation])
    return value
}