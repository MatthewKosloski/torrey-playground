const util = require('util');
const fs = require('fs');
const schema = require('../schemas/config');
const validate = require('./validate');
const readFile = util.promisify(fs.readFile);

/**
 * Attempts to read the Lambda configuration file from disk 
 * at the provided path. If the configuration file could be 
 * read, then it's contents are validated against a JSON 
 * schema. If validation fails, then one or more error 
 * messages will be added to the resulting object.
 * 
 * @param {string} path The path to the configuration file on disk.
 * @returns An object that contains the contents of the configuration 
 * file, validation errors, and a flag that indicates whether the
 * config file was successfully read.
 */
module.exports = async (path) => {

	const result = {
		body: {},
		validationErrors: [],
		couldRead: false
	};

	try {
		const config = JSON.parse(await readFile(path, 'utf8'))[0];

		// If we made it here, then we were able to read the file.
		result.couldRead = true;

		// Validate the configuration file against a JSON schema.
		result.validationErrors = validate(config, schema);

		if (result.validationErrors.length === 0) {
			result.body.defaults = config.defaults;
			result.body.supportedSemanticVersions =
				config.supportedSemanticVersions;
			result.body.supportedFlags = config.supportedFlags;
		} else {
			result.body = {};
		}
	}
	catch {
		result.couldRead = false;
		result.body = {};
	}

	return result;
};