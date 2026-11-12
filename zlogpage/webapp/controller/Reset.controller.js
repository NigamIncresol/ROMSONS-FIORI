sap.ui.define(
  ["sap/ui/core/mvc/Controller", "sap/m/MessageToast", "sap/m/MessageBox"],
  function (Controller, MessageToast, MessageBox) {
    "use strict";

    // const Base_url = "http://192.168.0.136:3000";
    // const Base_url = "http://192.168.1.61:3000";
    const Base_url = "http://localhost:3000";

    return Controller.extend("zlogpage.controller.Reset", {
      // =========================================================
      // Init
      // =========================================================
      onInit: function () {
        var sImageUrl = sap.ui.require.toUrl("zlogpage/images/logoNew.svg");
        this.byId("logoImage").setSrc(sImageUrl);

        this.getOwnerComponent()
          .getRouter()
          .getRoute("Reset")
          .attachPatternMatched(this._onObjectMatched, this);
      },

      // =========================================================
      // Route Matched
      // =========================================================
      _onObjectMatched: function (oEvent) {
        this._initBgSlideshow();

        this.sEmployeeId = oEvent.getParameter("arguments").employeeId;

        this.sPlant = oEvent.getParameter("arguments").plant;

        console.log("Employee ID:", this.sEmployeeId);
        console.log("Plant:", this.sPlant);
      },

      // =========================================================
      // Input Change
      // =========================================================
      onInputChange: function (oEvent) {
        oEvent.getSource().setValueState("None");
      },

      // =========================================================
      // After Rendering
      // =========================================================
      onAfterRendering: function () {
        function getCookie(name) {
          var value = "; " + document.cookie;

          var parts = value.split("; " + name + "=");

          if (parts.length === 2) {
            return decodeURIComponent(parts.pop().split(";").shift());
          }

          return "";
        }

        // Read Cookies
        var sUser = getCookie("employeeId");
        var sPlant = getCookie("plant");
        var sSessionId = getCookie("sessionId");

        if (!sUser || !sPlant || !sSessionId) {
          console.log("No Cookies found");
          return;
        }

        console.log("Employee ID:", sUser);
        console.log("Plant:", sPlant);
        console.log("Session ID:", sSessionId);

        $.ajax({
          url: Base_url + "/api/auth/logout",
          method: "PUT",
          contentType: "application/json",

          data: JSON.stringify({
            employeeId: sUser,
            plant: sPlant,
            sessionId: sSessionId,
          }),

          success: function (oData) {
            console.log("Logout Success Response:", oData);

            // Clear Cookies
            document.cookie =
              "employeeId=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";

            document.cookie =
              "plant=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";

            document.cookie =
              "sessionId=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";
          },

          error: function (oError) {
            console.log("Logout Error Response:", oError);

            var sMsg = "Logout Failed";

            try {
              var oResponse = JSON.parse(oError.responseText);

              sMsg = oResponse.message || sMsg;
            } catch (e) {
              console.log("Error Parsing Response:", e);
            }
          },
        });
      },
      onBackToLogin: function () {
        this.getOwnerComponent().getRouter().navTo("RouteView1");
      },

      // =========================================================
      // Reset Password
      // =========================================================
      onResetPassword: function () {
        var oView = this.getView();
        var that = this;

        var sEmployeeId = this.sEmployeeId;
        var sPlant = this.sPlant;

        console.log("Employee ID for Reset:", sEmployeeId);

        console.log("Plant for Reset:", sPlant);

        // Input Fields
        var oOldPassInput = oView.byId("oldPasswordInput");

        var oNewPassInput = oView.byId("newPasswordInput");

        var oConfirmPassInput = oView.byId("confirmPasswordInput");

        // Values
        var sOldPassword = oOldPassInput.getValue().trim();

        var sNewPassword = oNewPassInput.getValue().trim();

        var sConfirmPassword = oConfirmPassInput.getValue().trim();

        var bValid = true;

        // Reset Value States
        oOldPassInput.setValueState("None");
        oNewPassInput.setValueState("None");
        oConfirmPassInput.setValueState("None");

        // =====================================================
        // Empty Field Validation
        // =====================================================
        if (!sOldPassword) {
          oOldPassInput.setValueState("Error");

          oOldPassInput.setValueStateText("Old Password is required");

          bValid = false;
        }

        // =====================================================
        // New Password — Strength Validation
        // =====================================================
        var rStrong =
          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,15}$/;

        if (!sNewPassword) {
          oNewPassInput.setValueState("Error");
          oNewPassInput.setValueStateText("New Password is required");
          bValid = false;
        } else if (!rStrong.test(sNewPassword)) {
          oNewPassInput.setValueState("Error");
          oNewPassInput.setValueStateText(
            "8–15 chars with uppercase, lowercase, number & special character",
          );
          bValid = false;
        }

        if (!sConfirmPassword) {
          oConfirmPassInput.setValueState("Error");
          oConfirmPassInput.setValueStateText("Confirm Password is required");
          bValid = false;
        }

        // =====================================================
        // Password Match Validation
        // =====================================================
        if (
          sNewPassword &&
          sConfirmPassword &&
          sNewPassword !== sConfirmPassword
        ) {
          oConfirmPassInput.setValueState("Error");
          oConfirmPassInput.setValueStateText("Passwords do not match");
          bValid = false;
        }

        // =====================================================
        // Old & New Password Same Validation
        // =====================================================
        if (sOldPassword && sNewPassword && sOldPassword === sNewPassword) {
          oNewPassInput.setValueState("Error");

          oNewPassInput.setValueStateText(
            "New Password should be different from Old Password",
          );

          bValid = false;
        }

        if (!bValid) {
          return;
        }

        sap.ui.core.BusyIndicator.show(0);
        console.log("Calling Reset Password API...");

        $.ajax({
          url: Base_url + "/api/auth/change-password",
          method: "POST",
          contentType: "application/json",

          data: JSON.stringify({
            employeeId: sEmployeeId,
            oldPassword: sOldPassword,
            newPassword: sNewPassword,
            confirmPassword: sConfirmPassword,
            plant: sPlant,
          }),

          success: function (oData) {
            sap.ui.core.BusyIndicator.hide();
            console.log("API Success Response:", oData);

            if (oData.status === "S") {
              MessageBox.success("Password reset successful. Please log in.", {
                onClose: function () {
                  // Clear Fields
                  oOldPassInput.setValue("");
                  oNewPassInput.setValue("");
                  oConfirmPassInput.setValue("");

                  // Navigate to Login
                  that.getOwnerComponent().getRouter().navTo("RouteView1");
                },
              });

              return;
            }

            MessageBox.error(oData.message || "Password reset failed");
          },

          error: function (oError) {
            sap.ui.core.BusyIndicator.hide();
            console.log("API Error Response:", oError);

            var sMsg = "Something went wrong";

            try {
              var oResponse = JSON.parse(oError.responseText);

              console.log("Parsed Error:", oResponse);

              sMsg = oResponse.message || sMsg;
            } catch (e) {
              console.log("Error Parsing Response:", e);
            }

            MessageBox.error(sMsg);
          },
        });
      },

      // =========================================================
      // Forgot Password Navigation
      // =========================================================
      onForgotPassword: function () {
        this.getOwnerComponent().getRouter().navTo("ForgotPassword");
      },
      // =========================================================
      // Live Validation — New Password
      // =========================================================
      onNewPasswordLiveChange: function (oEvent) {
        var sVal = oEvent.getParameter("value");
        var oInput = oEvent.getSource();
        var oView = this.getView();

        var rStrong2 =
          /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[^a-zA-Z0-9]).{8,15}$/;
        var bAllPass = rStrong2.test(sVal);

        // Toggle hint text colour
        var oHint = oView.byId("pwdHintText");
        if (oHint && oHint.$()[0]) {
          if (bAllPass) {
            oHint.$()[0].classList.add("pass");
          } else {
            oHint.$()[0].classList.remove("pass");
          }
        }

        if (!sVal) {
          oInput.setValueState("None");
        } else if (!bAllPass) {
          oInput.setValueState("Error");
          oInput.setValueStateText(
            "8–15 chars with uppercase, lowercase, number & special character",
          );
        } else {
          oInput.setValueState("Success");
        }

        // Re-validate confirm field live too
        var oConfirm = oView.byId("confirmPasswordInput");
        var sConfirm = oConfirm.getValue();
        if (sConfirm) {
          if (sVal === sConfirm) {
            oConfirm.setValueState("Success");
          } else {
            oConfirm.setValueState("Error");
            oConfirm.setValueStateText("Passwords do not match");
          }
        }
      },

      // =========================================================
      // Live Validation — Confirm Password
      // =========================================================
      onConfirmPasswordLiveChange: function (oEvent) {
        var sConfirm = oEvent.getParameter("value");
        var oInput = oEvent.getSource();
        var sNew = this.getView().byId("newPasswordInput").getValue();

        if (!sConfirm) {
          oInput.setValueState("None");
        } else if (sConfirm === sNew) {
          oInput.setValueState("Success");
        } else {
          oInput.setValueState("Error");
          oInput.setValueStateText("Passwords do not match");
        }
      },

      // =========================================================
      onToggleOldPassword: function () {
        var oInput = this.byId("oldPasswordInput");
        var oIcon = this.byId("oldPasswordToggleIcon");
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

      onToggleNewPassword: function () {
        var oInput = this.byId("newPasswordInput");
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
        var oInput = this.byId("confirmPasswordInput");
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
