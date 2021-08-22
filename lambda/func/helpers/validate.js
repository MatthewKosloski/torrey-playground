const validate = require('jsonschema').validate;

/**
 * Validates the provided object against the provided
 * JSON schema.
 * 
 * @param {object} obj An object to be validated. 
 * @param {object} schema A JSON schema.
 * @returns If there are validation errors, then returns
 * an array of strings. Else, and empty array.
 */
module.exports = (obj, schema) => {
	let { errors } = validate(obj, schema);

	// Convert errors from an array of objects to
	// an array of strings.
	errors = errors.map(({path, message}) => {
		path = path.reduce((a, b) => {
			if (typeof b === 'number') {
				return `${a}[${b}]`;
			} else if (a === '') {
				return b;
			} else {
				return `${a}.${b}`;
			}
		}, '');
		return `${path} ${message}`;
	});

	return errors;
};