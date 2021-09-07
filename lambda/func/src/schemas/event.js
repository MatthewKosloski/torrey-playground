export default {
	type: 'object',
	properties: {
		program: {
			type: 'string'
		},
		options: {
			type: 'object',
			properties: {
				flags: {
					type: 'array',
					items: {
						type: 'string',
						uniqueItems: true
					}
				},
				semanticVersion: {
					type: 'string',
					// rudimentary pattern matching for a semantic version
					pattern: '^\\d+.\\d+.\\d+$',
				}
			}
		}
	},
	required: [
		'program'
	]
};