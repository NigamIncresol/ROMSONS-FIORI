/* global QUnit */
QUnit.config.autostart = false;

sap.ui.require(["reservationdetails/test/integration/AllJourneys"
], function () {
	QUnit.start();
});
