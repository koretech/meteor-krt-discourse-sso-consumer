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
		};

		Accounts.callLoginMethod({
			methodArguments: [loginRequest],
			userCallback: callback
		});
	} else if (callback) {
		callback();
	}
};

Template.registerHelper('discourseAvatar', function(size){
	var service = ServiceConfiguration.configurations.findOne({service:'discourse-api'});
	check(service, Match.Where(function(x){return !!x}));
	var url = service.url + Meteor.user().profile.avatar_template;
	return url.replace('{size}',size);
});
