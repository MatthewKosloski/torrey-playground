export class OperationResult<T> {
	constructor(
		private _result: T,
		private _isSuccessful: boolean = false
	) {}

	public getResult(): T {
		return this._result;
	}

	public isSuccessful(): boolean {
		return this._isSuccessful;
	}
}