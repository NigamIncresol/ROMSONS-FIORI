/* global QUnit */
QUnit.config.autostart = false;

sap.ui.getCore().attachInit(function () {
	"use strict";

	sap.ui.require([
		"zlogpage/test/unit/AllTests"
	], function () {
		QUnit.start();
	});
});
