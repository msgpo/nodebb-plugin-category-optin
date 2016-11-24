
'use strict';

var async = require.main.require('async');
var winston = require.main.require('winston');

var db = require.main.require('./src/database');

var batch = require.main.require('./src/batch');

var plugin = {};

plugin.onCategoryCreate = function(categoryData) {
	var now = Date.now();
	batch.processSortedSet('users:joindate', function(uids, next) {
		var keys = uids.map(function(uid) {
			return 'uid:' + uid + ':ignored:cids';
		});
		var nowArray = uids.map(function() {
			return now;
		});
		async.parallel([
			function (next) {
				db.sortedSetsAdd(keys, now, categoryData.cid, next);
			},
			function (next) {
				db.sortedSetAdd('cid:' + categoryData.cid + ':ignorers', nowArray, uids, next);
			}
		], next);
	}, {batch: 500}, function(err) {
		if (err) {
			winston.error(err);
		}
	});
};

plugin.onUserCreate = function(userData) {
	async.waterfall([
		function (next) {
			db.getSortedSetRange('categories:cid', 0, -1, next);
		},
		function (cids, next) {
			var now = Date.now();
			var nowArray = cids.map(function() {
				return now;
			});
			async.parallel([
				function (next) {
					db.sortedSetAdd('uid:' + userData.uid + ':ignored:cids', nowArray, cids, next);
				},
				function (next) {
					var keys = cids.map(function (cid) {
						return 'cid:' + cid + ':ignorers';
					});
					db.sortedSetsAdd(keys, now, userData.uid, next);
				}
			], next);
		}
	], function(err) {
		if (err) {
			winston.error(err);
		}
	});
};

module.exports = plugin;

