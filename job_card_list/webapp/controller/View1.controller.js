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
    "sap/m/List",
    "sap/m/StandardListItem",
    "sap/m/SearchField",
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
    List,
    StandardListItem,
    SearchField,
  ) {
    "use strict";

    const Base_url = "http://localhost:3000";
    // const Base_url = "http://192.168.1.61:3000";
    // const Base_url = "http://192.168.0.136:3000";

    //Localhost URLs
    const Login_Url = "http://localhost:9000/index.html";
    const OperatorAssignment_Url = "http://localhost:9002/index.html";
    const PrintJobCard_Url = "http://localhost:9011/index.html";

    //Internal URLs
    // const Login_Url = "https://romsonsfiori.incresol.com/LoginApp/index.html";
    // const OperatorAssignment_Url =
    //   "https://romsonsfiori.incresol.com/CreateOperatorAssignment/index.html";
    // const PrintJobCard_Url =
    //   "https://romsonsfiori.incresol.com/DocumentCenter/index.html";

    // Production URLs
    // const Login_Url = "https://webapps.romsons.com/LoginApp/index.html";
    // const OperatorAssignment_Url =
    //   "https://webapps.romsons.com/CreateOperatorAssignment/index.html";
    // const PrintJobCard_Url =
    //   "https://webapps.romsons.com/DocumentCenter/index.html";

    const ngrokHeaders = {
      "ngrok-skip-browser-warning": "69420",
    };

    return Controller.extend("jobcardlist.controller.View1", {
      // ─────────────────────────────────────────────────────────────
      // LIFECYCLE
      // ─────────────────────────────────────────────────────────────
      onInit: function () {
        this.getView().attachAfterRendering(
          function () {
            var sImageUrl = sap.ui.require.toUrl(
              "jobcardlist/images/logoNew.svg",
            );
            this.byId("logoImage").setSrc(sImageUrl);

            // Cursor in the scan field by default, once, as soon as the
            // page has rendered (not only after the session check).
            if (!this._bInitialFocusDone) {
              this._bInitialFocusDone = true;
              this._focusScanInput();
            }
          }.bind(this),
        );

        this.getView().setModel(
          new JSONModel({
            employeeId: "",
            plant: "",
          }),
          "appModel",
        );

        this.getView().setModel(
          new JSONModel({
            jobCards: [],
          }),
          "jobCardsModel",
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
              this._loadJobCardList();
              this._focusScanInput();
            }
          }.bind(this),
          300,
        );
      },

      // ─────────────────────────────────────────────────────────────
      // DATA LOADING
      // ─────────────────────────────────────────────────────────────

      _loadJobCardList: function () {
        var oCookies = this._parseCookies();
        var sEmployeeId = oCookies["employeeId"];
        var sPlant = oCookies["plant"];
        var sSessionId = oCookies["sessionId"];

        var sUrl =
          Base_url +
          "/api/productionOrder/getJobCardList/" +
          sEmployeeId +
          "/" +
          sPlant +
          "/" +
          sSessionId;

        this.byId("dynamicPage").setBusy(true);

        $.ajax({
          url: sUrl,
          method: "GET",
          headers: ngrokHeaders,
          contentType: "application/json",
          success: function (oResponse) {
            console.log("🟢 Job Card List response:", oResponse);

            var aJobCards =
              oResponse.results || oResponse.result || oResponse || [];

            this._aAllJobCards = aJobCards;

            this.getView().setModel(
              new JSONModel({
                jobCards: aJobCards,
              }),
              "jobCardsModel",
            );
          }.bind(this),
          error: function (jqXHR, sTextStatus, sErrorThrown) {
            console.log(
              "🔴 Job Card List request failed:",
              sTextStatus,
              sErrorThrown,
            );
            MessageToast.show(
              "Could not load job card list. Please try again.",
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
       * Strips leading zeros from a document/order number for display
       * (e.g. "0000367766" -> "367766").
       */
      formatIssueNumber: function (sNumber) {
        return (sNumber || "").replace(/^0+(?=\d)/, "");
      },

      /**
       * Returns the value as-is, or "NA" if it is empty.
       */
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
       * Filters the displayed job cards by order or material as the user
       * types in the search field.
       */
      onSearchJobCard: function (oEvent) {
        this._sSearchQuery = (oEvent.getParameter("newValue") || "").trim();
        this._applyFilters();
      },

      /**
       * Reads the Order / House ID / Shift / Shift Date fields and filters
       * the displayed job cards to those matching all of them.
       */
      onApplyDateFilter: function () {
        this._sOrderFilter = this.byId("orderFilter").getValue() || "";
        this._sHouseIdFilter = this.byId("houseIdFilter").getValue() || "";
        this._sFilterShiftId = (
          this.byId("shiftFilter").getValue() || ""
        ).trim();
        this._oFilterDate = this._parseDateInput(
          this.byId("shiftDateFilter").getValue(),
        );
        this._applyFilters();
      },

      // ─────────────────────────────────────────────────────────────
      // VALUE HELPS (F4)
      // ─────────────────────────────────────────────────────────────

      /**
       * On Enter in the Order field: if the text is a pasted job card JSON
       * (same shape as the QR payload), extract Order / Shift / Shift Date
       * and apply the filters; otherwise just apply the current filters.
       */
      onOrderSubmit: function (oEvent) {
        var sValue = (oEvent.getParameter("value") || "").trim();
        if (sValue.charAt(0) === "{") {
          this._processQrScanResult(sValue);
        } else {
          this.onApplyDateFilter();
        }
      },

      /**
       * Dedicated scanner field: a hardware/QR scanner types the payload and
       * sends Enter, which fires `change`. Applies the filter from it, then
       * empties and refocuses the field for the next scan.
       */
      onScanInputChange: function (oEvent) {
        var oInput = oEvent.getSource();
        var sValue = (oEvent.getParameter("value") || "").trim();
        if (!sValue) {
          return;
        }
        this._processQrScanResult(sValue);
        oInput.setValue("");
        this._focusScanInput();
      },

      _focusScanInput: function () {
        setTimeout(
          function () {
            var oInput = this.byId("scanInput");
            if (oInput) {
              oInput.focus();
            }
          }.bind(this),
          500,
        );
      },

      onOrderValueHelp: function (oEvent) {
        this._openValueHelp(
          "orders_with_jobcards",
          "Order",
          oEvent.getSource(),
          function (sKey) {
            return this.formatIssueNumber(sKey);
          }.bind(this),
        );
      },

      onHouseValueHelp: function (oEvent) {
        this._openValueHelp("houses", "House", oEvent.getSource());
      },

      onShiftValueHelp: function (oEvent) {
        this._openValueHelp("shifts", "Shift", oEvent.getSource());
      },

      onShiftDateValueHelp: function (oEvent) {
        this._openValueHelp(
          "shift_dates_jobcards",
          "Shift Date",
          oEvent.getSource(),
          null,
          true,
        );
      },

      _f4Url: function (sHelpId) {
        var oCookies = this._parseCookies();
        return (
          Base_url +
          "/api/f4/jobcard_list/" +
          sHelpId +
          "?" +
          $.param({
            empid: oCookies["employeeId"],
            sesid: oCookies["sessionId"],
            plant: oCookies["plant"],
          })
        );
      },

      /**
       * Opens a searchable value-help dialog for the given F4 help id and
       * writes the picked key (optionally transformed) into the input.
       */
      _openValueHelp: function (
        sHelpId,
        sTitle,
        oInput,
        fnFormatKey,
        bTextOnly,
      ) {
        var oList = new List({ mode: "SingleSelectMaster" });
        var oSearch = new SearchField({
          liveChange: function (oEvt) {
            var sQ = (oEvt.getParameter("newValue") || "").toUpperCase();
            oList.getItems().forEach(function (oItem) {
              oItem.setVisible(
                (oItem.getTitle() + " " + oItem.getDescription())
                  .toUpperCase()
                  .indexOf(sQ) !== -1,
              );
            });
          },
        });
        var oDlg = new Dialog({
          title: sTitle,
          contentWidth: "28rem",
          contentHeight: "24rem",
          content: [oSearch, oList],
          endButton: new Button({
            text: "Cancel",
            press: function () {
              oDlg.close();
            },
          }),
          afterClose: function () {
            oDlg.destroy();
          },
        });

        oList.attachSelectionChange(function (oEvt) {
          var sKey = oEvt.getParameter("listItem").data("key");
          oInput.setValue(fnFormatKey ? fnFormatKey(sKey) : sKey);
          oDlg.close();
        });

        oDlg.setBusy(true);
        oDlg.open();

        $.ajax({
          url: this._f4Url(sHelpId),
          method: "GET",
          headers: ngrokHeaders,
          success: function (oResp) {
            var aRows = oResp.values || oResp.results || [];
            aRows.forEach(function (oRow) {
              var sKey = String(
                bTextOnly ? oRow.text : oRow.key !== undefined ? oRow.key : "",
              );
              var oItem = new StandardListItem({
                title: fnFormatKey ? fnFormatKey(sKey) : sKey,
                description: bTextOnly ? "" : oRow.text || "",
              });
              oItem.data("key", sKey);
              oList.addItem(oItem);
            });
          },
          error: function () {
            MessageToast.show("Could not load " + sTitle + " list.");
          },
          complete: function () {
            oDlg.setBusy(false);
          },
        });
      },

      /**
       * Parses dd.MM.yyyy, yyyy-MM-dd (optionally with time) or an OData
       * /Date(ms)/ string into a local Date; returns null if unparseable.
       */
      _parseDateInput: function (sValue) {
        var s = (sValue || "").trim();
        var a;
        if ((a = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s))) {
          return new Date(+a[3], +a[2] - 1, +a[1]);
        }
        if ((a = /^(\d{4})-(\d{2})-(\d{2})/.exec(s))) {
          return new Date(+a[1], +a[2] - 1, +a[3]);
        }
        if ((a = /\/Date\((-?\d+)\)\//.exec(s))) {
          var d = new Date(+a[1]);
          return new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
        }
        return null;
      },

      /**
       * Clears every per-field filter and the date picker, and shows all
       * job cards matching the current global search text again.
       */
      onClearDateFilter: function () {
        this.byId("orderFilter").setValue("");
        this.byId("houseIdFilter").setValue("");
        this.byId("shiftFilter").setValue("");
        this.byId("shiftDateFilter").setValue("");
        this._sOrderFilter = "";
        this._sHouseIdFilter = "";
        this._sFilterShiftId = "";
        this._oFilterDate = null;
        this._applyFilters();
      },

      /**
       * Re-applies the global search text together with the Order,
       * House ID, Shift, and Shift Date filters against the full,
       * unfiltered job card list.
       */
      _applyFilters: function () {
        var sQuery = (this._sSearchQuery || "").toUpperCase();
        var sOrderFilter = (this._sOrderFilter || "").toUpperCase();
        var sHouseIdFilter = (this._sHouseIdFilter || "").toUpperCase();
        var oFilterDate = this._oFilterDate;
        var sFilterShiftId = this._sFilterShiftId;
        var aAll = this._aAllJobCards || [];

        var aFiltered = aAll.filter(
          function (oJobCard) {
            var bMatchesQuery = !sQuery
              ? true
              : (oJobCard.order || "").toUpperCase().indexOf(sQuery) !== -1 ||
                (oJobCard.assigOper || "").toUpperCase().indexOf(sQuery) !==
                  -1 ||
                (oJobCard.shiftId || "").toUpperCase().indexOf(sQuery) !== -1 ||
                (oJobCard.houseDesc || "").toUpperCase().indexOf(sQuery) !==
                  -1 ||
                (oJobCard.houseId || "").toUpperCase().indexOf(sQuery) !== -1 ||
                (oJobCard.Charg || "").toUpperCase().indexOf(sQuery) !== -1;

            var bMatchesOrder = !sOrderFilter
              ? true
              : (oJobCard.order || "").toUpperCase().indexOf(sOrderFilter) !==
                -1;

            var bMatchesHouseId = !sHouseIdFilter
              ? true
              : (oJobCard.houseId || "")
                  .toUpperCase()
                  .indexOf(sHouseIdFilter) !== -1;

            var bMatchesDate = !oFilterDate
              ? true
              : this._isSameDay(oJobCard.shiftDt, oFilterDate);

            var bMatchesShift = !sFilterShiftId
              ? true
              : (oJobCard.shiftId || "").toUpperCase() ===
                sFilterShiftId.toUpperCase();

            return (
              bMatchesQuery &&
              bMatchesOrder &&
              bMatchesHouseId &&
              bMatchesDate &&
              bMatchesShift
            );
          }.bind(this),
        );

        var oModel = this.getView().getModel("jobCardsModel");
        oModel.setProperty("/searchQuery", this._sSearchQuery || "");
        oModel.setProperty("/jobCards", aFiltered);
        oModel.setProperty(
          "/activeFiltersText",
          this._buildActiveFiltersText(),
        );
      },

      /**
       * Builds a human-readable summary of every currently active filter
       * (global search, Order, House ID, Shift, Shift Date), for display
       * in the active-filters MessageStrip. Returns "" if none are active.
       */
      _buildActiveFiltersText: function () {
        var aParts = [];

        if (this._sSearchQuery) {
          aParts.push('Search: "' + this._sSearchQuery + '"');
        }
        if (this._sOrderFilter) {
          aParts.push('Order: "' + this._sOrderFilter + '"');
        }
        if (this._sHouseIdFilter) {
          aParts.push('House ID: "' + this._sHouseIdFilter + '"');
        }
        if (this._sFilterShiftId) {
          aParts.push('Shift: "' + this._sFilterShiftId + '"');
        }
        if (this._oFilterDate) {
          var sDay = String(this._oFilterDate.getDate()).padStart(2, "0");
          var sMonth = String(this._oFilterDate.getMonth() + 1).padStart(
            2,
            "0",
          );
          var sYear = this._oFilterDate.getFullYear();
          aParts.push(
            'Shift Date: "' + sDay + "." + sMonth + "." + sYear + '"',
          );
        }

        return aParts.length ? "Active Filters — " + aParts.join(", ") : "";
      },

      /**
       * Compares an OData Edm.DateTime value (e.g. "/Date(1700000000000)/")
       * against a JS Date, ignoring the time portion.
       */
      _isSameDay: function (vODataDate, oCompareDate) {
        if (!vODataDate || !oCompareDate) {
          return false;
        }
        var sMatch = /\/Date\((\d+)\)\//.exec(vODataDate);
        var oDate = sMatch
          ? new Date(parseInt(sMatch[1], 10))
          : new Date(vODataDate);
        if (isNaN(oDate.getTime())) {
          return false;
        }
        return (
          oDate.getUTCFullYear() === oCompareDate.getFullYear() &&
          oDate.getUTCMonth() === oCompareDate.getMonth() &&
          oDate.getUTCDate() === oCompareDate.getDate()
        );
      },

      // ─────────────────────────────────────────────────────────────
      // QR SCAN
      // ─────────────────────────────────────────────────────────────

      /**
       * Opens a popup with a live camera feed and scans for a QR code
       * using the html5-qrcode library (loaded globally in index.html).
       * Scanning stops as soon as one code is decoded.
       */
      onScanOrder: function () {
        var that = this;

        if (typeof Html5Qrcode === "undefined") {
          MessageBox.error("QR scanner library failed to load.");
          return;
        }

        var oDialog = new Dialog({
          title: "Scan Order QR Code",
          contentWidth: "26rem",
          content: [
            new HTML({
              content: "<div id='qrReaderRegion' style='width:100%;'></div>",
            }),
          ],
          endButton: new Button({
            text: "Cancel",
            type: "Reject",
            press: function () {
              oDialog.close();
            },
          }),
          afterOpen: function () {
            that._startQrScanner(oDialog);
          },
          afterClose: function () {
            that._stopQrScanner();
            oDialog.destroy();
          },
        });

        oDialog.open();
      },

      /**
       * Starts the html5-qrcode scanner in the #qrReaderRegion div. On the
       * first successful decode, stops scanning, closes the dialog, and
       * processes the result.
       */
      _startQrScanner: function (oDialog) {
        var that = this;
        var bHandled = false;

        this._oHtml5QrCode = new Html5Qrcode("qrReaderRegion");

        this._oHtml5QrCode
          .start(
            { facingMode: "environment" },
            { fps: 10, qrbox: 250 },
            function (sDecodedText) {
              if (bHandled) {
                return;
              }
              bHandled = true;
              that._stopQrScanner();
              oDialog.close();
              that._processQrScanResult(sDecodedText);
            },
            function () {
              // ignore per-frame decode failures
            },
          )
          .catch(function (oError) {
            MessageBox.error("Unable to access camera: " + oError);
          });
      },

      /**
       * Stops and tears down the html5-qrcode scanner, if running.
       */
      _stopQrScanner: function () {
        if (!this._oHtml5QrCode) {
          return;
        }
        var oScanner = this._oHtml5QrCode;
        this._oHtml5QrCode = null;
        oScanner
          .stop()
          .then(function () {
            oScanner.clear();
          })
          .catch(function () {
            // scanner may already be stopped
          });
      },

      /**
       * Validates the scanned QR payload (expected shape:
       * {"Order No":"...","Shift Date":"DD.MM.YYYY","Shift ID":"..."}) and,
       * if valid, filters the job card list to matching entries. Shows an
       * error MessageBox for any other format.
       */
      _processQrScanResult: function (sDecodedText) {
        var oData;
        try {
          oData = JSON.parse(sDecodedText);
        } catch (e) {
          oData = null;
        }

        var sOrderNo = oData && oData["Order No"];
        var sShiftDate = oData && oData["Shift Date"];
        var sShiftId = oData && oData["Shift ID"];

        var aDateParts =
          sShiftDate && /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(sShiftDate);

        if (!oData || !sOrderNo || !sShiftId || !aDateParts) {
          MessageBox.error("Invalid QR scanned.");
          return;
        }

        var oScanDate = new Date(
          parseInt(aDateParts[3], 10),
          parseInt(aDateParts[2], 10) - 1,
          parseInt(aDateParts[1], 10),
        );

        this._sOrderFilter = this.formatIssueNumber(sOrderNo);
        this._oFilterDate = oScanDate;
        this._sFilterShiftId = sShiftId;

        this.byId("orderFilter").setValue(this._sOrderFilter);
        this.byId("shiftFilter").setValue(sShiftId);
        this.byId("shiftDateFilter").setValue(sShiftDate);

        this._applyFilters();

        var oModel = this.getView().getModel("jobCardsModel");
        if (oModel.getProperty("/jobCards").length === 0) {
          MessageToast.show("No job card matches the scanned QR code.");
        }

        this.byId("scanInput").setValue("");
        this._focusScanInput();
      },

      // ─────────────────────────────────────────────────────────────
      // ACTIONS
      // ─────────────────────────────────────────────────────────────

      /**
       * Navigates to the operator assignment app for the job card the
       * button was pressed in, passing order/date/shift as query params.
       */
      onViewJobCardDetails: function (oEvent) {
        var oJobCard = oEvent
          .getSource()
          .getBindingContext("jobCardsModel")
          .getObject();

        var sDate = this._formatShiftDtParam(oJobCard.shiftDt).split("T")[0];

        var sUrl =
          OperatorAssignment_Url +
          "?order=" +
          encodeURIComponent(oJobCard.order) +
          "&date=" +
          encodeURIComponent(sDate) +
          "&shift=" +
          encodeURIComponent(oJobCard.shiftId);

        window.open(sUrl, "_blank");
      },

      /**
       * Navigates to the print job card app for the row the button was
       * pressed in, passing doctype/order/date/shift as query params.
       */
      onPrintJobCard: function (oEvent) {
        var oJobCard = oEvent
          .getSource()
          .getBindingContext("jobCardsModel")
          .getObject();

        var sDate = this._formatShiftDtParam(oJobCard.shiftDt).split("T")[0];

        var sUrl =
          PrintJobCard_Url +
          "?doctype=jobcard&order=" +
          encodeURIComponent(oJobCard.order) +
          "&date=" +
          encodeURIComponent(sDate) +
          "&shift=" +
          encodeURIComponent(oJobCard.shiftId);

        window.open(sUrl, "_blank");
      },

      /**
       * Converts an OData Edm.DateTime value (e.g. "/Date(1782950400000)/")
       * into "yyyy-MM-ddTHH:mm:ss" (UTC) for use as a URL path segment.
       */
      _formatShiftDtParam: function (vShiftDt) {
        var sMatch = /\/Date\((\d+)\)\//.exec(vShiftDt || "");
        var oDate = sMatch
          ? new Date(parseInt(sMatch[1], 10))
          : new Date(vShiftDt);
        if (isNaN(oDate.getTime())) {
          return vShiftDt;
        }
        var sYear = oDate.getUTCFullYear();
        var sMonth = String(oDate.getUTCMonth() + 1).padStart(2, "0");
        var sDay = String(oDate.getUTCDate()).padStart(2, "0");
        var sHours = String(oDate.getUTCHours()).padStart(2, "0");
        var sMinutes = String(oDate.getUTCMinutes()).padStart(2, "0");
        var sSeconds = String(oDate.getUTCSeconds()).padStart(2, "0");
        return (
          sYear +
          "-" +
          sMonth +
          "-" +
          sDay +
          "T" +
          sHours +
          ":" +
          sMinutes +
          ":" +
          sSeconds
        );
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
