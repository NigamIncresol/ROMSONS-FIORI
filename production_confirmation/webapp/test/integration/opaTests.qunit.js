/* global QUnit */
QUnit.config.autostart = false;

sap.ui.require(["productionconfirmation/test/integration/AllJourneys"
], function () {
	QUnit.start();
});
