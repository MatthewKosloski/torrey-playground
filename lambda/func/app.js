const util = require('util');
const exec = util.promisify(require('child_process').exec);

module.exports.handler = async (event) => {
	const defaults = {
		program: "",
		options: {
			flags: [],
			semanticVersion: '3.0.0'
		}
	};
	
	if (event != undefined) {
		// An event object has been provided,
		// so merge the default properties with
		// those in the given event such that
		// properties specified in the given event
		// override the defaults.
		event = {
			program: event.program || defaults.program,
			options: {
				...defaults.options,
				...event.options
			}
		};
	} else {
		// No event object has been provided, so
		// use the defaults.
		event = defaults;
	}

	const { program, options } = event;
	const { flags, semanticVersion } = options;

	const supportedSemanticVersions = ['1.0.1', '2.0.1', '3.0.0'];

	if (supportedSemanticVersions.filter((v) => v == semanticVersion).length == 0)
	{
		return {
			statusCode: 400,
			message: `Bad Request. The provided semanticVersion "${semanticVersion}" is invalid. Please visit https://github.com/MatthewKosloski/torrey/tags to view a list of valid semantic versions. Please note that not all compiler versions listed there are installed on this server.`
		};
	}

	const programPath = './a.out';

	const cdCmd = `cd ./${semanticVersion}`;
	const echoCmd = `echo "${program}"`;
	const javaCmd = `java -jar torreyc-${semanticVersion}.jar`;
	const programCmd = `[ -f ${programPath} ] && ${programPath} && rm ${programPath}`;

	// Change directory to the compiler version's folder and pipe in the program
	// to the compiler as standard input.
	let command = `${cdCmd} && ${echoCmd} | ${javaCmd}`;
	
	if (flags.length != 0)
		command = `${command} ${flags.join(' ')}`;
		
	if (!(flags.includes('-L') || flags.includes('-p') || flags.includes('-ir')
		|| flags.includes('-S'))) {
		// Neither -L, -p, -ir, or -S have been provided,
		// so run the executable and subsequently delete it.
		command = `${command} && ${programCmd}`;
	}

	const { stdout, stderr } = await exec(command);

	return {
		statusCode: 200,
		message: {stdout, stderr}
	};
};