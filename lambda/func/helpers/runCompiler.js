const util = require('util');
const exec = util.promisify(require('child_process').exec);
const messages = require('../messages');
const path = require('path');

/**
 * Produces an argument string that can be passed to the run script.
 * Maps run script arguments to their values.
 * 
 * @param {string} version 
 * @param {string} program 
 * @param {string} flags 
 * @param {string} tempDir 
 * @param {string} compilerName 
 * @param {string} compilersRootDir 
 * @param {string} compilerDir 
 * @param {string} compilerPath 
 * @param {string} runtimePath 
 * @param {string} runtimeHeaderPath 
 * @param {string} asmPath 
 * @param {string} execPath 
 * @param {string} objCodePath 
 * @returns An argument string that can be appended to the command
 * used to execute the run script.
 */
const _buildArgStr = (
	version, 
	program, 
	flags, 
	tempDir, 
	compilerName,
	compilersRootDir,
	compilerDir,
	compilerPath,
	runtimePath,
	runtimeHeaderPath,
	asmPath,
	execPath,
	objCodePath
	) => {
	const args = {
		'--version': version,
		'--program': program,
		'--flags': flags,
		'--temp-dir': tempDir,
		'--compiler-name': compilerName,
		'--compilers-root-dir': compilersRootDir,
		'--compiler-dir': compilerDir,
		'--compiler-path': compilerPath,
		'--runtime-path': runtimePath,
		'--runtime-header-path': runtimeHeaderPath,
		'--asm-path': asmPath,
		'--exec-path': execPath,
		'--obj-code-path': objCodePath
	};

	let argStr = '';
	for (const arg in args) {
		if (args[arg] !== null) {
			if (arg === '--program' || arg === '--flags') {
				argStr += `${arg} "${args[arg]}" `;
			} else {
				argStr += `${arg} ${args[arg]} `;
			}
		}
	}

	return argStr.trim();
};

/**
 * Attempts to compile the given Torrey program using 
 * the given compiler flags. The resulting object's 
 * errMsg property will not be null if any errors occur.
 * 
 * @param {string} program The Torrey program to compile. 
 * @param {array} flags An array of compiler flags to provided
 * to the Torrey compiler.
 * @param {string} semanticVersion The version of the compiler to run,
 * expressed as a semantic version. 
 * @param {string} runScriptPath The path to the run script on disk.
 * @param {string} tmpDir The path to the emphemeral storage location
 * given to the Lambda function. The current user must have read
 * and write permissions in this location.
 * @param {string} compilersRootDir The top-level directory at which all
 * compilers are installed. Within this folder, there are subfolders, 
 * where each subfolder contains the install of a specific compiler.  
 * The name of a subfolder is the semantic version of the compiler 
 * installed within.
 * @returns An object with two keys: exec and errMsg. If any errors
 * are encountered when attempting to run the compiler, then errMsg
 * will be truthy. Upon successful compilation and/or execution of
 * the Torrey program, exec will contain the standard output and/or
 * standard error.
 */
module.exports = async (program, flags, semanticVersion, 
	runScriptPath, tmpDir, compilersRootDir) => {
	// The name of the selected compiler's jar file. The "selected compiler"
	// is the version of the compiler that will be used.
	const compilerFileName = `torreyc-${semanticVersion}.jar`;

	// The location of the selected compiler, relative to the parent directory 
	// that contains all compilers.
	const compilerDir = path.join(compilersRootDir, semanticVersion)

	// The path to the compiler's jar file, relative to the parent 
	// directory that contains all compilers.
	const compilerPath = path.join(compilerDir, compilerFileName);

	// The path to the compiler's runtime source, relative to the parent 
	// directory that contains all compilers.
	const runtimePath = path.join(compilerDir, 'runtime.c');

	// The path to the compiler's runtime header file, relative to the parent 
	// directory that contains all compilers.
	const runtimeHeaderPath = path.join(compilerDir, 'runtime.h');

	// The path to which the resulting assembly code will be written, relative
	// to the Lambda's emphemeral storage directory.
	const asmPath = path.join(tmpDir, 'temp.s');

	// The path to which the resulting executable file will be written, relative
	// to the Lambda's emphemeral storage directory.
	const execPath = path.join(tmpDir, 'a.out');

	// The path to which the runtime object code will be written, relative
	// to the Lambda's emphemeral storage directory.
	const objCodePath = path.join(tmpDir, 'runtime.o');

	const result = {
		errMsg: null,
		exec: null
	};

	try
	{
		const argStr = _buildArgStr(
			semanticVersion,
			program,
			// If there are flags, then pass them
			// in as a string.
			flags.length
				? flags.join(' ')
				: null,
			tmpDir,
			compilerFileName,
			compilersRootDir,
			compilerDir,
			compilerPath,
			runtimePath,
			runtimeHeaderPath,
			asmPath,
			execPath,
			objCodePath
		);

		result.exec = await exec(`bash ${runScriptPath} ${argStr}`);
	} catch(err) {
		// Map the error code to an error template string. If there
		// is no corresponding template for a given error code, then
		// use a default error message.
		let template = messages.bash[`_${err.code}`] 
			|| messages.handler.UNKNOWN_ERROR;
		
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

		result.errMsg = messages.format(template, args);
	}

	return result;
};