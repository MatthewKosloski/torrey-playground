import { OperationResult } from './OperationResult';

export class SuccessfulOperation<T> extends OperationResult<T> {
	constructor(result?: T) {
		super(result, true);
	}
}
