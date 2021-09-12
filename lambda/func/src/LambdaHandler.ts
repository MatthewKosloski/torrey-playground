import { Service } from 'typedi';
import { Event } from './app';
import { FailedOperation, SuccessfulOperation } from './OperationResult';
import {
	IOService,
	LoggingService,
	MessagingService,
	ResponseService,
	RunService,
	ValidationService,
} from './services';
import { ExecutionResult } from './services/RunService/RunService';
import { ResponseObject } from './services/ResponseService';
import { Config } from './services/IOService';

@Service()
export class LambdaHandler {
	// The path (including filename and extension) to the
	// Lambda function's JSON configuration file. Path is
	// relative to the build/ directory.
	private static CONFIG_FILE_PATH = '../config.json';

	// The maximum number of characters allowed for a Torrey program.
	private static MAX_PROGRAM_LENGTH = 1024;

	constructor(
		private _ioService: IOService,
		private _loggingService: LoggingService,
		private _messagingService: MessagingService,
		private _responseService: ResponseService,
		private _runService: RunService,
		private _validationService: ValidationService
	) {}

	public async handle(event: Event): Promise<ResponseObject> {
		const {
			EVENT_INVALID,
			CONFIG_CANNOT_READ,
			CONFIG_INVALID,
			MAXIMUM_PROGRAM_LENGTH_EXCEEDED,
			INVALID_SEMANTIC_VERSION,
			INVALID_COMPILER_FLAG,
		} = this._messagingService.messages.handler;

		// Validate the event against a JSON schema.
		const eventValidationResult = this._validationService.validateEvent(event);

		if (eventValidationResult instanceof FailedOperation) {
			// The event failed validation.
			return this._responseService.badRequest(
				EVENT_INVALID,
				eventValidationResult.getResult()
			);
		}

		// Attempt to read the Lambda config file from disk.
		const getConfigResult = await this._ioService.getConfig(
			LambdaHandler.CONFIG_FILE_PATH
		);

		if (
			getConfigResult instanceof FailedOperation &&
			getConfigResult.isEmpty()
		) {
			// Failed to read the config file from disk.
			return this._responseService.internalServerError(CONFIG_CANNOT_READ);
		} else if (
			getConfigResult instanceof FailedOperation &&
			getConfigResult.isPresent()
		) {
			// The config file failed validation.
			return this._responseService.internalServerError(
				CONFIG_INVALID,
				getConfigResult.getResult() as string[]
			);
		}

		const { defaults, supportedSemanticVersions, supportedFlags } =
			getConfigResult.getResult() as Config;

		// Merge config defaults with event data.
		const mergedInput = {
			program:
				event.program === undefined
					? defaults.program.trim()
					: event.program.trim(),
			options: {
				...defaults.options,
				...event.options,
			},
		};

		const { program, options } = mergedInput;
		const { flags, semanticVersion } = options;
		const supportedFlagNames = supportedFlags.map((f) => f.name);

		// Validate the length of the provided program.
		if (program.length > LambdaHandler.MAX_PROGRAM_LENGTH) {
			return this._responseService.badRequestTemplate(
				MAXIMUM_PROGRAM_LENGTH_EXCEEDED,
				[program.length + '', LambdaHandler.MAX_PROGRAM_LENGTH + '']
			);
		}

		// Validate the provided semantic version.
		if (!supportedSemanticVersions.includes(semanticVersion)) {
			return this._responseService.badRequestTemplate(
				INVALID_SEMANTIC_VERSION,
				[semanticVersion, supportedSemanticVersions.join(', ').trim()]
			);
		}

		// Validate the provided compiler flags.
		if (flags.map((f) => supportedFlagNames.includes(f)).includes(false)) {
			return this._responseService.badRequestTemplate(INVALID_COMPILER_FLAG, [
				supportedFlagNames.join(', ').trim(),
			]);
		}

		const runResult = await this._runService.run(
			event.program,
			flags,
			semanticVersion
		);

		if (runResult instanceof SuccessfulOperation) {
			return this._responseService.ok(runResult.getResult() as ExecutionResult);
		} else {
			return this._responseService.internalServerError(
				runResult.getResult() as string
			);
		}
	}
}
