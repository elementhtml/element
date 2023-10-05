function currency(amount) {
	console.log('line 2', amount)
	const numberFormat = new Intl.NumberFormat('en-US', { style: 'decimal', minimumFractionDigits: 2 })
	return numberFormat.format(parseFloat(amount) || 0)
}

export { currency }