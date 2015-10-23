atob = Npm.require('atob');
btoa = Npm.require('btoa');
crypto = Npm.require('crypto-js');

var Nonces = new Mongo.Collection('discourse-sso-consumer-nonces');

Meteor.methods({

	'discourse-sso-consumer-create-link': function() {
		var nonce = new Mongo.ObjectID().toHexString();

		var service = ServiceConfiguration.configurations.findOne({service:'discourse-sso'});
		check(service, Match.Where(function(x){return !!x}));

		Nonces.upsert({
			session: this.connection.id
		},{$set:{
			nonce: nonce,
			session: this.connection.id,
			timestamp: new Date()
		}});

		var payload = {
			nonce: nonce,
			return_sso_url: service.return_url
		};
		var query = '';
		for (key in payload) {
			query += encodeURIComponent(key) + '=' + encodeURIComponent(payload[key])+'&';
		}

		var base64 = btoa(query);
		var sig = crypto.HmacSHA256(base64, service.secret);

		var data = {
			sso: base64,
			sig: sig
		};
		query = '';
		for (key in data) {
			query += encodeURIComponent(key) + '=' + encodeURIComponent(data[key])+'&';
		}

		return service.url + '/session/sso_provider?'+query;
	}

});

/**
 *
 * @param queryString
 * @return {{}}
 */
parseQueryString = function( queryString ) {
	var params = {}, queries, temp, i, l;

	// Split into key/value pairs
	queries = queryString.split("&");

	// Convert the array of strings into an object
	for ( i = 0, l = queries.length; i < l; i++ ) {
		temp = queries[i].split('=');
		params[temp[0]] = temp[1];
	}

	return params;
};


Accounts.registerLoginHandler(function (loginRequest) {
	//Only process ldap requests
	if (!loginRequest.discourse) {
		return undefined;
	}

	var service = ServiceConfiguration.configurations.findOne({service:'discourse-sso'});
	check(service, Match.Where(function(x){return !!x}));

	var sso = loginRequest.sso;
	var sig = loginRequest.sig;

	var x = crypto.HmacSHA256(decodeURIComponent(sso), service.secret).toString(crypto.enc.Hex);

	if (x != sig) throw new Meteor.Error(403, 'Signature mismatch.');

	var qs = atob(decodeURIComponent(sso));
	var data = parseQueryString(qs);

	if (!Nonces.findOne({nonce: data.nonce})) {
		throw new Meteor.Error(403, 'Nonce mismatch.');
	}

	// Log them in if user exists else create a new user
	var user = Meteor.users.findOne({'services.discourse.id': data.external_id});

	var userId = null;
	if (user) {
		userId = user._id;
	} else {
		userId = Accounts.createUser({
			username: decodeURIComponent(data.username),
			email: decodeURIComponent(data.email),
			profile: {
				name: decodeURIComponent(data.name).replace(/\+/, ' ')
			}
		});

		Meteor.users.update({_id:userId},{
			$set: {
				admin: (data.admin == 'true'),
				moderator: (data.moderator == 'true'),
				'services.discourse.id': data.external_id
			}
		});

		pullDiscourseProfile(userId, decodeURIComponent(data.username));
	}

	//creating the token and add to the user
	var stampedToken = Accounts._generateStampedLoginToken();
	Meteor.users.update(userId,
		{$push: {'services.resume.loginTokens': stampedToken}}
	);

	//send logged in user's user id
	return {
		userId: userId,
		type: 'discourse',
		token: stampedToken.token,
		tokenExpires: Accounts._tokenExpiration(stampedToken.when)
	}
});

function pullDiscourseProfile(id, username) {
	var service = ServiceConfiguration.configurations.findOne({service:'discourse-api'});
	check(service, Match.Where(function(x){return !!x}));

	var url = service.url + '/users/' + username + '.json';

	HTTP.get(url, {
		params: {
			api_key: service.secret,
			api_username: username
		}
	}, function(err, res){
		if (err) return;

		var obj = {};
		_(service.expose).each(function(itm){
			obj['profile.'+itm] = res.data.user[itm];
		});

		Meteor.users.update({_id:id},{$set:obj});
	});
}
