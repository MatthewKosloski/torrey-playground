import { OperationResult } from './OperationResult';

export class FailedOperation<T> extends OperationResult<T> {
	constructor(result?: T) {
		super(result);
	}
}