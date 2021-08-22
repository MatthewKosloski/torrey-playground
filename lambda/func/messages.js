// Maps bash exit codes to error messages. The keys are 
// error codes (prefixed with underscores) that are 
// returned by the run script.
module.exports.bash = {
	_64: 
		'Compiler v%0 couldn\'t be found at %1',
	_65: 
		'The runtime for compiler v%0 couldn\'t be found at %1',
	_66: 
		'The runtime header for compiler v%0 couldn\'t be found at %1',
	_67: 
		'No permission to execute compiler v%0 at %1',
	_68: 
		'Cannot run compiler v%0 because the GNU Compiler Collection (gcc) is not installed',
	_69: 
		'Cannot run compiler v%0 because the Java Virtual Machine (java) is not installed',
	_70: 
		'%0: Argument for %1 is missing',
	_71: 
		'%0: Unsupported flag %1',
	_72: 
		'%0: Unknown flag %1',
	_73: 
		'%0: The following required flags are missing arguments: %1'
};

// Error messages that are used directly by
// the Lambda handler code.
module.exports.handler = {
	INVALID_SEMANTIC_VERSION: 
		'The provided semanticVersion "%0" is invalid. Supported semantic versions are: %1',
	INVALID_COMPILER_FLAG: 
		'One or more provided flags are invalid. Supported flags are: %0',
	MAXIMUM_PROGRAM_LENGTH_EXCEEDED: 
		'The provided program has a length of %0 characters, which exceeds the maximum of %1 characters',
	UNKNOWN_ERROR: 
		'Encountered an unknown error',
	CONFIG_CANNOT_READ: 
		'An error occurred while reading the Lambda configuration file',
	CONFIG_INVALID: 
		'The Lambda configuration file failed validation with errors',
	EVENT_INVALID:
		'The request body failed validation with errors'
};

// Information messages that will be logged to CloudWatch.
module.exports.cloudWatch = {
	DID_NOT_EXCEED_MAXIMUM_PROGRAM_LENGTH: 
		'The provided program has a length of %0 characters, which does not exceed the maximum of %1 characters',
	VALID_SEMANTIC_VERSION:
		'The provided semantic version %0 is valid',
	VALID_COMPILER_FLAGS:
		'The provided compiler flags %0 are valid'
}

/**
 * Returns a formatted message using the specified template and arguments.
 * @param {string} template A message template.
 * @param {array} args Arguments referenced by format specifiers of the form %n,
 * where n is the index of the argument.
 * @returns A formatted message.
 */
module.exports.format = (template, args) => 
	template.replace(/%(\d+)/g, (_, i) => args[i]);