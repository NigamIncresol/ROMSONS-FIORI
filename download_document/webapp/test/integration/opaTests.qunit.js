/* global QUnit */
QUnit.config.autostart = false;

sap.ui.require(["downloaddocument/test/integration/AllJourneys"
], function () {
	QUnit.start();
});
