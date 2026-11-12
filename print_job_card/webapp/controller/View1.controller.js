sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/ui/core/Item",
    "sap/ui/core/HTML",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
  ],
  function (
    Controller,
    JSONModel,
    Dialog,
    Button,
    Item,
    HTML,
    MessageToast,
    MessageBox,
  ) {
    "use strict";

    const ngrokHeaders = {
      "ngrok-skip-browser-warning": "69420",
    };
    // const Base_url = "https://sneezing-statute-moonlight.ngrok-free.dev";
    const Base_url = "http://localhost:3000";
    // const Base_url = "http://192.168.1.61:3000";

    // const Login_Url = "http://192.168.1.61/loginapp";
    const Login_Url = "http://localhost:9000/index.html";

    return Controller.extend("printjobcard.controller.View1", {
      // ─────────────────────────────────────────────────────────────
      // LIFECYCLE
      // ─────────────────────────────────────────────────────────────
      onInit: function () {
        this.getView().attachAfterRendering(
          function () {
            var sImageUrl = sap.ui.require.toUrl(
              "printjobcard/images/romsons-Logo.png",
            );
            this.byId("logoImage").setSrc(sImageUrl);
          }.bind(this),
        );

        const oUrlParams = new URLSearchParams(window.location.search);
        const sOrderId = oUrlParams.get("order") || "";
        const sToday = new Date().toISOString().split("T")[0];

        this.getView().setModel(
          new JSONModel({
            employeeId: "",
            plant: "",
            order: sOrderId,
            orderInput: sOrderId,
            selectedDate: sToday,
            shiftEnabled: false,
            selectedShift: "",
            appliedDate: "",
            appliedShift: "",
            resultVisible: false,
            errorVisible: false,
            errorMessage: "",
            pdfUrl: "",
          }),
          "appModel",
        );

        setTimeout(
          function () {
            var oCookies = this._parseCookies();
            this.getView()
              .getModel("appModel")
              .setProperty("/employeeId", oCookies["employeeId"] || "");
            this.getView()
              .getModel("appModel")
              .setProperty("/plant", oCookies["plant"] || "");
            if (this._enforceSession()) {
              this._startSessionCheck();
              this._loadShiftList();
            }
          }.bind(this),
          300,
        );
      },

      // ─────────────────────────────────────────────────────────────
      // SHIFT LIST
      // ─────────────────────────────────────────────────────────────
      _loadShiftList: function () {
        var oCookies = this._parseCookies();
        var oSelect = this.byId("shiftSelect");
        var oModel = this.getView().getModel("appModel");

        oSelect.destroyItems();
        oModel.setProperty("/shiftEnabled", false);
        this.getView().setBusy(true);

        $.ajax({
          url:
            Base_url +
            "/api/operatorAssignment/getShiftList/" +
            encodeURIComponent(oCookies["plant"]),
          method: "GET",
          headers: ngrokHeaders,
          success: function (oResponse) {
            var aShifts = (oResponse.results || []).sort(function (a, b) {
              return a.shiftId.localeCompare(b.shiftId);
            });
            aShifts.forEach(function (oShift) {
              oSelect.addItem(
                new Item({
                  key: oShift.shiftId,
                  text: "Shift " + oShift.shiftId,
                }),
              );
            });
            if (aShifts.length === 0) {
              MessageToast.show("No shifts found for this plant.");
            } else {
              oModel.setProperty("/shiftEnabled", true);
            }
          },
          error: function (oXHR) {
            console.error(
              "getShiftList error:",
              oXHR.responseJSON || oXHR.responseText,
            );
            MessageToast.show("Failed to load shift list.");
          },
          complete: function () {
            this.getView().setBusy(false);
          }.bind(this),
        });
      },

      // ─────────────────────────────────────────────────────────────
      // PRINT JOB CARD
      // ─────────────────────────────────────────────────────────────
      onGoPrintJobCard: function () {
        var oModel = this.getView().getModel("appModel");
        var sOrder = (oModel.getProperty("/orderInput") || "").trim();
        var sDate = oModel.getProperty("/selectedDate");
        var sShift = oModel.getProperty("/selectedShift");

        if (!sOrder) {
          MessageToast.show("Please enter an Order ID.");
          return;
        }
        if (!sDate) {
          MessageToast.show("Please select a date.");
          return;
        }
        if (!sShift) {
          MessageToast.show("Please select a shift.");
          return;
        }

        oModel.setProperty("/order", sOrder);
        oModel.setProperty("/appliedDate", sDate);
        oModel.setProperty("/appliedShift", sShift);
        oModel.setProperty("/resultVisible", false);
        oModel.setProperty("/errorVisible", false);

        var sDateTime = sDate + "T00:00:00";
        var sUrl =
          Base_url +
          "/api/productionOrder/printJobCard/" +
          encodeURIComponent(sOrder) +
          "/" +
          encodeURIComponent(sShift) +
          "/" +
          encodeURIComponent(sDateTime);

        this.getView().setBusy(true);

        var that = this;
        var oXhr = new XMLHttpRequest();
        oXhr.open("GET", sUrl, true);
        oXhr.setRequestHeader("ngrok-skip-browser-warning", "69420");
        oXhr.onload = function () {
          that.getView().setBusy(false);
          var oResp;
          try {
            oResp = JSON.parse(oXhr.responseText);
          } catch (e) {
            oResp = null;
          }

          var fnShowError = function (sMsg) {
            oModel.setProperty("/errorMessage", sMsg);
            oModel.setProperty("/errorVisible", true);
          };

          if (oXhr.status === 200 && oResp && oResp.success === false) {
            var sErrMsg =
              (oResp.error &&
                oResp.error.error &&
                oResp.error.error.message &&
                oResp.error.error.message.value) ||
              oResp.message ||
              "Failed to print job card.";
            fnShowError(sErrMsg);
          } else if (oXhr.status === 200) {
            var sPdfContent =
              oResp !== null && typeof oResp === "string"
                ? oResp
                : oXhr.responseText;
            var pdfBlob = new Blob([sPdfContent], {
              type: "application/pdf",
            });
            var pdfUrl = URL.createObjectURL(pdfBlob);
            oModel.setProperty("/pdfUrl", pdfUrl);
            oModel.setProperty("/resultVisible", true);
          } else {
            var sMsg =
              (oResp &&
                oResp.error &&
                oResp.error.error &&
                oResp.error.error.message &&
                oResp.error.error.message.value) ||
              (oResp && oResp.message) ||
              "Failed to print job card.";
            fnShowError(sMsg);
          }
        };
        oXhr.onerror = function () {
          that.getView().setBusy(false);
          oModel.setProperty("/errorMessage", "Network error. Please try again.");
          oModel.setProperty("/errorVisible", true);
        };
        oXhr.send();
      },

      onOpenDocument: function () {
        var sPdfUrl = this.getView().getModel("appModel").getProperty("/pdfUrl");
        if (sPdfUrl) {
          window.open(sPdfUrl, "_blank");
        }
      },

      // ─────────────────────────────────────────────────────────────
      // FORMATTERS
      // ─────────────────────────────────────────────────────────────
      formatPdfIframe: function (sPdfUrl) {
        if (!sPdfUrl) {
          return "";
        }
        return (
          "<iframe class='jobCardPdfViewer' src='" +
          sPdfUrl.replace(/'/g, "&#39;") +
          "'></iframe>"
        );
      },

      // ─────────────────────────────────────────────────────────────
      // LOGOUT
      // ─────────────────────────────────────────────────────────────
      onLogout: function () {
        MessageBox.confirm("Are you sure you want to logout?", {
          title: "Confirm Logout",
          icon: MessageBox.Icon.WARNING,
          actions: [MessageBox.Action.YES, MessageBox.Action.NO],
          emphasizedAction: MessageBox.Action.YES,
          onClose: function (sAction) {
            if (sAction === MessageBox.Action.YES) {
              var sExpired = "; path=/; max-age=0";
              document.cookie = "employeeId=" + sExpired;
              document.cookie = "sessionId=" + sExpired;
              document.cookie = "plant=" + sExpired;
              document.cookie = "username=" + sExpired;
              window.location.href = Login_Url;
            }
          },
        });
      },

      // ─────────────────────────────────────────────────────────────
      // SESSION GUARD
      // ─────────────────────────────────────────────────────────────
      _startSessionCheck: function () {
        var that = this;

        function getCookie(name) {
          var value = "; " + document.cookie;
          var parts = value.split("; " + name + "=");
          if (parts.length === 2) {
            return decodeURIComponent(parts.pop().split(";").shift());
          }
          return "";
        }

        var sInitEmployeeId = getCookie("employeeId");
        var sInitSessionId = getCookie("sessionId");

        this._oSessionCheckTimer = setInterval(function () {
          if (that._bSessionDialogOpen) return;

          var sEmployeeId = getCookie("employeeId");
          var sSessionId = getCookie("sessionId");

          var bExpired = !sEmployeeId || !sSessionId;
          var bUserChanged = !bExpired && sEmployeeId !== sInitEmployeeId;
          var bSessionChanged =
            !bExpired && !bUserChanged && sSessionId !== sInitSessionId;
          var bMismatch = bUserChanged || bSessionChanged;

          if (bExpired || bMismatch) {
            that._bSessionDialogOpen = true;
            clearInterval(that._oSessionCheckTimer);

            if (bSessionChanged) {
              MessageBox.warning("New session detected. Refresh to continue.", {
                title: "Session Updated",
                actions: ["Refresh"],
                onClose: function () {
                  that._bSessionDialogOpen = false;
                  window.location.reload();
                },
              });
            } else {
              var sMsg = bUserChanged
                ? "Another user has logged in. Please log in again."
                : "Your session has expired. Please log in again.";

              MessageBox.warning(sMsg, {
                title: "Session Expired",
                actions: [MessageBox.Action.OK],
                onClose: function () {
                  that._bSessionDialogOpen = false;
                  window.location.href = Login_Url;
                },
              });
            }
          }
        }, 20000);
      },

      _enforceSession: function () {
        var oCookies = this._parseCookies();
        var aMissing = ["employeeId", "sessionId", "plant"].filter(
          function (k) {
            return !oCookies[k];
          },
        );
        if (aMissing.length === 0) {
          return true;
        }

        this.getView().setVisible(false);

        if (!document.getElementById("unauthCSS")) {
          var oStyle = document.createElement("style");
          oStyle.id = "unauthCSS";
          oStyle.textContent = [
            ".unauthDialog{border-radius:16px!important;overflow:hidden!important;box-shadow:0 32px 80px rgba(0,0,0,.28)!important;border:none!important;}",
            ".unauthDialog .sapMDialogFooter{display:none!important}",
            ".unauthDialog .sapMDialogScroll{padding:0!important}",
            ".unauth-body{display:flex;flex-direction:column;align-items:center;padding:48px 36px 44px;background:#ffffff;font-family:'72','72full',Arial,sans-serif;text-align:center;position:relative;overflow:hidden;}",
            ".unauth-body::before{content:'';position:absolute;top:0;left:0;right:0;height:5px;background:linear-gradient(90deg,#a50000,#e00000,#ff4d4d);}",
            ".unauth-body::after{content:'';position:absolute;top:-40px;right:-40px;width:180px;height:180px;border-radius:50%;background:radial-gradient(circle,rgba(220,0,0,.06) 0%,transparent 70%);pointer-events:none;}",
            ".unauth-icon-wrap{width:80px;height:80px;border-radius:50%;background:#fff0f0;border:2px solid rgba(187,0,0,.2);display:flex;align-items:center;justify-content:center;margin-bottom:24px;animation:unauthPulse 2.6s ease-in-out infinite;position:relative;z-index:1;}",
            ".unauth-icon{font-size:34px;color:#bb0000;line-height:1;user-select:none}",
            "@keyframes unauthPulse{0%,100%{box-shadow:0 0 0 0 rgba(187,0,0,.18)}50%{box-shadow:0 0 0 12px rgba(187,0,0,0)}}",
            ".unauth-title{font-size:22px;font-weight:700;color:#aa0000;letter-spacing:-.4px;margin-bottom:10px;line-height:1.2;}",
            ".unauth-subtitle{font-size:15px;font-weight:600;color:#333333;margin-bottom:10px;line-height:1.4;}",
            ".unauth-hint{font-size:13px;color:#777777;line-height:1.6;max-width:260px;margin-top:4px;}",
            ".unauth-divider{width:40px;height:3px;border-radius:2px;background:linear-gradient(90deg,#e00000,#ff6666);margin:20px auto 0;}",
          ].join("");
          document.head.appendChild(oStyle);
        }

        var oHTML = new HTML({
          content:
            "<div class='unauth-body'>" +
            "<div class='unauth-icon-wrap'><div class='unauth-icon'>&#128274;</div></div>" +
            "<div class='unauth-title'>Unauthorized</div>" +
            "<div class='unauth-subtitle'>Invalid Login Session</div>" +
            "<div class='unauth-hint'>Re-login to continue using the app</div>" +
            "<div class='unauth-divider'></div>" +
            "<a href='" +
            Login_Url +
            "' style='margin-top:24px;display:inline-block;padding:10px 28px;background:#e00000;color:#fff;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:.3px;'>Go to Login</a>" +
            "</div>",
        });

        var oDialog = new Dialog({
          contentWidth: "360px",
          showHeader: false,
          resizable: false,
          draggable: false,
          escapeHandler: function (oPromise) {
            oPromise.reject();
          },
          content: [oHTML],
          afterOpen: function () {
            oDialog.$().addClass("unauthDialog");
          },
        });

        oDialog.open();
        return false;
      },

      // ─────────────────────────────────────────────────────────────
      // HELPERS
      // ─────────────────────────────────────────────────────────────
      _parseCookies: function () {
        return document.cookie.split(";").reduce(function (acc, s) {
          var a = s.trim().split("=");
          if (a.length >= 2) {
            acc[decodeURIComponent(a[0])] = decodeURIComponent(
              a.slice(1).join("="),
            );
          }
          return acc;
        }, {});
      },
    });
  },
);
