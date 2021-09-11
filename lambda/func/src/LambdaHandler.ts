import { Service } from 'typedi';
import { Event } from './app';
import { SuccessfulOperation } from './OperationResult';
import { LoggingService, ResponseService, RunService } from './services';
import { ExecutionResult } from './services/RunService/RunService';
import { ResponseObject } from './services/ResponseService';

@Service()
export class LambdaHandler {
	constructor(
		private _loggingService: LoggingService,
		private _responseService: ResponseService,
		private _runService: RunService
	) {}

	public async handle(event: Event): Promise<ResponseObject> {
		const runResult = await this._runService.run(
			'(println (+ 32 10))',
			[],
			'3.0.3',
			'../run.sh',
			'../../tmp',
			'../../tmp2/compilers'
		);

		if (runResult instanceof SuccessfulOperation) {
			return this._responseService.ok(runResult.getResult() as ExecutionResult);
		} else {
			return this._responseService.internalServerError(runResult.getResult() as string);
		}
	}

}