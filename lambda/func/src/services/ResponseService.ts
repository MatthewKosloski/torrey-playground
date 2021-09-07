import { Service } from 'typedi';

// TODO: Remove stub
const messages = {
	format: (template: string, args: string[]) => {
		return `messages.format() stub`;
	}
}

type ResponseBody = string | object;

enum HttpStatusCode {
	OK = 200,
	BAD_REQUEST = 400,
	INTERNAL_SERVER_ERROR = 500
}

enum HttpStatusText {
	OK = 'OK',
	BAD_REQUEST = 'Bad Request',
	INTERNAL_SERVER_ERROR = 'Internal Server Error'
}

interface HttpStatus {
	code: HttpStatusCode,
	text: HttpStatusText
}

interface HttpHeaders {
	[key: string]: string
}

class Response {
	protected _status: HttpStatus;
	protected _body: ResponseBody;
	protected _headers: HttpHeaders;
	
	constructor(status: HttpStatus, body: ResponseBody = {}, 
		headers: HttpHeaders = {}) {
			this._status = status;
			this._headers = headers;
			this._body = typeof body === 'object'
				? JSON.stringify(body)
				: body;
	}

	public static withCORS(response: Response): Response {
		const clone = response.clone();
		clone._headers = {
			...clone._headers,
			'Access-Control-Allow-Headers': 'Content-Type',
			'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
			'Access-Control-Allow-Origin': '*'
		} 
		return clone;
	}

	public clone(): Response {
		const { code, text } = this._status;
		return new Response(
			{ code, text },
			this._body,
			{ ...this._headers });
	}

	public statusCode(): number {
		return this._status.code;
	}
	
	public toString(): string {
		return JSON.stringify({
			status: this._status,
			headers: this._headers,
			body: this._body
		});
	}
}

class JSONResponse extends Response {
	constructor(status: HttpStatus, body: ResponseBody, headers: HttpHeaders) {
		super(status, body, headers);
		this._headers = {
			...this._headers,
			'Content-Type': 'application/json'
		}
	}
}

class OKResponse extends JSONResponse {
	constructor(body: ResponseBody, headers?: HttpHeaders) {
		super({ code: HttpStatusCode.OK,
			text: HttpStatusText.OK }, body, headers);
	}
}

class BadRequestResponse extends JSONResponse {
	constructor(body: ResponseBody, headers?: HttpHeaders) {
		super({ code: HttpStatusCode.BAD_REQUEST,
			text: HttpStatusText.BAD_REQUEST}, body, headers);
	}
}

class InternalServerErrorResponse extends JSONResponse {
	constructor(body: ResponseBody, headers?: HttpHeaders) {
		super({ code: HttpStatusCode.INTERNAL_SERVER_ERROR,
			text: HttpStatusText.INTERNAL_SERVER_ERROR }, body, headers);
	}
}

interface ResponseObject {
	status: {
		code: number,
		text: string
	},
	headers: {
		[key: string]: string
	},
	body: string
}

@Service()
export class ResponseService {
	public ok(body: ResponseBody): 
		ResponseObject {
		return this._toResponseObject(Response.withCORS(
			new OKResponse(body)));
	}

	public badRequest(msg: string, errors: string[] = []): 
		ResponseObject {
		return this._toResponseObject(Response.withCORS(
			new BadRequestResponse({ msg, errors })));
	}

	public badRequestTemplate(template: string, args: string[] = []):
		ResponseObject {
		return this._toResponseObject(Response.withCORS(
			new BadRequestResponse(messages.format(template, args))));
	}

	public internalServerError(msg: string, errors: string[] = []):
		ResponseObject {
		return this._toResponseObject(Response.withCORS(
			new InternalServerErrorResponse({ msg, errors })));
	}

	private _toResponseObject(response: Response): 
		ResponseObject {
		const responseStr = response.toString();
		const responseObject = JSON.parse(responseStr);
		
		// In order to map the Lambda output to a non-2xx HTTP response,
		// we need to throw an error. Whatever we pass to the Error constructor
		// will then be accessible via an "errorMessage" key in the Lambda response.
		// The pattern specified in the Lambda Error Regex of an integration response
		// will match against the entire string of "errorMessage".
		if (response.statusCode() !== 200)
			throw new Error(responseStr);

		return responseObject;
	}
}