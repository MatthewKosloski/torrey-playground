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
		JSON.stringify(body)
	);
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
	// running within the Lambda's container has rwx permissions
	// in this directory.
	const tmpDir = '../tmp';

	// The name of the selected compiler's jar file. The "selected compiler"
	// is the version of the compiler that will be used.
	const compilerFileName = `torreyc-${semanticVersion}.jar`;

	// The parent directory that contains the installations of the compilers. Within
	// this folder, there are subfolders, where each subfolder contains the install
	// of a specific compiler.  The name of a subfolder is the semantic version of
	// the compiler installed within.
	const compilersRootDir = '../tmp2/compilers';

	// The location of the selected compiler, relative to the parent directory 
	// that contains all compilers.
	const compilerDir = `${compilersRootDir}/${semanticVersion}`;

	// The path to the compiler's jar file, relative to the parent 
	// directory that contains all compilers.
	const compilerPath = `${compilerDir}/${compilerFileName}`;

	// The path to the compiler's runtime source, relative to the parent 
	// directory that contains all compilers.
	const runtimePath = `${compilerDir}/runtime.c`;

	// The path to the compiler's runtime header file, relative to the parent 
	// directory that contains all compilers.
	const runtimeHeaderPath = `${compilerDir}/runtime.h`;

	// The path to which the resulting assembly code will be written, relative
	// to the Lambda's emphemeral storage directory.
	const asmPath = `${tmpDir}/temp.s`;

	// The path to which the resulting executable file will be written, relative
	// to the Lambda's emphemeral storage directory.
	const execPath = `${tmpDir}/a.out`;

	// The path to which the runtime object code will be written, relative
	// to the Lambda's emphemeral storage directory.
	const objCodePath = `${tmpDir}/runtime.o`;

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
		return internalServerError(errors.format(template, args));
	}

	console.log('Response:', responseBody);
	return ok(responseBody);
};