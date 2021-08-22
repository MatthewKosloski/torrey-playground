const responses = require('./responses');
const readConfig = require('./readConfig');
const runCompiler = require('./runCompiler');
const validate = require('./validate');

module.exports = {
	readConfig,
	responses,
	runCompiler,
	validate
};