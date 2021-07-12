const util = require('util');
const fs = require('fs');
const exec = util.promisify(require('child_process').exec);
const readFile = util.promisify(fs.readFile);

const badReqResponse = (errMsg) => {
	return baseResponseObj(
		400,
		{ 'Content-Type': 'text/plain' },
		`Bad Request. ${errMsg.replace(/[\n\t]/i, '')}.`
	);
}

const serverErrorResponse = (errMsg) => {
	return baseResponseObj(
		500,
		{ 'Content-Type': 'text/plain' },
		`Internal Server Error. ${errMsg.replace(/[\n\t]/i, '')}.`
	);
}

const okResponse = (body) => {
	return baseResponseObj(
		200,
		{ 
			'Content-Type': 'application/json',
			'Access-Control-Allow-Headers' : 'Content-Type',
			'Access-Control-Allow-Origin': 'https://amazing-kalam-4dd784.netlify.app',
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
		const config = JSON.parse(await readFile('./config.json', 'utf8'))[0];
		defaultBody = config.defaults;
		supportedSemanticVersions = config.supportedSemanticVersions;
		supportedFlags = config.supportedFlags;
	}
	catch {
		return serverErrorResponse('An error occurred while reading the lambda configuration file');
	}

	// Merge defaultBody with actualBody
	const mergedBody = {
		program: actualBody.program === undefined
			? defaultBody.program
			: actualBody.program,
		options: {
			...defaultBody.options,
			...actualBody.options
		}
	};

	const { program, options } = mergedBody;
	const { flags, semanticVersion } = options;

	// Validate the provided semantic version.
	if (supportedSemanticVersions.filter((v) => v == semanticVersion).length == 0)
		return badReqResponse(`The provided semanticVersion "${semanticVersion}" is invalid. Supported semantic versions are: ${supportedSemanticVersions.join(", ")}`);

	// Validate the provided compiler flags.
	if (flags.map(flag => supportedFlags.includes(flag)).includes(false))
		return badReqResponse(`One or more provided flags are invalid. Supported flags are: ${supportedFlags.join(", ")}`);

	// The tmp directory given to the lambda function to
	// be used as an ephemeral storage location. The user
	// running within the lambda's container has rwx permissions
	// in this directory.
	const tmpDir = `../tmp`;

	// The location to which the Torrey compilers have been downloaded.
	const compilersRootDir = `../tmp2/compilers`;

	// The directory to the selected compiler.
	const compilerDir = `${compilersRootDir}/${semanticVersion}`;

	// The path to the selected compiler's jar file.
	const torreycPath = `${compilerDir}/torreyc-${semanticVersion}.jar`;

	// The path to the selected compiler's runtime.
	const runtimePath = `${compilerDir}/runtime.c`;

	// The path to which the temporary assembly program will be written.
	const asmPath = `${tmpDir}/temp.s`;

	// The path at which the executable will live.
	const execPath = `${tmpDir}/a.out`;

	// The path to which the runtime's object code will be written.
	const objCodePath = `${tmpDir}/runtime.o`;

	let cmd = ``;

	// Run the compiler with the input program.
	cmd = `${cmd} echo "${program}" | java -jar ${torreycPath}`;

	// If compiler flags are provided, then run
	// the compiler with them.
	if (flags.length != 0)
		cmd = `${cmd} ${flags.join(' ')}`;

	if (!(flags.includes('-L') || flags.includes('-p') || flags.includes('-ir')
		|| flags.includes('-S'))) {
		// No "breakpoint" flag has been provided, so build
		// an executable and run it.

		// Write the assembly file to /tmp.
		cmd = `${cmd} -S > ${asmPath}`;

		// Build the runtime object code and save it to /tmp.
		cmd = `${cmd} && gcc -c ${runtimePath}`;
		cmd = `${cmd} -o ${objCodePath}`;

		// Assemble and link the runtime with the assembly
		// to build an executable.
		cmd = `${cmd} && gcc ${asmPath} ${objCodePath} -o ${execPath}`;

		// Run the program.
		cmd = `${cmd} && ${execPath}`;

		// Delete the temp assembly file and
		// the produced executable file.
		cmd = `${cmd} && rm ${asmPath} && rm ${execPath}`;
	}

	// Execute the above constructed bash command and return
	// the contents of the standard output and error streams.
	const { stdout, stderr } = await exec(cmd);

	const responseBody = {
		stdout,
		stderr
	};

	console.log(`Response: ${responseBody}`);
	return okResponse(responseBody);
};