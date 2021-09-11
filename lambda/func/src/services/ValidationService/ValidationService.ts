import { Service } from 'typedi';
import { validate } from 'jsonschema';
import { configSchema, eventSchema } from './schemas';

@Service()
export class ValidationService {

	public validateEvent(event: Event): string[] {
		return this._validate(event, eventSchema);
	}

	public validateConfig(config: any): string[] {
		return this._validate(config, configSchema);
	}

	private _validate(instance: any, schema: any): string[] {
		const { errors } = validate(instance, schema);

		// Convert errors from an array of objects to
		// an array of strings.
		const result = errors.map(({path, message}) => {
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
	
		return result;
	}
}