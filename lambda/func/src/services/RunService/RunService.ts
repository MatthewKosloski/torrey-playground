import { Service } from 'typedi';
import * as path from 'path';
import * as util from 'util';
import { exec, ExecException } from 'child_process';
import {
	FailedOperation,
	OperationResult,
	SuccessfulOperation,
} from '../../OperationResult';
import { MessagingService } from '../MessagingService';

export interface ExecutionResult {
	stdout: string;
	stderr: string;
}

export type FailureMessage = string;

export type RunResult = OperationResult<ExecutionResult | FailureMessage>;

interface ExecError extends ExecException {
	stdout: string;
	stderr: string;
}

enum Shell {
	BASH = 'bash',
}

interface ShellArgument {
	name: string;
	value: string;
	isValueQuotted: boolean;
}

@Service()
export class RunService {
	// The path to the run script on disk, relative to the /build directory.
	private static RUN_SCRIPT_PATH = '../run.sh';

	// The path to the emphemeral storage location given to the Lambda function.
	// The current user must have read and write permissions for this directory.
	// Relative to the /build directory.
	private static EMPHEMERAL_STORAGE_PATH = '../../tmp';

	// The top-level directory to which all compilers are installed. Within this
	// folder, there are subfolders, where each subfolder contains the install
	// of a specific version of the compiler. The name of a subfolder is the
	// semantic version number of the compiler installed within. Cannot use
	// the emphemeral storage location because that location is created after
	// the Docker image is built.
	private static COMPILERS_INSTALL_PATH = '../../tmp2/compilers';

	constructor(private _messagingService: MessagingService) {}

	/**
	 * Attempts to compile the given Torrey program.
	 *
	 * @param program The Torrey program that is to be compiled.
	 * @param flags Flags that are to be passed to the Torrey compiler.
	 * @param semanticVersion The version of the Torrey compiler to execute. Must
	 * be a valid semantic version number of the form Major.Minor.Path.
	 * @returns An OperationResult containing either an error message,
	 * if an error is encountered when attempting to execute the compiler,
	 * or standard output and error of the compiler, if no errors.
	 */
	public run(
		program: string,
		flags: string[],
		semanticVersion: string
	): Promise<RunResult> {
		return this._run(
			program,
			flags,
			semanticVersion,
			`torreyc-${semanticVersion}.jar`,
			'runtime.c',
			'runtime.h',
			'runtime.o',
			'temp.s',
			'a.out'
		);
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
	 * @param {string} compilerFileName The name of the jar file of the compiler
	 * that is to be executed.
	 * @param {string} runtimeSourceFilePath The path (including the file name
	 * and extension) of the runtime source file, relative to the compilers
	 * installation path.
	 * @param {string} runtimeHeaderFilePath The path (including the file name
	 * and extension) of the runtime source header file, relative to the compilers
	 * installation path.
	 * @param {string} runtimeObjCodeFilePath The path (including the file name
	 * and extension) of the runtime object code path, relative to the compilers
	 * installation path.
	 * @param {string} asmFilePath The path (including the file name
	 * and extension) of the compiled assembly code, relative to the
	 * Lambda's emphemeral storage location.
	 * @param {string} execFilePath The path (including the file name
	 * and extension) of the assembled executable program, relative to the
	 * Lambda's emphemeral storage location.
	 * @returns An OperationResult containing either an error message,
	 * if an error is encountered when attempting to execute the compiler,
	 * or standard output and error of the compiler, if no errors.
	 */
	private async _run(
		program: string,
		flags: string[],
		semanticVersion: string,
		compilerFileName: string,
		runtimeSourceFilePath: string,
		runtimeHeaderFilePath: string,
		runtimeObjCodeFilePath: string,
		asmFilePath: string,
		execFilePath: string
	): Promise<RunResult> {
		// The location of the selected compiler, relative to the parent directory
		// that contains all compilers.
		const compilerDir = path.join(
			RunService.COMPILERS_INSTALL_PATH,
			semanticVersion
		);

		// The path to the compiler's jar file, relative to the parent
		// directory that contains all compilers.
		const compilerPath = path.join(compilerDir, compilerFileName);

		// The path to the compiler's runtime source, relative to the parent
		// directory that contains all compilers.
		const runtimePath = path.join(compilerDir, runtimeSourceFilePath);

		// The path to the compiler's runtime header file, relative to the parent
		// directory that contains all compilers.
		const runtimeHeaderPath = path.join(compilerDir, runtimeHeaderFilePath);

		// The path to which the resulting assembly code will be written, relative
		// to the Lambda's emphemeral storage directory.
		const asmPath = path.join(RunService.EMPHEMERAL_STORAGE_PATH, asmFilePath);

		// The path to which the resulting executable file will be written, relative
		// to the Lambda's emphemeral storage directory.
		const execPath = path.join(
			RunService.EMPHEMERAL_STORAGE_PATH,
			execFilePath
		);

		// The path to which the runtime object code will be written, relative
		// to the Lambda's emphemeral storage directory.
		const objCodePath = path.join(
			RunService.EMPHEMERAL_STORAGE_PATH,
			runtimeObjCodeFilePath
		);

		const args = [
			{
				name: '--program',
				value: program,
				isValueQuotted: true,
			},
			{
				name: '--compiler-path',
				value: compilerPath,
				isValueQuotted: false,
			},
			{
				name: '--runtime-path',
				value: runtimePath,
				isValueQuotted: false,
			},
			{
				name: '--runtime-header-path',
				value: runtimeHeaderPath,
				isValueQuotted: false,
			},
			{
				name: '--asm-path',
				value: asmPath,
				isValueQuotted: false,
			},
			{
				name: '--exec-path',
				value: execPath,
				isValueQuotted: false,
			},
			{
				name: '--obj-code-path',
				value: objCodePath,
				isValueQuotted: false,
			},
		];

		// --flags is an optional argument to the run script and should
		// only be included if we have flags. If we have flags, then the
		// value to --flags should be a quoted string to prevent the script
		// from trying to interpret the compiler flags as its own arguments.
		if (flags.length)
			args.push({
				name: '--flags',
				value: flags.join(' '),
				isValueQuotted: true,
			});

		const scriptExecutionResult = await this._runShellScript(
			RunService.RUN_SCRIPT_PATH,
			args
		);

		let result: RunResult;
		if (scriptExecutionResult instanceof SuccessfulOperation) {
			// On successful execution of the run script, we should return an
			// ExecutionResult type wrapped in a SuccessfulOperation object.
			const successfulResult: ExecutionResult =
				scriptExecutionResult.getResult() as ExecutionResult;
			result = new SuccessfulOperation(successfulResult);
		} else {
			// On unsuccessful execution of the run script, we should return
			// a friendly error message (string) that's derived from the
			// exit code of the run script.

			const failureResult: ExecError =
				scriptExecutionResult.getResult() as ExecError;
			const { code: exitCode, stderr } = failureResult;

			// Map the error code to an error template string. If there
			// is no corresponding template for a given error code, then
			// use a default error message.
			let template =
				this._messagingService.messages.bash[`_${exitCode}`] ||
				this._messagingService.messages.handler.UNKNOWN_ERROR;

			// Map the script exit code to an array of arguments
			// for the chosen template string.
			let args: string[];
			switch (exitCode) {
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
					args = stderr ? stderr.split(' ') : [];
			}

			result = new FailedOperation(
				this._messagingService.format(template, args)
			);
		}

		return result;
	}

	/*
	 * Attempts to execute the run script using bash shell, by default.
	 *
	 * @param {string} scriptPath The path to the run script on disk,
	 * relative to the /build directory.
	 * @param {ShellArgument[]} args An array of objects describing the arguments
	 * that are to be given to the run script.
	 * @param {Shell} shell The name of the shell to use to execute the run script.
	 * @returns The standard ouput and error streams, as strings, if the
	 * execution succeeds. If the execution fails, then the error thrown
	 * is returned.
	 */
	private async _runShellScript(
		scriptPath: string,
		args: ShellArgument[],
		shell: Shell = Shell.BASH
	): Promise<OperationResult<ExecutionResult | ExecError>> {
		// Build the argument string.
		let argStr = '';
		args.forEach(({ name, value, isValueQuotted }) => {
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
	 *
	 * @param {string} command The command to execute within a shell child process.
	 * If the command contains any user input, then it must first be sanitized to
	 * prevent the interpretation of any shell metacharacters. See the section on
	 * quoting in the Bash Reference Manual.
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
		} catch (err) {
			// On unsuccessful execution, return an ExecError type wrapped
			// in a FailedOperation object.
			result = new FailedOperation(err);
		}
		return result;
	}
}
