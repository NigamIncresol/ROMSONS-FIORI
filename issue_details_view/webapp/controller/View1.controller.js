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
    const Confirmation_Url = "http://localhost:9012/index.html";

    //Internal URLs(61)
    // const Login_Url = "https://romsonsfiori.incresol.com/LoginApp/index.html";
    // const Confirmation_Url =
    //   "https://romsonsfiori.incresol.com/ConfirmationList/index.html";

    // Production URLs(136)
    // const Login_Url = "https://webapps.romsons.com/LoginApp/index.html";
    // const Confirmation_Url =
    //   "https://webapps.romsons.com/ConfirmationList/index.html";

    const ngrokHeaders = {
      "ngrok-skip-browser-warning": "69420",
    };

    return Controller.extend("issuedetailsview.controller.View1", {
      // ─────────────────────────────────────────────────────────────
      // VALUE HELP (F4)
      // GET /api/f4/issue_detail/<helpId>?empid=&sesid=&plant=
      // ─────────────────────────────────────────────────────────────
      _loadF4: function (sHelpId, oExtraParams) {
        var oCookies = this._parseCookies();
        var oParams = Object.assign(
          {
            empid: oCookies["employeeId"],
            sesid: oCookies["sessionId"],
            plant: oCookies["plant"],
          },
          oExtraParams || {},
        );

        return $.ajax({
          url:
            Base_url +
            "/api/f4/issue_detail/" +
            sHelpId +
            "?" +
            $.param(oParams),
          method: "GET",
          headers: ngrokHeaders,
          dataType: "json",
        }).then(function (oResponse) {
          var aRaw = Array.isArray(oResponse)
            ? oResponse
            : (oResponse &&
                (oResponse.values || oResponse.results || oResponse.data)) ||
              [];
          return aRaw.map(function (oItem) {
            return {
              key: String(oItem.key),
              text: oItem.text || String(oItem.key),
              desc: [oItem.text, oItem.info].filter(Boolean).join("  |  "),
            };
          });
        });
      },

      _openValueHelp: function (sTitle, sHelpId, sSearchProp, oExtraParams) {
        var oAppModel = this.getView().getModel("appModel");
        var oListModel = new JSONModel({ items: [] });
        var oDialog = new SelectDialog({
          title: sTitle,
          items: {
            path: "/items",
            template: new StandardListItem({
              title: "{key}",
              description: "{desc}",
            }),
          },
          search: function (oEvt) {
            var sVal = oEvt.getParameter("value");
            oEvt
              .getSource()
              .getBinding("items")
              .filter(
                sVal
                  ? new Filter({
                      filters: [
                        new Filter("key", FilterOperator.Contains, sVal),
                        new Filter("desc", FilterOperator.Contains, sVal),
                      ],
                      and: false,
                    })
                  : [],
              );
          },
          confirm: function (oEvt) {
            var oItem = oEvt.getParameter("selectedItem");
            if (oItem) {
              oAppModel.setProperty(
                "/" + sSearchProp,
                oItem.getBindingContext().getProperty("key"),
              );
            }
          },
          afterClose: function () {
            oDialog.destroy();
          },
        });
        oDialog.setModel(oListModel);
        oDialog.open();
        oDialog.setBusy(true);

        this._loadF4(sHelpId, oExtraParams)
          .then(
            function (aItems) {
              oListModel.setProperty("/items", aItems);
            },
            function () {
              MessageToast.show("Failed to load value help.");
            },
          )
          .always(function () {
            oDialog.setBusy(false);
          });
      },

      onMatDocValueHelp: function () {
        var sYear = (
          this.getView()
            .getModel("appModel")
            .getProperty("/searchMaterialDocYear") || ""
        ).trim();
        this._openValueHelp(
          "Select Material Document",
          "issue_docs",
          "searchMaterialDoc",
          sYear ? { year: sYear } : {},
        );
      },

      onDocYearValueHelp: function () {
        this._openValueHelp(
          "Select Doc Year",
          "issue_doc_years",
          "searchMaterialDocYear",
        );
      },

      // ─────────────────────────────────────────────────────────────
      // LIFECYCLE
      // ─────────────────────────────────────────────────────────────
      onInit: function () {
        this.getView().attachAfterRendering(
          function () {
            var sImageUrl = sap.ui.require.toUrl(
              "issuedetailsview/images/logoNew.svg",
            );
            this.byId("logoImage").setSrc(sImageUrl);
          }.bind(this),
        );

        this.getView().setModel(
          new JSONModel({
            employeeId: "",
            plant: "",
            materialDoc: "",
            materialDocYear: "",
            searchMaterialDoc: "",
            searchMaterialDocYear: "",
            showBanner: false,
            bannerText: "",
            bannerType: "Warning",
          }),
          "appModel",
        );

        this.getView().setModel(
          new JSONModel({
            issue: null,
          }),
          "issueModel",
        );

        setTimeout(
          function () {
            var oCookies = this._parseCookies();
            this._sMaterialDoc =
              this._getQueryParam("materialDoc") ||
              this._getQueryParam("matDoc");
            this._sMaterialDocYear =
              this._getQueryParam("materialDocYear") ||
              this._getQueryParam("year");

            this.getView()
              .getModel("appModel")
              .setProperty("/employeeId", oCookies["employeeId"] || "");
            this.getView()
              .getModel("appModel")
              .setProperty("/plant", oCookies["plant"] || "");
            this.getView()
              .getModel("appModel")
              .setProperty("/materialDoc", this._sMaterialDoc || "");
            this.getView()
              .getModel("appModel")
              .setProperty("/materialDocYear", this._sMaterialDocYear || "");
            this.getView()
              .getModel("appModel")
              .setProperty("/searchMaterialDoc", this._sMaterialDoc || "");
            this.getView()
              .getModel("appModel")
              .setProperty(
                "/searchMaterialDocYear",
                this._sMaterialDocYear || "",
              );

            if (this._enforceSession()) {
              this._startSessionCheck();

              if (this._sMaterialDoc && this._sMaterialDocYear) {
                this._loadIssueDetails(
                  this._sMaterialDoc,
                  this._sMaterialDocYear,
                );
              } else {
                this.getView()
                  .getModel("appModel")
                  .setProperty("/showBanner", true);
                this.getView()
                  .getModel("appModel")
                  .setProperty(
                    "/bannerText",
                    "No material document provided. Enter a material doc number and year below to search.",
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
       * Fetches a single material issue document's details from the backend
       * and binds them to the issueModel. Shows a warning banner if the
       * document could not be found or the request failed.
       */
      _loadIssueDetails: function (sMaterialDoc, sMaterialDocYear) {
        var oAppModel = this.getView().getModel("appModel");
        var oIssueModel = this.getView().getModel("issueModel");

        var oCookies = this._parseCookies();

        var sUrl =
          Base_url +
          "/api/materials/getSingleIssueDetailsByMatDocAndYear/" +
          encodeURIComponent(oCookies["employeeId"] || "") +
          "/" +
          encodeURIComponent(oCookies["plant"] || "") +
          "/" +
          encodeURIComponent(oCookies["sessionId"] || "") +
          "/" +
          encodeURIComponent(sMaterialDoc) +
          "/" +
          encodeURIComponent(sMaterialDocYear);

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
              oIssueModel.setProperty("/issue", null);
              oAppModel.setProperty("/showBanner", true);
              oAppModel.setProperty(
                "/bannerText",
                "Material document '" +
                  sMaterialDoc +
                  "/" +
                  sMaterialDocYear +
                  "' is not available.",
              );
              oAppModel.setProperty("/bannerType", "Error");
              return;
            }

            oHeader = Array.isArray(oHeader) ? oHeader[0] : oHeader;

            var aItems =
              (oHeader.npToIssueItem && oHeader.npToIssueItem.results) || [];
            aItems.sort(function (a, b) {
              return (
                parseInt(a.materialDocItem, 10) -
                parseInt(b.materialDocItem, 10)
              );
            });

            var aReceipts =
              (oHeader.npToReceipts && oHeader.npToReceipts.results) || [];

            oIssueModel.setProperty("/issue", {
              materialDoc: oHeader.materialDoc || "",
              materialDocYear: oHeader.materialDocYear || "",
              reservationNumber: oHeader.reservationNumber || "",
              order: oHeader.order || "",
              plant: oHeader.plant || "",
              issueSloc: oHeader.issueSloc || "",
              receiveSloc: oHeader.receiveSloc || "",
              createdBy: oHeader.createdBy || "",
              createdDate: oHeader.createdDate || "",
              createdTime: oHeader.createdTime || "",
              employeeId: oHeader.employeeId || "",
              items: aItems,
              receipts: aReceipts,
            });

            oAppModel.setProperty("/showBanner", false);
            oAppModel.setProperty("/bannerText", "");
          },
          error: function () {
            oIssueModel.setProperty("/issue", null);
            oAppModel.setProperty("/showBanner", true);
            oAppModel.setProperty(
              "/bannerText",
              "Material document '" +
                sMaterialDoc +
                "/" +
                sMaterialDocYear +
                "' is not available.",
            );
            oAppModel.setProperty("/bannerType", "Error");
            MessageToast.show(
              "Could not load issue details. Please try again.",
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
      // Indian digit grouping (e.g. 100000 -> 1,00,000), keeps up to 3 decimals
      formatQty: function (vValue) {
        if (vValue === null || vValue === undefined || vValue === "") {
          return "";
        }
        var fValue = parseFloat(vValue);
        if (isNaN(fValue)) {
          return String(vValue);
        }
        return fValue.toLocaleString("en-IN", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 3,
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
       * Triggered by the header's material-doc / doc-year Inputs
       * (submit / Enter) or the "Apply" Button next to them.
       */
      onApplyIssueSearch: function () {
        var oAppModel = this.getView().getModel("appModel");
        var sMaterialDoc = (
          oAppModel.getProperty("/searchMaterialDoc") || ""
        ).trim();
        var sMaterialDocYear = (
          oAppModel.getProperty("/searchMaterialDocYear") || ""
        ).trim();

        if (!sMaterialDoc || !sMaterialDocYear) {
          MessageToast.show(
            "Please enter both a material document number and year to search.",
          );
          return;
        }

        this._sMaterialDoc = sMaterialDoc;
        this._sMaterialDocYear = sMaterialDocYear;
        oAppModel.setProperty("/materialDoc", sMaterialDoc);
        oAppModel.setProperty("/materialDocYear", sMaterialDocYear);
        this._loadIssueDetails(sMaterialDoc, sMaterialDocYear);
      },

      /**
       * Triggered by the "View Details" button on a Material Receipt
       * History row. Opens the Confirmation List View app for that
       * receipt's own material document.
       */
      onViewReceiptDetails: function (oEvent) {
        var oReceipt = oEvent
          .getSource()
          .getBindingContext("issueModel")
          .getObject();

        var sMaterialDoc = oReceipt.materialDoc || "";
        var sMaterialDocYear = oReceipt.materialDocYear || "";

        if (!sMaterialDoc || !sMaterialDocYear) {
          MessageToast.show("No material document available for this receipt.");
          return;
        }

        var sUrl =
          Confirmation_Url +
          "?materialDoc=" +
          encodeURIComponent(sMaterialDoc) +
          "&materialDocYear=" +
          encodeURIComponent(sMaterialDocYear);

        window.location.href = sUrl;
      },

      // ─────────────────────────────────────────────────────────────
      // BARCODE / QR SCANNER
      // ─────────────────────────────────────────────────────────────

      /**
       * Opens a camera scanner dialog (html5-qrcode) so the user can scan
       * an issue slip barcode/QR code instead of typing the material
       * document number and year manually.
       */
      onScanIssueSlip: function () {
        var that = this;

        if (typeof Html5Qrcode === "undefined") {
          MessageBox.error(
            "Scanner library failed to load. Please check your connection and try again.",
          );
          return;
        }

        this._bQrHandled = false;

        var sScannerDivId = "qrReaderIssueSlip";
        var oHTML = new HTML({
          content: "<div id='" + sScannerDivId + "' style='width:100%;'></div>",
        });

        var oDialog = new Dialog({
          title: "Scan Issue Slip",
          contentWidth: "360px",
          verticalScrolling: false,
          content: [oHTML],
          beginButton: new Button({
            text: "Cancel",
            press: function () {
              oDialog.close();
            },
          }),
          afterClose: function () {
            that._stopScanner();
            oDialog.destroy();
          },
        });

        this._oScannerDialog = oDialog;
        oDialog.open();

        setTimeout(function () {
          that._startScanner(sScannerDivId, oDialog);
        }, 300);
      },

      /**
       * Starts the html5-qrcode camera scan loop. Guards against handling
       * more than one successful decode (the scan loop keeps calling the
       * success callback on every frame until the camera is stopped).
       */
      _startScanner: function (sDivId, oDialog) {
        var that = this;

        this._oHtml5Qrcode = new Html5Qrcode(sDivId);

        this._oHtml5Qrcode
          .start(
            { facingMode: "environment" },
            { fps: 10, qrbox: 250 },
            function onScanSuccess(sDecodedText) {
              if (that._bQrHandled) {
                return;
              }
              that._bQrHandled = true;
              oDialog.close();
              that._handleScannedText(sDecodedText);
            },
            function onScanFailure() {
              // Ignore per-frame decode failures; this fires continuously
              // while no code is in view.
            },
          )
          .catch(function (oError) {
            MessageBox.error("Unable to access the camera: " + oError);
            oDialog.close();
          });
      },

      /**
       * Stops and releases the camera stream, if running.
       */
      _stopScanner: function () {
        var oScanner = this._oHtml5Qrcode;
        this._oHtml5Qrcode = null;

        if (oScanner) {
          oScanner
            .stop()
            .then(function () {
              oScanner.clear();
            })
            .catch(function () {});
        }
      },

      /**
       * Parses the scanned text (expected format:
       * "Material Doc-4904980045,Doc Year-2026"). On a valid match, fills
       * the search fields and triggers the search; otherwise shows an
       * "Invalid QR scanned" error.
       */
      _handleScannedText: function (sDecodedText) {
        var oMatch =
          /Material\s*Doc\s*-\s*([^,]+?)\s*,\s*Doc\s*Year\s*-\s*([^,]+)/i.exec(
            sDecodedText || "",
          );

        var sMaterialDoc = oMatch && oMatch[1] && oMatch[1].trim();
        var sMaterialDocYear = oMatch && oMatch[2] && oMatch[2].trim();

        if (!sMaterialDoc || !sMaterialDocYear) {
          MessageBox.error("Invalid QR scanned.");
          return;
        }

        var oAppModel = this.getView().getModel("appModel");
        oAppModel.setProperty("/searchMaterialDoc", sMaterialDoc);
        oAppModel.setProperty("/searchMaterialDocYear", sMaterialDocYear);
        this.onApplyIssueSearch();
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
