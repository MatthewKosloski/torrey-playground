export class OperationResult<T> {
	constructor(
		private _result: T = null,
		private _isSuccessful: boolean = false
	) {}

	public getResult(): T {
		return this._result;
	}

	public isSuccessful(): boolean {
		return this._isSuccessful;
	}

	public isPresent(): boolean {
		return this._result !== null;
	}

	public isEmpty(): boolean {
		return this._result === null;
	}
}