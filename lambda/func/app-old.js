const { validate, responses, readConfig, runCompiler } = require('./helpers');
const eventSchema = require('./schemas/event');
const messages = require('./messages');
const constants = require('./constants');

module.exports.handler = async (event) => {

	console.log('event', event);

	// Validate the event.
	const eventValidationErrors = validate(event, eventSchema);

	console.log('eventValidationErrors', eventValidationErrors);

	if (eventValidationErrors.length > 0) {
		// The event failed validation.
		return responses.badRequest(
			messages.handler.EVENT_INVALID,
			eventValidationErrors);
	}

	// Attempt to read the Lambda config file from disk.
	const config = await readConfig(constants.CONFIG_FILE_PATH);

	console.log(config, JSON.stringify(config));

	if (!config.couldRead) {
		// Failed to read the config file from disk.
		return responses.internalServerError(messages.handler.CONFIG_CANNOT_READ);
	}

	if (config.validationErrors.length > 0) {
		// The config file failed validation.
		return responses.internalServerError(messages.handler.CONFIG_INVALID,
			config.validationErrors);
	}

	const {
		body: {
			defaults, 
			supportedSemanticVersions,
			supportedFlags
		}
	} = config;

	console.log('defaults', defaults);
	console.log('supportedSemanticVersions', supportedSemanticVersions);
	console.log('supportedFlags', supportedFlags);

	// Merge config defaults with event data.
	const mergedInput = {
		program: event.program === undefined
			? defaults.program.trim()
			: event.program.trim(),
		options: {
			...defaults.options,
			...event.options
		}
	};

	console.log('mergedInput', mergedInput);

	const { program, options } = mergedInput;
	const { flags, semanticVersion } = options;
	const supportedFlagNames = supportedFlags.map(f => f.name);

	console.log('program', program);
	console.log('options', options);
	console.log('flags', flags);
	console.log('semanticVersion', semanticVersion);
	console.log('supportedFlagNames', supportedFlagNames);

	// Validate the length of the provided program.
	if (program.length > constants.MAX_PROGRAM_LENGTH) {
		return responses.badRequest(messages.format(
			messages.handler.MAXIMUM_PROGRAM_LENGTH_EXCEEDED,
			[program.length, constants.MAX_PROGRAM_LENGTH]));
	}

	console.log(messages.format(
		messages.cloudWatch.DID_NOT_EXCEED_MAXIMUM_PROGRAM_LENGTH,
		[program.length, constants.MAX_PROGRAM_LENGTH]));
	
	// Validate the provided semantic version.
	if (!supportedSemanticVersions.includes(semanticVersion)) {
		return responses.badRequest(messages.format(
				messages.handler.INVALID_SEMANTIC_VERSION,
				[semanticVersion, supportedSemanticVersions.join(', ').trim()]));
	}

	console.log(messages.format(messages.cloudWatch.VALID_SEMANTIC_VERSION,
		[semanticVersion]));

	// Validate the provided compiler flags.
	if (flags.map(f => supportedFlagNames.includes(f)).includes(false)) {
		return responses.badRequest(messages.format(
				messages.handler.INVALID_COMPILER_FLAG,
				[supportedFlagNames.join(', ').trim()]));
	}

	if (flags.length) {
		console.log(messages.format(messages.cloudWatch.VALID_COMPILER_FLAGS,
			[flags.join(', ').trim()]));
	}

	const { errMsg, exec } = await runCompiler(
		program,
		flags,
		semanticVersion,
		'./run.sh',
		'../tmp',
		'../tmp2/compilers'
	);

	if (errMsg) {
		// Encountered an error when attempting to run the compiler.
		return responses.internalServerError(errMsg);
	}

	// Successful run of compiler.
	return responses.ok(exec);
};