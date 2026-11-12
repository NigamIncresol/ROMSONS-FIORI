/* global QUnit */
QUnit.config.autostart = false;

sap.ui.require(["productionorderconfirmlist/test/integration/AllJourneys"
], function () {
	QUnit.start();
});
