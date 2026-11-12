sap.ui.define(
  ["sap/ui/core/mvc/Controller", "sap/m/MessageToast", "sap/m/MessageBox"],
  function (Controller, MessageToast, MessageBox) {
    "use strict";

    // const Base_url = "http://192.168.0.136:3000";
    // const Base_url = "http://192.168.1.61:3000";
    const Base_url = "http://localhost:3000";

    return Controller.extend("zlogpage.controller.ForgotPassword", {
      onInit: function () {
        var sImageUrl = sap.ui.require.toUrl("zlogpage/images/logoNew.svg");
        this.byId("logoImage").setSrc(sImageUrl);

        var oRouter = this.getOwnerComponent().getRouter();
        oRouter
          .getRoute("ForgotPassword")
          .attachPatternMatched(this._onObjectMatched, this);
      },

      _onObjectMatched: function (oEvent) {
        this._initBgSlideshow();

        // Get route parameters
        this.sEmployeeId = oEvent.getParameter("arguments").employeeId;
        this.sPlant = oEvent.getParameter("arguments").plant;

        console.log("Employee ID:", this.sEmployeeId);
        console.log("Plant:", this.sPlant);
      },
      onNavBack: function () {
        this.getOwnerComponent().getRouter().navTo("RouteView1");
      },

      // =========================================================
      // Generate OTP
      // =========================================================
      onGenerateOTPPress: function () {
        var oView = this.getView();

        var sEmployeeId = this.sEmployeeId;
        var sPlant = this.sPlant;
        var sGmail = oView.byId("emailInput").getValue();

        console.log("Generating OTP for Employee ID:", sEmployeeId);
        console.log("Plant:", sPlant);
        console.log("Email:", sGmail);

        // Validation
        if (!sGmail) {
          MessageBox.error("Please enter email");
          return;
        }

        var that = this;

        sap.ui.core.BusyIndicator.show(0);
        $.ajax({
          url: Base_url + "/api/auth/forgot-password-send-OTP",
          method: "POST",
          contentType: "application/json",

          data: JSON.stringify({
            employeeID: sEmployeeId,
            Email: sGmail,
            plant: sPlant,
          }),

          success: function (oData) {
            sap.ui.core.BusyIndicator.hide();
            console.log("Generate OTP Response:", oData);

            // Enable fields
            oView.byId("otpInput").setEnabled(true);
            oView.byId("newPassword").setEnabled(true);
            oView.byId("confirmPassword").setEnabled(true);

            if (oData.status === "S") {
              MessageToast.show(oData.Message);
            } else {
              MessageBox.error(oData.Message || "Failed to generate OTP");
            }
          },

          error: function (xhr) {
            sap.ui.core.BusyIndicator.hide();
            console.log("Generate OTP Error:", xhr);

            MessageBox.error("Failed to generate OTP");
          },
        });
      },

      // =========================================================
      // Submit OTP & Reset Password
      // =========================================================
      onSubmitPress: function () {
        var oView = this.getView();

        var sGmail = oView.byId("emailInput").getValue();
        var sOtp = parseInt(oView.byId("otpInput").getValue());
        var sNewPassword = oView.byId("newPassword").getValue();
        var sConfirmPassword = oView.byId("confirmPassword").getValue();

        var sPlant = this.sPlant;

        console.log("Email:", sGmail);
        console.log("OTP:", sOtp);
        console.log("Plant:", sPlant);

        // Validation
        if (!sGmail || isNaN(sOtp) || !sNewPassword || !sConfirmPassword) {
          MessageBox.error("Please fill all fields");
          return;
        }

        // Password validation
        if (sNewPassword !== sConfirmPassword) {
          MessageBox.error("Passwords do not match");
          return;
        }

        var that = this;

        sap.ui.core.BusyIndicator.show(0);
        $.ajax({
          url: Base_url + "/api/auth/forgot-password-submit-OTP",
          method: "PUT",
          contentType: "application/json",

          data: JSON.stringify({
            employeeID: this.sEmployeeId,
            Otp: sOtp,
            password: sNewPassword,
            plant: sPlant,
          }),

          success: function (oData) {
            sap.ui.core.BusyIndicator.hide();
            console.log("Password Reset Response:", oData);

            MessageToast.show("Password reset successful. Redirecting...");

            // Clear fields
            oView.byId("emailInput").setValue("");
            oView.byId("otpInput").setValue("");
            oView.byId("newPassword").setValue("");
            oView.byId("confirmPassword").setValue("");

            // Navigate after delay
            setTimeout(function () {
              var sRouter = sap.ui.core.UIComponent.getRouterFor(that);

              sRouter.navTo("RouteView1");
            }, 3000);
          },

          error: function (xhr) {
            sap.ui.core.BusyIndicator.hide();
            console.log("Submit Error:", xhr);

            MessageBox.error("Failed to reset password");
          },
        });
      },

      // =========================================================
      // New Password Validation
      // =========================================================
      onPasswordLiveChange: function (oEvent) {
        var sValue = oEvent.getParameter("value");

        var oNewPassInput = this.byId("newPassword");
        var oConfirmPassInput = this.byId("confirmPassword");

        var sConfirmValue = oConfirmPassInput.getValue();

        // Validate new password
        if (sValue.length === 0) {
          oNewPassInput.setValueState("Error");
          oNewPassInput.setValueStateText("Password cannot be empty");
        } else if (sValue.length < 8) {
          oNewPassInput.setValueState("Warning");
          oNewPassInput.setValueStateText(
            "Password must be at least 8 characters",
          );
        } else {
          oNewPassInput.setValueState("Success");
          oNewPassInput.setValueStateText("");
        }

        // Validate confirm password again
        if (sConfirmValue.length > 0) {
          if (sValue === sConfirmValue) {
            oConfirmPassInput.setValueState("Success");
            oConfirmPassInput.setValueStateText("Passwords match");
          } else {
            oConfirmPassInput.setValueState("Error");
            oConfirmPassInput.setValueStateText("Passwords do not match");
          }
        }
      },

      // =========================================================
      // Confirm Password Validation
      // =========================================================
      onConfirmPasswordLiveChange: function (oEvent) {
        var sConfirmValue = oEvent.getParameter("value");

        var oNewPassInput = this.byId("newPassword");
        var oConfirmPassInput = this.byId("confirmPassword");

        var sNewValue = oNewPassInput.getValue();

        if (sConfirmValue.length === 0) {
          oConfirmPassInput.setValueState("None");
          oConfirmPassInput.setValueStateText("");
        } else if (sConfirmValue === sNewValue) {
          oConfirmPassInput.setValueState("Success");
          oConfirmPassInput.setValueStateText("Passwords match ✓");
        } else if (sNewValue.startsWith(sConfirmValue)) {
          oConfirmPassInput.setValueState("Warning");
          oConfirmPassInput.setValueStateText("Keep typing...");
        } else {
          oConfirmPassInput.setValueState("Error");
          oConfirmPassInput.setValueStateText("Passwords do not match");
        }
      },
      onToggleNewPassword: function () {
        var oInput = this.byId("newPassword");
        var oIcon = this.byId("newPasswordToggleIcon");

        if (oInput.getType() === "Password") {
          oInput.setType("Text");
          oIcon.setSrc("sap-icon://hide");
          oIcon.setTooltip("Hide password");
        } else {
          oInput.setType("Password");
          oIcon.setSrc("sap-icon://show");
          oIcon.setTooltip("Show password");
        }
      },

      onToggleConfirmPassword: function () {
        var oInput = this.byId("confirmPassword");
        var oIcon = this.byId("confirmPasswordToggleIcon");

        if (oInput.getType() === "Password") {
          oInput.setType("Text");
          oIcon.setSrc("sap-icon://hide");
          oIcon.setTooltip("Hide password");
        } else {
          oInput.setType("Password");
          oIcon.setSrc("sap-icon://show");
          oIcon.setTooltip("Show password");
        }
      },

      _initBgSlideshow: function () {
        document.body.style.removeProperty("background");
        var oBg = document.getElementById("loginBgSlideshow");
        if (oBg) {
          oBg.style.display = "";
          return;
        }
        var aImages = [
          sap.ui.require.toUrl("zlogpage/images/rms1.jpg"),
          sap.ui.require.toUrl("zlogpage/images/rms2.jpg"),
          sap.ui.require.toUrl("zlogpage/images/rms3.jpg"),
        ];
        var oContainer = document.createElement("div");
        oContainer.id = "loginBgSlideshow";
        oContainer.style.cssText =
          "position:fixed;inset:0;z-index:0;pointer-events:none;";
        var iDuration = 15;
        aImages.forEach(function (sUrl, i) {
          var oSlide = document.createElement("div");
          oSlide.className = "loginBgSlide";
          oSlide.style.backgroundImage = "url('" + sUrl + "')";
          oSlide.style.animationDelay =
            "-" + i * (iDuration / aImages.length) + "s";
          oContainer.appendChild(oSlide);
        });
        document.body.insertBefore(oContainer, document.body.firstChild);
      },
    });
  },
);
