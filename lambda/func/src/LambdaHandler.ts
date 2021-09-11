import { Service } from 'typedi';
import { LoggingService, ResponseService, ResponseObject } from './services';
import { Event } from './app';

@Service()
export class LambdaHandler {
	constructor(
		private _loggingService: LoggingService,
		private _responseService: ResponseService
	) {}

	public handle(event: Event): ResponseObject {
		if (event.program === 'OK')
			return this._responseService.ok('OK Response test :)');
		else if (event.program === 'Bad Request')
			return this._responseService.badRequest('Bad Response test :)');
		else if (event.program === 'Internal Server Error')
			return this._responseService.internalServerError('Internal Server Error test :)');
	}

}