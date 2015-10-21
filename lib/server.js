atob = Npm.require('atob');
btoa = Npm.require('btoa');
crypto = Npm.require('crypto-js');

var Nonces = new Mongo.Collection('discourse-sso-consumer-nonces');

Meteor.methods({

	'discourse-sso-consumer-create-link': function() {
		var nonce = new Mongo.ObjectID().toHexString();

		Nonces.upsert({
			session: this.connection.id
		},{$set:{
			nonce: nonce,
			session: this.connection.id,
			timestamp: new Date()
		}});

		var payload = {
			nonce: nonce,
			return_sso_url: Meteor.settings.discourse.return_url
		};
		var query = '';
		for (key in payload) {
			query += encodeURIComponent(key) + '=' + encodeURIComponent(payload[key])+'&';
		}

		var base64 = btoa(query);
		var sig = crypto.HmacSHA256(base64, Meteor.settings.discourse.sso_secret);

		var data = {
			sso: base64,
			sig: sig
		};
		query = '';
		for (key in data) {
			query += encodeURIComponent(key) + '=' + encodeURIComponent(data[key])+'&';
		}

		return Meteor.settings.discourse.url + '/session/sso_provider?'+query;
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

	var sso = loginRequest.sso;
	var sig = loginRequest.sig;

	var x = crypto.HmacSHA256(decodeURIComponent(sso), Meteor.settings.discourse.sso_secret).toString(crypto.enc.Hex);

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
