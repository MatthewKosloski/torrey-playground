import { Service } from 'typedi';
import * as path from 'path';
import * as util from 'util';
import { exec, ExecException } from 'child_process';
import { 
	FailedOperation, 
	OperationResult, 
	SuccessfulOperation
} from '../../OperationResult';
import { MessagingService } from '../MessagingService';

export interface ExecutionResult {
	stdout: string,
	stderr: string
}

export type FailureMessage = string;

export type RunResult = OperationResult<ExecutionResult | FailureMessage>;

interface ExecError extends ExecException {
	stdout: string,
	stderr: string
}

enum Shell {
	BASH = 'bash'
}

interface ShellArgument {
	name: string,
	value: string,
	isValueQuotted: boolean
}

@Service()
export class RunService {

	private static ASM_FILE_NAME = 'temp.s';
	private static EXEC_FILE_NAME = 'a.out';
	private static RT_OBJ_CODE_FILE_NAME = 'runtime.o';
	private static RT_HEADER_FILE_NAME = 'runtime.h';
	private static RT_SOURCE_FILE_NAME = 'runtime.c';

	constructor(private _messagingService: MessagingService) {}

	public run(program: string, flags: string[], semanticVersion: string): Promise<RunResult> {
		return this._run(program, flags, semanticVersion, 
			'../run.sh', '../../tmp', '../../tmp2/compilers');
	}

	/*
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
	private async _run(program: string, flags: string[], semanticVersion: string, 
		runScriptPath: string, tmpDir: string, compilersRootDir: string
	): Promise<RunResult> {
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
		const runtimePath = path.join(compilerDir, RunService.RT_SOURCE_FILE_NAME);

		// The path to the compiler's runtime header file, relative to the parent 
		// directory that contains all compilers.
		const runtimeHeaderPath = path.join(compilerDir, RunService.RT_HEADER_FILE_NAME);

		// The path to which the resulting assembly code will be written, relative
		// to the Lambda's emphemeral storage directory.
		const asmPath = path.join(tmpDir, RunService.ASM_FILE_NAME);

		// The path to which the resulting executable file will be written, relative
		// to the Lambda's emphemeral storage directory.
		const execPath = path.join(tmpDir, RunService.EXEC_FILE_NAME);

		// The path to which the runtime object code will be written, relative
		// to the Lambda's emphemeral storage directory.
		const objCodePath = path.join(tmpDir, RunService.RT_OBJ_CODE_FILE_NAME);

		const args = [
			{name: '--program', value: program, isValueQuotted: true},
			{name: '--temp-dir', value: tmpDir, isValueQuotted: false},
			{name: '--compilers-root-dir', value: compilersRootDir, isValueQuotted: false},
			{name: '--compiler-path', value: compilerPath, isValueQuotted: false},
			{name: '--runtime-path', value: runtimePath, isValueQuotted: false},
			{name: '--runtime-header-path', value: runtimeHeaderPath, isValueQuotted: false},
			{name: '--asm-path', value: asmPath, isValueQuotted: false},
			{name: '--exec-path', value: execPath, isValueQuotted: false},
			{name: '--obj-code-path', value: objCodePath, isValueQuotted: false},
		];

		// --flags is an optional argument to the run script and should
		// only be included if we have flags. If we have flags, then the
		// value to --flags should be a quoted string to prevent the script
		// from trying to interpret the compiler flags as its own arguments.
		if (flags.length)
			args.push({name: '--flags', value: flags.join(' '), isValueQuotted: true});

		const scriptExecutionResult = await this._runShellScript(runScriptPath, args);

		let result: RunResult;
		if (scriptExecutionResult instanceof SuccessfulOperation) {
			// On successful execution of the run script, we should return an 
			// ExecutionResult type wrapped in a SuccessfulOperation object.
			const successfulResult: ExecutionResult = scriptExecutionResult.getResult() as ExecutionResult;
			result = new SuccessfulOperation(successfulResult);
		} else {
			// On unsuccessful execution of the run script, we should return
			// a friendly error message (string) that's derived from the
			// exit code of the run script.

			const failureResult: ExecError = scriptExecutionResult.getResult() as ExecError;
			const { code: exitCode, stderr } = failureResult;

			// Map the error code to an error template string. If there
			// is no corresponding template for a given error code, then
			// use a default error message.
			let template = this._messagingService.messages.bash[`_${exitCode}`] 
				|| this._messagingService.messages.handler.UNKNOWN_ERROR;
			
			// Map the script exit code to an array of arguments
			// for the chosen template string.
			let args: string[];
			switch(exitCode) {
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
					// If there's a standard error string, then the template's
					// arguments come from the stderr string. In any other case,
					// the template arguments is an empty array.
					args = stderr
						? stderr.split(' ')
						: [];
			}

			result = new FailedOperation(
				this._messagingService.format(template, args));
		}

		return result;
	}

	private async _runShellScript(scriptPath: string, args: ShellArgument[],
		shell: Shell = Shell.BASH
	): Promise<OperationResult<ExecutionResult | ExecError>> {

		// Build the argument string.
		let argStr = '';
		args.forEach(({name, value, isValueQuotted}) => {
			if (value !== null && isValueQuotted) {
				argStr += `${name} "${value}" `;
			} else if (value !== null) {
				argStr += `${name} ${value} `;
			}
		});

		const shellCmd = `${shell.trim()} ${scriptPath.trim()} ${argStr.trim()}`;
		return await this._exec(shellCmd);
	}

	/*
	 * Spawns a shell then executes the given command within that shell, 
	 * buffering any generated output.
	 * @param {string} command The command to execute within a shell child process. If the
	 * command contains any user input, then it must first be sanitized to prevent
	 * the interpretation of any shell metacharacters. See the section on quoting
	 * in the Bash Reference Manual.
	 * @returns The standard ouput and error streams, as strings, if the
	 * execution succeeds. If the execution fails, then the error thrown
	 * is returned.
	 * @see https://www.gnu.org/software/bash/manual/html_node/Quoting.html
	 */
	private async _exec(command: string) {
		let result: OperationResult<ExecutionResult | ExecError>;
		try {
			// On successful execution, return an ExecutionResult type wrapped
			// in a SuccessfulOperation object.
			result = new SuccessfulOperation(await util.promisify(exec)(command));
		} catch(err) {
			// On unsuccessful execution, return an ExecError type wrapped
			// in a FailedOperation object.
			result = new FailedOperation(err);
		}
		return result;
	}
}