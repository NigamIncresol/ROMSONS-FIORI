sap.ui.define(
  ["sap/ui/core/mvc/Controller", "sap/m/MessageToast", "sap/m/MessageBox"],
  function (Controller, MessageToast, MessageBox) {
    "use strict";

    // const Base_url = "http://192.168.0.136:3000";
    // const Base_url = "http://192.168.1.61:3000";
    const Base_url = "http://localhost:3000";

    return Controller.extend("zlogpage.controller.View1", {
      // =========================================================
      // Init
      // =========================================================
      onInit: function () {
        var sImageUrl = sap.ui.require.toUrl("zlogpage/images/logoNew.svg");
        this.byId("logoImage").setSrc(sImageUrl);
        this._initBgSlideshow();

        this.getOwnerComponent()
          .getRouter()
          .getRoute("RouteView1")
          .attachPatternMatched(function () {
            var oBg = document.getElementById("loginBgSlideshow");
            if (oBg) {
              oBg.style.display = "";
            }
          }, this);
      },

      _initBgSlideshow: function () {
        document.body.style.removeProperty("background");
        if (document.getElementById("loginBgSlideshow")) return;

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

      // =========================================================
      // Login
      // =========================================================
      onLoginPress: function () {
        var oView = this.getView();

        // Input Values
        var sUser = oView.byId("usernameInput").getValue();

        var sPass = oView.byId("passwordInput").getValue();

        var that = this;

        if (!sUser || !sPass) {
          MessageBox.error("Please enter Employee ID and Password");

          return;
        }
        sap.ui.core.BusyIndicator.show(0);

        $.ajax({
          url: Base_url + "/api/auth/login",
          method: "POST",
          contentType: "application/json",

          data: JSON.stringify({
            employeeId: sUser,
            password: sPass,
          }),

          success: function (oData) {
            sap.ui.core.BusyIndicator.hide();
            console.log("API Success Response:", oData);

            // =========================================
            // Cookie Expiry - 12 Hours
            // =========================================
            var d = new Date();

            d.setTime(d.getTime() + 12 * 60 * 60 * 1000);

            var expires = "expires=" + d.toUTCString();

            // =========================================
            // Employee ID Cookie
            // =========================================
            document.cookie =
              "employeeId=" +
              encodeURIComponent(oData.employeeId) +
              "; " +
              expires +
              "; path=/; SameSite=Lax";

            // =========================================
            // Plant Cookie
            // =========================================
            document.cookie =
              "plant=" +
              encodeURIComponent(oData.plant) +
              "; " +
              expires +
              "; path=/; SameSite=Lax";

            // =========================================
            // Session ID Cookie
            // =========================================
            document.cookie =
              "sessionId=" +
              encodeURIComponent(oData.sessionId) +
              "; " +
              expires +
              "; path=/; SameSite=Lax";

            // =========================================
            // Default Password Check
            // =========================================
            if (oData.isDefaultPassword === "X" && oData.status === "S") {
              MessageBox.warning(
                "Default password detected. redirecting to Reset Password.",
              );

              setTimeout(function () {
                that.getOwnerComponent().getRouter().navTo("Reset", {
                  employeeId: oData.employeeId,
                  plant: oData.plant,
                });
              }, 3000);

              return;
            }

            // =========================================
            // Successful Login
            // =========================================
            if (oData.status === "S" && !oData.isDefaultPassword) {
              MessageToast.show("Login Successful");

              setTimeout(function () {
                that.getOwnerComponent().getRouter().navTo("RouteView2", {
                  employeeId: oData.employeeId,
                  plant: oData.plant,
                });
              }, 2000);
            }
          },

          error: function (oError) {
            sap.ui.core.BusyIndicator.hide();
            console.log("API Error Response:", oError);

            var sMsg = "Login Failed";
            try {
              var oResponse = JSON.parse(oError.responseText);
              sMsg = oResponse.message || oResponse.Message || sMsg;
            } catch (e) {}
            MessageBox.error(sMsg);
          },
        });

        // =============================================
        // Clear Input Fields
        // =============================================
        oView.byId("usernameInput").setValue("");

        oView.byId("passwordInput").setValue("");
      },

      // =========================================================
      // Forgot Password
      // =========================================================
      onForgotPassword: function () {
        var oView = this.getView();

        var sUser = oView.byId("usernameInput").getValue();

        // Validation
        if (!sUser) {
          MessageBox.error("Please enter your Employee ID to proceed");

          return;
        }

        // Navigate
        this.getOwnerComponent().getRouter().navTo("ForgotPassword", {
          employeeId: sUser,
          plant: "default",
        });
      },
      onTogglePassword: function () {
        var oInput = this.byId("passwordInput");
        var oIcon = this.byId("passwordToggleIcon");

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
    });
  },
);
