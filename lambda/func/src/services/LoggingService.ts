import { Service } from 'typedi';

// TODO: Remove stub
const messages = {
	format: (template: string, args: string[]) => {
		return `messages.format() stub`;
	}
}

@Service()
export class LoggingService {
	
	constructor(
		private readonly _isEnabled: boolean = true
	) {}

	public log(msgs: string[]): void {
		if (this._isEnabled) {
			console.log(...msgs);
		}
	}

	public logTemplate(template: string, args: string[]): void {
		if (this._isEnabled) {
			console.log(messages.format(template, args));
		}
	}
}