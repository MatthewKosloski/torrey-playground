export default {
	type: 'object',
	properties: {
		supportedSemanticVersions: {
			type: 'array',
			items: {
				type: 'string',
				// rudimentary pattern matching for a semantic version
				pattern: '^\\d+.\\d+.\\d+$',
				uniqueItems: true
			},
			minItems: 1
		},
		supportedFlags: {
			type: 'array',
			items: {
				type: 'object',
				properties: {
					name: {
						type: 'string'
					},
					description: {
						type: 'string'
					}
				},
				required: [
					'name', 
					'description'
				]
			}
		},
		defaults: {
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
					},
					required: [
						'flags',
						'semanticVersion'
					]
				}
			},
			required: [
				'program',
				'options'
			]
		}
	},
	required: [
		'supportedSemanticVersions', 
		'supportedFlags', 
		'defaults'
	]
};