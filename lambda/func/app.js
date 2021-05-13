const util = require('util');
const exec = util.promisify(require('child_process').exec);

const respondWithBadRequest = (errMsg) => ({
	statusCode: 400,
	headers: { 'Content-Type': 'text/plain' },
	body: `Bad Request. ${errMsg.replace(/[\n\t]/i,'')}.`
});

const respondWithOk = (res) => ({
	statusCode: 200,
	headers: { 'Content-Type': 'application/json' },
	body: JSON.stringify(res)
});

module.exports.handler = async (event) => {

	let actualBody = event.body || event;

	if (typeof actualBody === 'string')
		actualBody = JSON.parse(actualBody);

		const defaultBody = {
			program: "",
			options: {
				flags: [],
				semanticVersion: '3.0.0'
			}
		};
	
	// Merge defaultBody with actualBody
	const mergedBody = {
		program: actualBody.program || defaultBody.program,
		options: {
			...defaultBody.options,
			...actualBody.options
		}
	};

	const { program, options } = mergedBody;
	const { flags, semanticVersion } = options;

	// Validate the provided semantic version.
	const supportedSemanticVersions = ['1.0.1', '2.0.1', '3.0.0'];
	if (supportedSemanticVersions.filter((v) => v == semanticVersion).length == 0)
		return respondWithBadRequest(`The provided semanticVersion 
			"${semanticVersion}" is invalid. Please visit 
			https://github.com/MatthewKosloski/torrey/tags to view a list of 
			valid semantic versions. Please note that not all compiler versions
			listed there are installed on this server.`);

	// The tmp directory given to the lambda function to
	// be used as an empheral storage location. The user
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
		stderr,
		program
	};

	console.log(`Response: ${responseBody}`);
	return respondWithOk(responseBody);
};