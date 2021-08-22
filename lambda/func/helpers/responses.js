const statusTextMap = {
	'_200': 'OK',
	'_400': 'Bad Request',
	'_500': 'Internal Server Error'
};

const _baseResponseObj = (statusCode, headers, body) => {
	const statusText = statusTextMap[`_${statusCode}`];

	if (statusText !== undefined) {
		return {
			status: {
				code: statusCode,
				text: statusText
			},
			headers,
			body
		};
	};
	
	throw new Error(`${statusCode} is not a supported status code.`);
};

const ok = (body) => {
	return _baseResponseObj(
		200,
		{
			'Content-Type': 'application/json',
			'Access-Control-Allow-Headers': 'Content-Type',
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
		},
		JSON.stringify(body)
	);
};

const badRequest = (body) => {
	return _baseResponseObj(
		400,
		{
			'Content-Type': 'application/json',
			'Access-Control-Allow-Headers': 'Content-Type',
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
		},
		JSON.stringify(body)
	);
};

const internalServerError = (body) => {
	return _baseResponseObj(
		500,
		{
			'Content-Type': 'application/json',
			'Access-Control-Allow-Headers': 'Content-Type',
			'Access-Control-Allow-Origin': '*',
			'Access-Control-Allow-Methods': 'OPTIONS,POST,GET'
		},
		JSON.stringify(body)
	);
};

module.exports = {
	ok,
	badRequest,
	internalServerError
};