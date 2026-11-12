/* global QUnit */
QUnit.config.autostart = false;

sap.ui.require(["productionorder/test/integration/AllJourneys"
], function () {
	QUnit.start();
});
