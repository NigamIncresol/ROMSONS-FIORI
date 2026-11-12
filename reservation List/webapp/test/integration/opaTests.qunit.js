/* global QUnit */
QUnit.config.autostart = false;

sap.ui.require(["reservationlist/test/integration/AllJourneys"
], function () {
	QUnit.start();
});
