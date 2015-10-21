var client = 'client', server = 'server', both = ['client', 'server'];

Package.describe({
	name: 'krt:discourse-sso-consumer',
	summary: 'Koretech Discourse SSO Consumer Package',
	version: '0.1.0',
	git: 'https://github.com/koretech/meteor-krt-discourse-sso-consumer.git',
	documentation: null
});

Npm.depends({
	'btoa': '1.1.2',
	'atob': '1.1.2',
	'crypto-js': '3.1.5'
});

Package.onUse(function(api){

	api.versionsFrom('METEOR@1.2');

	api.use([
		'krt:core@0.1.4',
		'mongo',
		'accounts-base'
	], both);

	api.imply([
		'krt:core',
		'accounts-base',
		'accounts-password'
	]);

	api.addFiles([
		'namespaces.js'
	], both);

	api.addFiles([
		'lib/client.js'
	], client);

	api.addFiles([
		'lib/server.js'
	], server);

});
