sap.ui.define(
  ["sap/ui/core/mvc/Controller", "sap/ui/Device", "sap/m/MessageToast"],
  function (Controller, Device, MessageToast) {
    "use strict";

    return Controller.extend("testorientation.controller.View1", {
      onInit: function () {
        this._checkOrientation();

        Device.orientation.attachHandler(this._checkOrientation.bind(this));
        const oDeviceModel = this.getOwnerComponent().getModel("device");

        console.log("Device model info", oDeviceModel.getData());
      },

      onExit: function () {
        Device.orientation.detachHandler(this._checkOrientation.bind(this));
      },

      _checkOrientation: function () {
        var bShowWarning =
          Device.orientation.portrait &&
          (Device.system.phone || Device.system.tablet);

        console.log(
          "[View1] orientation check - portrait:",
          Device.orientation.portrait,
          "phone:",
          Device.system.phone,
          "tablet:",
          Device.system.tablet,
          "=> showWarning:",
          bShowWarning,
        );

        this.byId("orientationWarning").setVisible(bShowWarning);
        this.byId("leaveAppForm").setVisible(!bShowWarning);
      },

      onLeaveApp: function () {
        var sReason = this.byId("leaveReasonSelect").getSelectedKey();
        var sComments = this.byId("leaveCommentsInput").getValue();

        console.log(
          "[View1] onLeaveApp - reason:",
          sReason,
          "comments:",
          sComments,
        );

        MessageToast.show("Leaving application...");
      },
    });
  },
);
