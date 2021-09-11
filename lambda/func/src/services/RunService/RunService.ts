import { Service } from 'typedi';
import * as path from 'path';
import * as util from 'util';
import { exec } from 'child_process';
import { 
	FailedOperation, 
	OperationResult, 
	SuccessfulOperation
} from '../../OperationResult';
import { MessagingService } from '../MessagingService';

const _exec = util.promisify(exec);

export interface ExecutionResult {
	stdout: string,
	stderr: string
}

export type FailureMessage = string;

export type RunResult = OperationResult<ExecutionResult | FailureMessage>;

@Service()
export class RunService {

	constructor(private _messagingService: MessagingService) {}

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
	public async run(program: string, flags: string[], semanticVersion: string, 
		runScriptPath: string, tmpDir: string, compilersRootDir: string): Promise<RunResult> {
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

	let result: RunResult;

	try
	{
		const argStr = this._buildArgStr(
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

		result = new SuccessfulOperation(
			await _exec(`bash ${runScriptPath} ${argStr}`));
	} catch(err) {

		console.log(err);

		// Map the error code to an error template string. If there
		// is no corresponding template for a given error code, then
		// use a default error message.
		let template = this._messagingService.messages.bash[`_${err.code}`] 
			|| this._messagingService.messages.handler.UNKNOWN_ERROR;
		
		// Map the script exit code to an array of arguments
		// for the chosen template string.
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

		result = new FailedOperation(
			this._messagingService.format(template, args));
	}

	return result;
}

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
	private _buildArgStr(
		version: string, 
		program: string, 
		flags: string, 
		tempDir: string, 
		compilerName: string,
		compilersRootDir: string,
		compilerDir: string,
		compilerPath: string,
		runtimePath: string,
		runtimeHeaderPath: string,
		asmPath: string,
		execPath: string,
		objCodePath: string
	) {
		const args: {
			[key: string]: string
		} = {
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
			const value: string = args[arg];
			if (value !== null) {
				if (arg === '--program' || arg === '--flags') {
					argStr += `${arg} "${value}" `;
				} else {
					argStr += `${arg} ${value} `;
				}
			}
		}

		return argStr.trim();
	}
}