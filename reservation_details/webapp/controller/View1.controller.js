sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/Text",
    "sap/ui/core/HTML",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/m/SelectDialog",
    "sap/m/StandardListItem",
    "sap/ui/model/Filter",
    "sap/ui/model/FilterOperator",
  ],
  function (
    Controller,
    JSONModel,
    Dialog,
    Button,
    Text,
    HTML,
    MessageToast,
    MessageBox,
    SelectDialog,
    StandardListItem,
    Filter,
    FilterOperator,
  ) {
    "use strict";

    const Base_url = "http://localhost:3000";
    // const Base_url = "http://192.168.1.61:3000";
    // const Base_url = "http://192.168.0.136:3000";

    //Localhost URLs
    const Login_Url = "http://localhost:9000/index.html";
    const Issue_Details_Url = "http://localhost:9010/index.html";
    const Confirmation_List_Url = "http://localhost:9012/index.html";

    //Internal URLs(61)
    // const Login_Url = "https://romsonsfiori.incresol.com/LoginApp/index.html";
    // const Issue_Details_Url =
    //   "https://romsonsfiori.incresol.com/IssueDetails/index.html";
    // const Confirmation_List_Url =
    //   "https://romsonsfiori.incresol.com/ConfirmationList/index.html";

    // Production URLs(136)
    // const Login_Url = "https://webapps.romsons.com/LoginApp/index.html";
    // const Issue_Details_Url =
    //   "https://webapps.romsons.com/IssueDetails/index.html";
    // const Confirmation_List_Url =
    //   "https://webapps.romsons.com/ConfirmationList/index.html";

    const ngrokHeaders = {
      "ngrok-skip-browser-warning": "69420",
    };

    return Controller.extend("reservationdetails.controller.View1", {
      // ─────────────────────────────────────────────────────────────
      // LIFECYCLE
      // ─────────────────────────────────────────────────────────────
      onInit: function () {
        this.getView().attachAfterRendering(
          function () {
            var sImageUrl = sap.ui.require.toUrl(
              "reservationdetails/images/logoNew.svg",
            );
            this.byId("logoImage").setSrc(sImageUrl);
          }.bind(this),
        );

        this.getView().setModel(
          new JSONModel({
            employeeId: "",
            plant: "",
            reservationNumber: "",
            searchValue: "",
            showBanner: false,
            bannerText: "",
            bannerType: "Warning",
          }),
          "appModel",
        );

        this.getView().setModel(
          new JSONModel({
            reservation: null,
          }),
          "materialsModel",
        );

        setTimeout(
          function () {
            var oCookies = this._parseCookies();
            this._sReservationNumber = this._getQueryParam("reservation");

            this.getView()
              .getModel("appModel")
              .setProperty("/employeeId", oCookies["employeeId"] || "");
            this.getView()
              .getModel("appModel")
              .setProperty("/plant", oCookies["plant"] || "");
            this.getView()
              .getModel("appModel")
              .setProperty(
                "/reservationNumber",
                this._sReservationNumber || "",
              );
            this.getView()
              .getModel("appModel")
              .setProperty("/searchValue", this._sReservationNumber || "");

            if (this._enforceSession()) {
              this._startSessionCheck();

              if (this._sReservationNumber) {
                this._loadReservationDetails(this._sReservationNumber);
              } else {
                this.getView()
                  .getModel("appModel")
                  .setProperty("/showBanner", true);
                this.getView()
                  .getModel("appModel")
                  .setProperty(
                    "/bannerText",
                    "No reservation number provided. Enter a reservation number below to search.",
                  );
                this.getView()
                  .getModel("appModel")
                  .setProperty("/bannerType", "Warning");
              }
            }
          }.bind(this),
          300,
        );
      },

      // ─────────────────────────────────────────────────────────────
      // DATA LOADING
      // ─────────────────────────────────────────────────────────────

      /**
       * Fetches a single reservation's details from the backend and binds
       * them to the materialsModel. Shows a warning banner if the
       * reservation could not be found or the request failed.
       */
      _loadReservationDetails: function (sReservationNumber) {
        var oAppModel = this.getView().getModel("appModel");
        var oMaterialsModel = this.getView().getModel("materialsModel");

        var oCookies = this._parseCookies();
        var sUrl =
          Base_url +
          "/api/materials/getSingleReservation/" +
          encodeURIComponent(oCookies["employeeId"] || "") +
          "/" +
          encodeURIComponent(oCookies["plant"] || "") +
          "/" +
          encodeURIComponent(oCookies["sessionId"] || "") +
          "/" +
          encodeURIComponent(sReservationNumber);

        this.byId("dynamicPage").setBusy(true);

        $.ajax({
          url: sUrl,
          method: "GET",
          headers: ngrokHeaders,
          contentType: "application/json",
          success: function (oResponse) {
            var oHeader =
              (oResponse &&
                (oResponse.result || oResponse.results || oResponse)) ||
              null;

            if (!oHeader || (Array.isArray(oHeader) && oHeader.length === 0)) {
              oMaterialsModel.setProperty("/reservation", null);
              oAppModel.setProperty("/showBanner", true);
              oAppModel.setProperty(
                "/bannerText",
                "Reservation number '" +
                  sReservationNumber +
                  "' is not available.",
              );
              oAppModel.setProperty("/bannerType", "Error");
              return;
            }

            oHeader = Array.isArray(oHeader) ? oHeader[0] : oHeader;

            var aItems = (oHeader.npToItem && oHeader.npToItem.results) || [];
            aItems.sort(function (a, b) {
              return (
                parseInt(a.reservationItemNo, 10) -
                parseInt(b.reservationItemNo, 10)
              );
            });

            var aMatIssues =
              (oHeader.npToMatIssue && oHeader.npToMatIssue.results) || [];
            var aMatReceipts =
              (oHeader.npToMatReceipts && oHeader.npToMatReceipts.results) ||
              [];

            oMaterialsModel.setProperty("/reservation", {
              reservationNumber: oHeader.reservationNumber || "",
              plant: oHeader.plant || "",
              issueStorgaeLoc: oHeader.issueStorgaeLoc || "",
              receivingStorgaeLoc: oHeader.receivingStorgaeLoc || "",
              order: oHeader.order || "",
              createdBy: oHeader.createdBy || "",
              createdDate: oHeader.createdDate || "",
              createdTime: oHeader.createdTime || "",
              employeeId: oHeader.employeeId || "",
              items: aItems,
              matIssues: aMatIssues,
              matReceipts: aMatReceipts,
            });

            oAppModel.setProperty("/showBanner", false);
            oAppModel.setProperty("/bannerText", "");
          },
          error: function () {
            oMaterialsModel.setProperty("/reservation", null);
            oAppModel.setProperty("/showBanner", true);
            oAppModel.setProperty(
              "/bannerText",
              "Reservation number '" +
                sReservationNumber +
                "' is not available.",
            );
            oAppModel.setProperty("/bannerType", "Error");
            MessageToast.show(
              "Could not load reservation details. Please try again.",
            );
          },
          complete: function () {
            this.byId("dynamicPage").setBusy(false);
          }.bind(this),
        });
      },

      // ─────────────────────────────────────────────────────────────
      // FORMATTERS
      // ─────────────────────────────────────────────────────────────

      /**
       * Strips leading zeros from a reservation number for display
       * (e.g. "0000367766" -> "367766").
       */
      formatReservationNumber: function (sReservationNumber) {
        return (sReservationNumber || "").replace(/^0+(?=\d)/, "");
      },

      /**
       * Returns the value as-is, or "NA" if it is empty.
       */
      formatQty: function (vValue) {
        if (vValue === null || vValue === undefined || vValue === "") {
          return "";
        }
        var nValue = Number(vValue);
        if (isNaN(nValue)) {
          return String(vValue);
        }
        var aParts = String(vValue).trim().split(".");
        var iDecimals = aParts[1] ? Math.min(aParts[1].length, 3) : 0;
        return nValue.toLocaleString("en-IN", {
          minimumFractionDigits: iDecimals,
          maximumFractionDigits: iDecimals,
        });
      },

      formatOrNA: function (sValue) {
        return sValue || "NA";
      },

      /**
       * Formats an OData date value (e.g. "/Date(1700000000000)/") as
       * DD.MM.YYYY, or "NA" if there is no date.
       */
      formatCreatedDate: function (vCreatedDate) {
        if (!vCreatedDate) {
          return "NA";
        }
        var sMatch = /\/Date\((\d+)\)\//.exec(vCreatedDate);
        var oDate = sMatch
          ? new Date(parseInt(sMatch[1], 10))
          : new Date(vCreatedDate);
        if (isNaN(oDate.getTime())) {
          return "NA";
        }
        var sDay = String(oDate.getDate()).padStart(2, "0");
        var sMonth = String(oDate.getMonth() + 1).padStart(2, "0");
        return sDay + "." + sMonth + "." + oDate.getFullYear();
      },

      /**
       * Formats an OData Edm.Time duration (e.g. "PT14H32M05S") as
       * HH:MM:SS, or "NA" if there is no time.
       */
      formatCreatedTime: function (sCreatedTime) {
        var sMatch = /^PT(\d+)H(\d+)M(\d+)S$/.exec(sCreatedTime || "");
        if (!sMatch) {
          return "NA";
        }
        return (
          sMatch[1].padStart(2, "0") +
          ":" +
          sMatch[2].padStart(2, "0") +
          ":" +
          sMatch[3].padStart(2, "0")
        );
      },

      /**
       * Triggered by the header's reservation-number Input (submit / Enter)
       * or the "Apply" Button next to it.
       */
      onApplyReservationSearch: function () {
        var oAppModel = this.getView().getModel("appModel");
        var sQuery = (oAppModel.getProperty("/searchValue") || "").trim();

        if (!sQuery) {
          MessageToast.show("Please enter a reservation number to search.");
          return;
        }

        this._sReservationNumber = sQuery;
        oAppModel.setProperty("/reservationNumber", sQuery);
        this._loadReservationDetails(sQuery);
      },

      /**
       * Value help for the reservation number filter.
       * GET /api/f4/reservation_detail/reservations?empid=&sesid=&plant=
       */
      onReservationValueHelp: function () {
        var that = this;
        var oCookies = this._parseCookies();
        var sUrl =
          Base_url +
          "/api/f4/reservation_detail/reservations?empid=" +
          encodeURIComponent(oCookies["employeeId"] || "") +
          "&sesid=" +
          encodeURIComponent(oCookies["sessionId"] || "") +
          "&plant=" +
          encodeURIComponent(oCookies["plant"] || "");

        sap.ui.core.BusyIndicator.show(0);
        $.ajax({
          url: sUrl,
          method: "GET",
          headers: ngrokHeaders,
          success: function (oResponse) {
            that._openValueHelpDialog(
              "Select Reservation",
              oResponse,
              /^key$/i,
              function (sValue) {
                that
                  .getView()
                  .getModel("appModel")
                  .setProperty("/searchValue", sValue);
              },
            );
          },
          error: function () {
            MessageBox.error("Could not load reservations. Please try again.");
          },
          complete: function () {
            sap.ui.core.BusyIndicator.hide();
          },
        });
      },

      _openValueHelpDialog: function (
        sTitle,
        oResponse,
        rKeyField,
        fnOnSelect,
      ) {
        var vRows =
          oResponse.values ||
          oResponse.results ||
          oResponse.result ||
          oResponse.data ||
          oResponse.response ||
          oResponse;
        if (!Array.isArray(vRows)) {
          vRows = (vRows && (vRows.results || vRows.items)) || [];
        }

        var aItems = vRows.map(function (oRow) {
          if (typeof oRow !== "object" || oRow === null) {
            return { key: String(oRow), desc: "", search: String(oRow) };
          }
          var aKeys = Object.keys(oRow).filter(function (k) {
            return k !== "__metadata";
          });
          var sKeyField =
            aKeys.find(function (k) {
              return rKeyField.test(k);
            }) || aKeys[0];
          var sDesc = aKeys
            .filter(function (k) {
              return k !== sKeyField && oRow[k] !== "" && oRow[k] != null;
            })
            .map(function (k) {
              return oRow[k];
            })
            .join(" | ");
          var sKey = String(oRow[sKeyField]);
          return { key: sKey, desc: sDesc, search: sKey + " " + sDesc };
        });

        var fnFilter = function (oEvent) {
          oEvent
            .getSource()
            .getBinding("items")
            .filter(
              new Filter(
                "search",
                FilterOperator.Contains,
                oEvent.getParameter("value"),
              ),
            );
        };

        var oDialog = new SelectDialog({
          title: sTitle,
          items: {
            path: "vh>/items",
            template: new StandardListItem({
              title: "{vh>key}",
              description: "{vh>desc}",
            }),
          },
          noDataText: "No data found",
          search: fnFilter,
          liveChange: fnFilter,
          confirm: function (oEvent) {
            var oItem = oEvent.getParameter("selectedItem");
            if (oItem) {
              fnOnSelect(oItem.getBindingContext("vh").getProperty("key"));
            }
          },
          afterClose: function () {
            oDialog.destroy();
          },
        });
        oDialog.setModel(new JSONModel({ items: aItems }), "vh");
        this.getView().addDependent(oDialog);
        oDialog.open();
      },

      /**
       * Navigates to the Issue Details app for the row the "View Details"
       * button was pressed in, passing the material document and its
       * fiscal year as query parameters.
       */
      onViewIssueDetails: function (oEvent) {
        var oIssue = oEvent
          .getSource()
          .getBindingContext("materialsModel")
          .getObject();

        var oParams = new URLSearchParams();
        oParams.set("materialDoc", oIssue.materialDoc || "");
        oParams.set("materialDocYear", oIssue.materialDocYear || "");

        window.open(
          Issue_Details_Url + "?" + oParams.toString(),
          "_blank",
          "noopener",
        );
      },

      /**
       * Navigates (in a new tab) to the Confirmation List app for the row
       * the "View Details" button was pressed in, passing the material
       * document and its fiscal year as query parameters.
       */
      onViewReceiptDetails: function (oEvent) {
        var oReceipt = oEvent
          .getSource()
          .getBindingContext("materialsModel")
          .getObject();

        var oParams = new URLSearchParams();
        oParams.set("materialDoc", oReceipt.materialDoc || "");
        oParams.set("materialDocYear", oReceipt.materialDocYear || "");

        window.open(
          Confirmation_List_Url + "?" + oParams.toString(),
          "_blank",
          "noopener",
        );
      },

      /**
       * Opens a camera-based barcode scanner dialog (html5-qrcode / ZXing)
       * and, once a code is decoded, extracts the reservation number and
       * automatically applies the reservation search.
       */
      onScanReservation: function () {
        var that = this;

        if (typeof Html5Qrcode === "undefined") {
          MessageToast.show("Scanner library not loaded. Please try again.");
          return;
        }

        var sReaderId = "reservationScanReader";

        var oDialog = new Dialog({
          title: "Scan Reservation Barcode",
          contentWidth: "360px",
          contentHeight: "360px",
          content: [
            new HTML({
              content: "<div id='" + sReaderId + "' style='width:100%;'></div>",
            }),
          ],
          endButton: new Button({
            text: "Cancel",
            press: function () {
              oDialog.close();
            },
          }),
          afterOpen: function () {
            that._startBarcodeScanner(sReaderId, oDialog);
          },
          afterClose: function () {
            that._stopBarcodeScanner();
            oDialog.destroy();
          },
        });

        oDialog.open();
      },

      /**
       * Starts the html5-qrcode scanner against the given container element
       * id, using the device's back camera when available. On a successful
       * decode, stops the scanner, closes the dialog, extracts the
       * reservation number from the scanned text (e.g.
       * "Reservation No-368126" -> "368126") and triggers the search.
       */
      _startBarcodeScanner: function (sReaderId, oDialog) {
        var that = this;

        this._bScanHandled = false;
        this._oHtml5QrCode = new Html5Qrcode(sReaderId);

        this._oHtml5QrCode
          .start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 150 } },
            function (sDecodedText) {
              // Only act on the first decoded frame; ignore any further
              // frames that arrive while the scanner is stopping/closing.
              if (that._bScanHandled) {
                return;
              }
              that._bScanHandled = true;

              var sReservationNo = that._extractReservationNumber(sDecodedText);

              if (!sReservationNo) {
                oDialog.close();
                MessageBox.error("Invalid QR scanned");
                return;
              }

              oDialog.close();

              var oAppModel = that.getView().getModel("appModel");
              oAppModel.setProperty("/searchValue", sReservationNo);
              that._sReservationNumber = sReservationNo;
              oAppModel.setProperty("/reservationNumber", sReservationNo);
              that._loadReservationDetails(sReservationNo);
            },
            function () {
              // Ignore per-frame decode failures; scanning continues.
            },
          )
          .catch(function () {
            MessageToast.show(
              "Could not access the camera. Please check permissions.",
            );
            oDialog.close();
          });
      },

      /**
       * Stops and clears the active html5-qrcode scanner instance, if any.
       */
      _stopBarcodeScanner: function () {
        if (this._oHtml5QrCode) {
          this._oHtml5QrCode
            .stop()
            .then(
              function () {
                this._oHtml5QrCode.clear();
                this._oHtml5QrCode = null;
              }.bind(this),
            )
            .catch(
              function () {
                this._oHtml5QrCode = null;
              }.bind(this),
            );
        }
      },

      /**
       * Extracts the reservation number from scanned barcode text. Only
       * accepts the expected "Reservation No-368126" format (case-insensitive,
       * flexible spacing around the dash); any other QR/barcode content is
       * treated as invalid.
       */
      _extractReservationNumber: function (sDecodedText) {
        var sMatch = /^reservation\s*no\s*-\s*(\d+)$/i.exec(
          (sDecodedText || "").trim(),
        );
        return sMatch ? sMatch[1] : "";
      },

      // ─────────────────────────────────────────────────────────────
      // SESSION GUARD
      // ─────────────────────────────────────────────────────────────

      /**
       * Checks every 20 seconds whether the session cookies still exist and
       * still belong to the same user/session that was active when this
       * check started:
       * - Missing cookies -> session expired, redirect to login.
       * - Different employeeId -> another user logged in, redirect to login.
       * - Same employeeId but different sessionId -> that user started a
       *   new session (e.g. re-logged in on another tab/device); just
       *   prompt to refresh instead of forcing a re-login.
       * Clears the interval as soon as one dialog is shown so only one
       * ever appears.
       */
      _startSessionCheck: function () {
        var that = this;

        function getCookie(sName) {
          var sValue = "; " + document.cookie;
          var aParts = sValue.split("; " + sName + "=");
          if (aParts.length === 2) {
            return decodeURIComponent(aParts.pop().split(";").shift());
          }
          return "";
        }

        // Snapshot the current user at session start
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

      /**
       * Runs once on init. Returns true if all required session cookies are
       * present. If any are missing, hides the view and shows a styled
       * "Unauthorized" dialog with a link back to the login page.
       */
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
      // ACTION HANDLERS
      // ─────────────────────────────────────────────────────────────

      /**
       * Confirms logout with the user, clears all session cookies,
       * then redirects to the login page.
       */
      onLogout: function () {
        var oDialog = new Dialog({
          title: "Confirm Logout",
          type: "Message",
          state: "Warning",
          content: new Text({ text: "Are you sure you want to logout?" }),
          beginButton: new Button({
            text: "Yes",
            type: "Emphasized",
            press: function () {
              oDialog.close();
              var sExpired = "; path=/; max-age=0";
              document.cookie = "employeeId=" + sExpired;
              document.cookie = "sessionId=" + sExpired;
              document.cookie = "plant=" + sExpired;
              document.cookie = "username=" + sExpired;
              clearInterval(this._oSessionCheckTimer);
              window.location.href = Login_Url;
            }.bind(this),
          }),
          endButton: new Button({
            text: "No",
            type: "Default",
            press: function () {
              oDialog.close();
            },
          }),
          afterClose: function () {
            oDialog.destroy();
          },
        });
        oDialog.open();
      },

      // ─────────────────────────────────────────────────────────────
      // HELPERS
      // ─────────────────────────────────────────────────────────────

      /**
       * Returns the value of a URL query parameter by name, or "" if absent.
       */
      _getQueryParam: function (sName) {
        var sSearch =
          window.location.search || window.location.hash.split("?")[1] || "";
        var oParams = new URLSearchParams(sSearch);
        return oParams.get(sName) || "";
      },

      /**
       * Parses document.cookie into a plain key/value object.
       * Handles URL-encoded keys and values, and '=' characters inside values.
       */
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
