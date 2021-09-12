import { Service } from 'typedi';
import * as util from 'util';
import * as fs from 'fs';
import { ValidationService } from '../services';
import {
	FailedOperation,
	OperationResult,
	SuccessfulOperation,
} from '../OperationResult';

export interface Config {
	defaults: {
		program: string;
		options: {
			flags: string[];
			semanticVersion: string;
		};
	};
	supportedSemanticVersions: string[];
	supportedFlags: {
		name: string;
		description: string;
	}[];
}

@Service()
export class IOService {
	constructor(private _validationService: ValidationService) {}

	/**
	 * Attempts to read and validate the Lambda configuration file at the given path.
	 * @param path The path to the Lambda configuration file.
	 * @returns If the config file cannot be read, then an empty FailedOperation
	 * object is returned. If the config file fails validation, then an array of strings
	 * wrapped in a FailedOperation is returned. Otherwise, a SuccessfulOperation with the
	 * config file contents is returned.
	 */
	public async getConfig(
		path: string
	): Promise<OperationResult<null | string[] | Config>> {
		const readResult = await this._read(path);

		if (readResult instanceof FailedOperation) {
			// Failed to read the config file.
			return readResult as FailedOperation<null>;
		}

		const configObj: object = JSON.parse(readResult.getResult() as string)[0];
		const validationResult = this._validationService.validateConfig(configObj);

		if (validationResult instanceof FailedOperation) {
			// The config file failed to validate against its JSON schema.
			return validationResult as FailedOperation<string[]>;
		}

		// At this point, we've successfully read the config
		// file and it has passed validation.
		return new SuccessfulOperation(configObj as Config);
	}

	/*
	 * Reads the entire contents of the file at the given path.
	 *
	 * @param path The path to the file (including filename and extension)
	 * that is to be read.
	 * @returns An OperationResult containing the file contents or null if
	 * there's an error reading the file.
	 */
	private async _read(path: string): Promise<OperationResult<string | null>> {
		try {
			const fileContents: string = await util.promisify(fs.readFile)(
				path,
				'utf8'
			);
			return new SuccessfulOperation(fileContents);
		} catch {
			return new FailedOperation();
		}
	}
}
