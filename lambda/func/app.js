const util = require('util');
const fs = require('fs');
const exec = util.promisify(require('child_process').exec);
const readFile = util.promisify(fs.readFile);
const errors = require('./errors');
const constants = require('./constants');

const badRequest = (errMsg) => {
	return baseResponseObj(
		400,
		{ 'Content-Type': 'text/plain' },
		`Bad Request. ${errMsg.replace(/[\n\t]/i, '')}.`
	);
}

const internalServerError = (errMsg) => {
	return baseResponseObj(
		500,
		{ 'Content-Type': 'text/plain' },
		`Internal Server Error. ${errMsg.replace(/[\n\t]/i, '')}.`
	);
}

const ok = (body) => {
	return baseResponseObj(
		200,
		{ 
			'Content-Type': 'application/json',
			'Access-Control-Allow-Headers' : 'Content-Type',
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
		},
		JSON.stringify(body));
}

const baseResponseObj = (statusCode, headers, body) => ({
	statusCode, headers, body
});

module.exports.handler = async (event) => {

	// If the function is triggered by API Gateway,
	// then the event body is stored in event.body.
	// Else, the entire event is the body.
	let actualBody = event.body || event;

	// Parse the event body to an object
	// if it's a JSON string.
	if (typeof actualBody === 'string')
		actualBody = JSON.parse(actualBody);

	// Read the lambda config file.
	let defaultBody;
	let supportedSemanticVersions;
	let supportedFlags;

	try {
		const config = JSON.parse(await readFile(constants.CONFIG_FILE_PATH, 
			constants.CONFIG_ENCODING))[0];
		defaultBody = config.defaults;
		supportedSemanticVersions = config.supportedSemanticVersions;
		supportedFlags = config.supportedFlags;
	}
	catch {
		return internalServerError(errors.handler.CANNOT_READ_CONFIG);
	}

	// Merge defaultBody with actualBody
	const mergedBody = {
		program: actualBody.program === undefined
			? defaultBody.program.trim()
			: actualBody.program.trim(),
		options: {
			...defaultBody.options,
			...actualBody.options
		}
	};

	const { program, options } = mergedBody;
	const { flags, semanticVersion } = options;
	const supportedFlagNames = supportedFlags.map(f => f.name);

	// Validate the length of the provided program.
	if (program.length > constants.MAX_PROGRAM_LENGTH)
		return badRequest(errors.format(
			errors.handler.MAXIMUM_PROGRAM_LENGTH_EXCEEDED,
			[program.length, constants.MAX_PROGRAM_LENGTH]));

	// Validate the provided semantic version.
	if (!supportedSemanticVersions.includes(semanticVersion))
		return badRequest(errors.format(
			errors.handler.INVALID_SEMANTIC_VERSION,
			[semanticVersion, supportedSemanticVersions.join(', ')]));

	// Validate the provided compiler flags.
	if (flags.map(f => supportedFlagNames.includes(f)).includes(false))
		return badRequest(errors.format
			(errors.handler.INVALID_COMPILER_FLAG,
			[supportedFlagNames.join(', ')]));

	// The tmp directory is given to the lambda function to
	// be used as an ephemeral storage location. The user
	// running within the lambda's container has rwx permissions
	// in this directory.
	const tmpDir="../tmp"

	//The name of the compiler jar file.
	const compilerFileName=`torreyc-${semanticVersion}.jar`;

	const compilersRootDir="../tmp2/compilers";

	const compilerDir=`${compilersRootDir}/${semanticVersion}`;

	const compilerPath=`${compilerDir}/${compilerFileName}`;

	const runtimePath=`${compilerDir}/runtime.c`;

	const runtimeHeaderPath=`${compilerDir}/runtime.h`;

	const asmPath=`${tmpDir}/temp.s`;

	const execPath=`${tmpDir}/a.out`;

	const objCodePath=`${tmpDir}/runtime.o`;

	let cmd;
	try
	{
		// At this point, the input to the compiler should be
		// validated. Let's try to run the compiler with the input.
		cmd = 'bash ./run.sh';
		cmd += ` --version ${semanticVersion}`;
		cmd += ` --program "${program}"`;

		// We have to remove the hyphens that prefix
		// the Compiler flags or else the bash script
		// will try to interpret them as its arguments.
		if (flags.length)
			cmd += ` --flags "${flags.join(' ').replace(/\-/g, '')}"`;

		cmd += ` --temp-dir ${tmpDir}`;
		cmd += ` --compiler-name ${compilerFileName}`;
		cmd += ` --compilers-root-dir ${compilersRootDir}`;
		cmd += ` --compiler-dir ${compilerDir}`;
		cmd += ` --compiler-path ${compilerPath}`;
		cmd += ` --runtime-path ${runtimePath}`;
		cmd += ` --runtime-header-path ${runtimeHeaderPath}`;
		cmd += ` --asm-path ${asmPath}`;
		cmd += ` --exec-path ${execPath}`;
		cmd += ` --obj-code-path ${objCodePath}`;
		responseBody = await exec(cmd);
	} catch(err) {
		// Map the error code to an error template string. If there
		// is no corresponding template for a given error code, then
		// use a default error message.
		let template = errors.bash[`_${err.code}`] 
			|| errors.handler.UNKNOWN_ERROR;
		
		// Choose the arguments to use in the template string.
		let args;
		switch(err.code) {
			case 64:
			case 67:
				args = [semanticVersion, compilerPath];
				break;
			case 65:
				args = [semanticVersion, runtimePath];
				break;
			case 66:
				args = [semanticVersion, runtimeHeaderPath];
				break;
			case 68:
			case 69:
				args = [semanticVersion];
				break;
			default:
				if (err.stderr)
					args = err.stderr.split(' ')
				else
					args = []
		}
		return ok(err);
		return internalServerError(errors.format(template, args));
	}

	// The bash script ran the compiler without any errors,
	// so send the compiler's standard output and error to
	// the user.

	console.log('Response:', responseBody);
	return ok(responseBody);
};