const statusTextMap = {
	'_200': 'OK',
	'_400': 'Bad Request',
	'_500': 'Internal Server Error'
};

const _baseResponseObj = (statusCode, headers, body) => {
	const statusText = statusTextMap[`_${statusCode}`];

	if (statusText !== undefined) {

		const response = {
			status: {
				code: statusCode,
				text: statusText
			},
			headers,
			body
		};

		if (statusCode !== 200) {
			// In order to map the Lambda output to a non-2xx HTTP response,
			// we need to throw an error. Whatever we pass to the Error constructor
			// will then be accessible via an "errorMessage" key in the Lambda response.
			// The pattern specified in the Lambda Error Regex of an integration response
			// will match against the entire string of "errorMessage".
			throw new Error(JSON.stringify(response));
		}
		
		return response;
	};
	
	throw new Error(`${statusCode} is not a supported status code.`);
};

const ok = (msg) => {
	return _baseResponseObj(
		200,
		{
			'Content-Type': 'application/json',
			'Access-Control-Allow-Headers': 'Content-Type',
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
		},
		JSON.stringify({ msg })
	);
};

const badRequest = (msg, errors = []) => {
	return _baseResponseObj(
		400,
		{
			'Content-Type': 'application/json',
			'Access-Control-Allow-Headers': 'Content-Type',
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
		},
		JSON.stringify({ msg, errors })
	);
};

const internalServerError = (msg, errors = []) => {
	return _baseResponseObj(
		500,
		{
			'Content-Type': 'application/json',
			'Access-Control-Allow-Headers': 'Content-Type',
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
		},
		JSON.stringify({ msg, errors })
	);
};

module.exports = {
	ok,
	badRequest,
	internalServerError
};