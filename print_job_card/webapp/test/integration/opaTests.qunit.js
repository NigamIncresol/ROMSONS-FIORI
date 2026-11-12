/* global QUnit */
QUnit.config.autostart = false;

sap.ui.require(["printjobcard/test/integration/AllJourneys"
], function () {
	QUnit.start();
});
