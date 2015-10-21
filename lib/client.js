KRT.DiscourseSSOConsumer.redirect = function() {
	Meteor.call('discourse-sso-consumer-create-link', function(err, res){
		if (!err) window.location = res;
	});
};

Meteor.loginWithDiscourse = function(sso, sig, callback) {
	if (!Meteor.user()) {
		var loginRequest = {
			discourse: true,
			sso: sso,
			sig: sig
		}

		Accounts.callLoginMethod({
			methodArguments: [loginRequest],
			userCallback: callback
		});
	} else if (callback) {
		callback();
	}
};
