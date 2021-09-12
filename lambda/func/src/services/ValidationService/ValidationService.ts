import { Service } from 'typedi';
import { validate } from 'jsonschema';
import { configSchema, eventSchema } from './schemas';
import { SuccessfulOperation, FailedOperation, OperationResult } from '../../OperationResult';
import { Event } from '../../app';

@Service()
export class ValidationService {

	public validateEvent(event: Event): OperationResult<null | string[]> {
		return this._validate(event, eventSchema);
	}

	public validateConfig(config: any): OperationResult<null | string[]> {
		return this._validate(config, configSchema);
	}

	private _validate(instance: any, schema: any): OperationResult<null | string[]> {
		const { errors } = validate(instance, schema);

		if (errors.length === 0)
			return new SuccessfulOperation();

		// Convert errors from an array of objects to
		// an array of strings.
		const errorStrings = errors.map(({path, message}) => {
			const reducedPath = path.reduce((a, b) => {
				if (typeof b === 'number') {
					return `${a}[${b}]`;
				} else if (a === '') {
					return b;
				} else {
					return `${a}.${b}`;
				}
			}, '');
			return `${reducedPath} ${message}`;
		});
	
		return new FailedOperation(errorStrings);
	}
}