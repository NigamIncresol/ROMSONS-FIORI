/* global QUnit */
QUnit.config.autostart = false;

sap.ui.require(["stockreport/test/integration/AllJourneys"
], function () {
	QUnit.start();
});
