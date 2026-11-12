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
    const Print_Receiving_Slip_Url = "http://localhost:9011/index.html";

    //Internal URLs(61)
    // const Login_Url = "https://romsonsfiori.incresol.com/LoginApp/index.html";
    // const Print_Receiving_Slip_Url =
    //   "https://romsonsfiori.incresol.com/DocumentCenter/index.html";

    // Production URLs(136)
    // const Login_Url = "https://webapps.romsons.com/LoginApp/index.html";
    // const Print_Receiving_Slip_Url =
    //   "https://webapps.romsons.com/DocumentCenter/index.html";

    const ngrokHeaders = {
      "ngrok-skip-browser-warning": "69420",
    };

    return Controller.extend("confirmationlist.controller.View1", {
      // ─────────────────────────────────────────────────────────────
      // LIFECYCLE
      // ─────────────────────────────────────────────────────────────
      onInit: function () {
        this.getView().attachAfterRendering(
          function () {
            var sImageUrl = sap.ui.require.toUrl(
              "confirmationlist/images/logoNew.svg",
            );
            this.byId("logoImage").setSrc(sImageUrl);
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
            confirmations: [],
          }),
          "confirmationsModel",
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
              this._loadConfirmationList();
            }
          }.bind(this),
          300,
        );
      },

      // ─────────────────────────────────────────────────────────────
      // DATA LOADING
      // ─────────────────────────────────────────────────────────────

      _loadConfirmationList: function () {
        var oCookies = this._parseCookies();
        var sEmployeeId = oCookies["employeeId"];
        var sPlant = oCookies["plant"];
        var sSessionId = oCookies["sessionId"];

        var sUrl =
          Base_url +
          "/api/materials/getConfirmationList/" +
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
            console.log("🟢 Confirmation List response:", oResponse);

            var aHeaders =
              oResponse.results || oResponse.result || oResponse || [];

            var aConfirmations = aHeaders.map(function (oHeader, iIndex) {
              var aItems = (oHeader.npToItem && oHeader.npToItem.results) || [];
              aItems.sort(function (a, b) {
                return (
                  parseInt(a.materialDocItem, 10) -
                  parseInt(b.materialDocItem, 10)
                );
              });
              return {
                issueDocument: oHeader.issueDocument || "",
                issueDocumentYear: oHeader.issueDocumentYear || "",
                order: oHeader.order || "",
                materialDoc: oHeader.materialDoc || "",
                materialDocYear: oHeader.materialDocYear || "",
                reservationNumber: oHeader.reservationNumber || "",
                issueSloc: oHeader.issueSloc || "",
                receiveSloc: oHeader.receiveSloc || "",
                department: oHeader.Department || "",
                houseId: oHeader.HouseId || "",
                houseDesc: oHeader.HouseDesc || "",
                plant: oHeader.plant || "",
                createdBy: oHeader.createdBy || "",
                createdDate: oHeader.createdDate || "",
                createdTime: oHeader.createdTime || "",
                employeeId: oHeader.employeeId || "",
                items: aItems,
                expanded: iIndex === 0,
              };
            }, this);

            this._aAllConfirmations = aConfirmations;

            this.getView().setModel(
              new JSONModel({
                confirmations: aConfirmations,
              }),
              "confirmationsModel",
            );

            this._applyUrlMaterialDocFilter();
          }.bind(this),
          error: function (jqXHR, sTextStatus, sErrorThrown) {
            console.log(
              "🔴 Confirmation List request failed:",
              sTextStatus,
              sErrorThrown,
            );
            MessageToast.show(
              "Could not load confirmation list. Please try again.",
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
       * Strips leading zeros from a document/reservation number for display
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
       * Formats a quantity with Indian digit grouping (100000 -> 1,00,000),
       * keeping any decimal digits exactly as received (e.g. "6.000").
       */
      formatQuantity: function (vQuantity) {
        if (vQuantity === null || vQuantity === undefined || vQuantity === "") {
          return "";
        }
        var aParts = String(vQuantity).trim().split(".");
        var sInt = aParts[0];
        var sSign = "";
        if (sInt.charAt(0) === "-") {
          sSign = "-";
          sInt = sInt.substring(1);
        }
        if (!/^\d+$/.test(sInt)) {
          return String(vQuantity);
        }
        var sLast3 = sInt.slice(-3);
        var sRest = sInt.slice(0, -3);
        if (sRest) {
          sRest = sRest.replace(/\B(?=(\d{2})+(?!\d))/g, ",");
          sInt = sRest + "," + sLast3;
        }
        return sSign + sInt + (aParts.length > 1 ? "." + aParts[1] : "");
      },

      formatHouse: function (sHouseId, sHouseDesc) {
        return [sHouseId, sHouseDesc].filter(Boolean).join(" - ") || "NA";
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
       * Combines the created date and created time into a single
       * "DD.MM.YYYY HH:MM:SS" display value, or "NA" if both are missing.
       */
      formatCreatedDateTime: function (vCreatedDate, sCreatedTime) {
        var sDate = this.formatCreatedDate(vCreatedDate);
        var sTime = this.formatCreatedTime(sCreatedTime);

        if (sDate === "NA" && sTime === "NA") {
          return "NA";
        }
        return sDate + " " + sTime;
      },

      /**
       * Filters the displayed confirmations by material document, order, or
       * reservation number as the user types in the search field. Typing in
       * the global search clears any active field filters, since the two
       * are mutually exclusive ways of narrowing the list.
       */
      onSearchConfirmation: function (oEvent) {
        var sRawQuery = (oEvent.getParameter("newValue") || "").trim();
        if (sRawQuery) {
          this._clearFilterFields();
        }
        this._applySearch(sRawQuery);
      },

      /**
       * Filters the confirmations model by the given raw query string,
       * shared by both the live search field and the barcode scanner.
       */
      _applySearch: function (sRawQuery) {
        var sQuery = (sRawQuery || "").toUpperCase();
        var aAll = this._aAllConfirmations || [];

        var aFiltered = sQuery
          ? aAll.filter(function (oConfirmation) {
              return (
                (oConfirmation.materialDoc || "")
                  .toUpperCase()
                  .indexOf(sQuery) !== -1 ||
                (oConfirmation.order || "").toUpperCase().indexOf(sQuery) !==
                  -1 ||
                (oConfirmation.reservationNumber || "")
                  .toUpperCase()
                  .indexOf(sQuery) !== -1
              );
            })
          : aAll;

        var oModel = this.getView().getModel("confirmationsModel");
        oModel.setProperty("/searchQuery", sRawQuery);
        oModel.setProperty("/confirmations", aFiltered);
        oModel.setProperty("/activeFiltersText", "");
      },

      // ─────────────────────────────────────────────────────────────
      // VALUE HELP (F4): GET /api/f4/receipt_list/<helpId>?empid=&sesid=&plant=
      // ─────────────────────────────────────────────────────────────

      _loadF4: function (sHelpId) {
        var oCookies = this._parseCookies();
        return $.ajax({
          url:
            Base_url +
            "/api/f4/receipt_list/" +
            sHelpId +
            "?" +
            $.param({
              empid: oCookies["employeeId"],
              sesid: oCookies["sessionId"],
              plant: oCookies["plant"],
            }),
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
              desc: [oItem.text, oItem.info].filter(Boolean).join("  |  "),
            };
          });
        });
      },

      _openValueHelp: function (sTitle, sHelpId, sInputId) {
        var that = this;
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
              that
                .byId(sInputId)
                .setValue(oItem.getBindingContext().getProperty("key"));
            }
          },
          afterClose: function () {
            oDialog.destroy();
          },
        });
        oDialog.setModel(oListModel);
        oDialog.open();
        oDialog.setBusy(true);

        this._loadF4(sHelpId)
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

      onValueHelpMaterialDoc: function () {
        this._openValueHelp(
          "Material Doc",
          "receipt_docs",
          "filterMaterialDoc",
        );
      },

      onValueHelpMaterialDocYear: function () {
        this._openValueHelp(
          "Doc Year",
          "receipt_doc_years",
          "filterMaterialDocYear",
        );
      },

      onValueHelpOrder: function () {
        this._openValueHelp("Order", "orders_with_receipts", "filterOrder");
      },

      onValueHelpReservation: function () {
        this._openValueHelp(
          "Reservation No",
          "reservations",
          "filterReservationNumber",
        );
      },

      onValueHelpReceiveSloc: function () {
        this._openValueHelp(
          "Receiving Loc",
          "storage_locations",
          "filterReceiveSloc",
        );
      },

      onValueHelpDepartment: function () {
        this._openValueHelp("Department", "departments", "filterDepartment");
      },

      onValueHelpHouse: function () {
        this._openValueHelp("House", "houses", "filterHouse");
      },

      onValueHelpIssueSloc: function () {
        this._openValueHelp("Issue Loc", "storage_locations", "filterIssueSloc");
      },

      // ─────────────────────────────────────────────────────────────
      // FIELD FILTERS
      // ─────────────────────────────────────────────────────────────

      /**
       * Applies the dedicated field filters (Material Doc, Doc Year, Order,
       * Reservation No, Created Date, Receiving Loc), combined with AND
       * logic. Using these clears/overrides the global search box, since
       * the two are mutually exclusive ways of narrowing the list.
       */
      onApplyFilters: function () {
        var oSearchField = this.byId("confirmationSearchField");
        if (oSearchField) {
          oSearchField.setValue("");
        }

        var sMaterialDoc = this.byId("filterMaterialDoc").getValue().trim();
        var sMaterialDocYear = this.byId("filterMaterialDocYear")
          .getValue()
          .trim();
        var sOrder = this.byId("filterOrder").getValue().trim();
        var sReservationNumber = this.byId("filterReservationNumber")
          .getValue()
          .trim();
        var oCreatedDate = this.byId("filterCreatedDate").getDateValue();
        var sCreatedDateText = this.byId("filterCreatedDate").getValue().trim();
        var sReceiveSloc = this.byId("filterReceiveSloc").getValue().trim();
        var sDepartment = this.byId("filterDepartment").getValue().trim();
        var sHouse = this.byId("filterHouse").getValue().trim();
        var sIssueSloc = this.byId("filterIssueSloc").getValue().trim();

        var aAll = this._aAllConfirmations || [];
        var that = this;

        var aFiltered = aAll.filter(function (oConfirmation) {
          return (
            that._fieldContains(oConfirmation.materialDoc, sMaterialDoc) &&
            that._fieldContains(
              oConfirmation.materialDocYear,
              sMaterialDocYear,
            ) &&
            that._fieldContains(oConfirmation.order, sOrder) &&
            that._fieldContains(
              oConfirmation.reservationNumber,
              sReservationNumber,
            ) &&
            that._fieldContains(oConfirmation.receiveSloc, sReceiveSloc) &&
            that._fieldContains(oConfirmation.issueSloc, sIssueSloc) &&
            that._fieldContains(oConfirmation.department, sDepartment) &&
            that._fieldContains(oConfirmation.houseId, sHouse) &&
            that._createdDateMatches(oConfirmation.createdDate, oCreatedDate)
          );
        });

        if (aFiltered.length > 0) {
          aFiltered[0].expanded = true;
        }

        var aActiveFilters = [];
        if (sMaterialDoc) {
          aActiveFilters.push("Material Doc: " + sMaterialDoc);
        }
        if (sMaterialDocYear) {
          aActiveFilters.push("Doc Year: " + sMaterialDocYear);
        }
        if (sOrder) {
          aActiveFilters.push("Order: " + sOrder);
        }
        if (sReservationNumber) {
          aActiveFilters.push("Reservation No: " + sReservationNumber);
        }
        if (sCreatedDateText) {
          aActiveFilters.push("Created Date: " + sCreatedDateText);
        }
        if (sReceiveSloc) {
          aActiveFilters.push("Receiving Loc: " + sReceiveSloc);
        }
        if (sIssueSloc) {
          aActiveFilters.push("Issue Loc: " + sIssueSloc);
        }
        if (sDepartment) {
          aActiveFilters.push("Department: " + sDepartment);
        }
        if (sHouse) {
          aActiveFilters.push("House: " + sHouse);
        }

        var sActiveFiltersText = aActiveFilters.length
          ? "Filters applied - " +
            aActiveFilters.join(" | ") +
            " (" +
            aFiltered.length +
            " result" +
            (aFiltered.length === 1 ? "" : "s") +
            ")"
          : "";

        var oModel = this.getView().getModel("confirmationsModel");
        oModel.setProperty("/searchQuery", "filtered");
        oModel.setProperty("/confirmations", aFiltered);
        oModel.setProperty("/activeFiltersText", sActiveFiltersText);
      },

      /**
       * Clears all field filters and restores the full confirmations list.
       */
      onClearFilters: function () {
        this._clearFilterFields();

        var oModel = this.getView().getModel("confirmationsModel");
        oModel.setProperty("/searchQuery", "");
        oModel.setProperty("/confirmations", this._aAllConfirmations || []);
        oModel.setProperty("/activeFiltersText", "");
      },

      _clearFilterFields: function () {
        this.byId("filterMaterialDoc").setValue("");
        this.byId("filterMaterialDocYear").setValue("");
        this.byId("filterOrder").setValue("");
        this.byId("filterReservationNumber").setValue("");
        this.byId("filterCreatedDate").setValue("");
        this.byId("filterReceiveSloc").setValue("");
        this.byId("filterIssueSloc").setValue("");
        this.byId("filterDepartment").setValue("");
        this.byId("filterHouse").setValue("");
      },

      /**
       * Case-insensitive substring match; an empty filter value always
       * matches (i.e. that field is not being filtered on).
       */
      _fieldContains: function (vFieldValue, sFilterValue) {
        if (!sFilterValue) {
          return true;
        }
        return (
          (vFieldValue || "")
            .toString()
            .toUpperCase()
            .indexOf(sFilterValue.toUpperCase()) !== -1
        );
      },

      /**
       * Compares an OData date value (e.g. "/Date(1700000000000)/") against
       * a filter Date, matching on calendar day. No filter date always
       * matches.
       */
      _createdDateMatches: function (vCreatedDate, oFilterDate) {
        if (!oFilterDate) {
          return true;
        }
        if (!vCreatedDate) {
          return false;
        }

        var sMatch = /\/Date\((\d+)\)\//.exec(vCreatedDate);
        var oDate = sMatch
          ? new Date(parseInt(sMatch[1], 10))
          : new Date(vCreatedDate);

        if (isNaN(oDate.getTime())) {
          return false;
        }

        return (
          oDate.getFullYear() === oFilterDate.getFullYear() &&
          oDate.getMonth() === oFilterDate.getMonth() &&
          oDate.getDate() === oFilterDate.getDate()
        );
      },

      /**
       * If the app URL was opened with materialDoc/materialDocYear query
       * params (e.g. "?materialDoc=4904980162&materialDocYear=2026"),
       * auto-filters the list to that exact confirmation via the Material
       * Doc/Doc Year filter fields.
       */
      _applyUrlMaterialDocFilter: function () {
        var oUrlParams = new URLSearchParams(window.location.search);
        var sMaterialDoc = oUrlParams.get("materialDoc");
        var sMaterialDocYear = oUrlParams.get("materialDocYear");

        if (!sMaterialDoc) {
          return;
        }

        this._applyMaterialDocFilterFields(sMaterialDoc, sMaterialDocYear);
      },

      /**
       * Sets the Material Doc/Doc Year filter fields, clears the global
       * search and other filter fields, expands the matched panel(s), and
       * applies the filter.
       */
      _applyMaterialDocFilterFields: function (sMaterialDoc, sMaterialDocYear) {
        var oSearchField = this.byId("confirmationSearchField");
        if (oSearchField) {
          oSearchField.setValue("");
        }

        this._clearFilterFields();
        this.byId("filterMaterialDoc").setValue(sMaterialDoc || "");
        this.byId("filterMaterialDocYear").setValue(sMaterialDocYear || "");

        this._expandExactMaterialDocMatches(sMaterialDoc);

        this.onApplyFilters();
      },

      // ─────────────────────────────────────────────────────────────
      // BARCODE SCANNER
      // ─────────────────────────────────────────────────────────────

      /**
       * Opens a camera dialog using html5-qrcode (loaded from CDN in
       * index.html) to scan a barcode off a receipt slip. On a successful
       * decode, extracts the reservation number (e.g. "Reservation No-368126"
       * -> "368126"), applies it to the search field/filter, and closes
       * the scanner.
       */
      onScanReceiptSlip: function () {
        var that = this;
        var sRegionId = "scannerRegion";

        var oDialog = new Dialog({
          title: "Scan Receiving Slip",
          contentWidth: "28rem",
          resizable: false,
          draggable: true,
          content: [
            new HTML({
              content:
                "<div id='" +
                sRegionId +
                "' style='width:100%;min-height:280px;'></div>",
            }),
          ],
          endButton: new Button({
            text: "Cancel",
            type: "Reject",
            press: function () {
              oDialog.close();
            },
          }),
          afterClose: function () {
            that._stopScanner();
            oDialog.destroy();
          },
        });

        oDialog.open();

        setTimeout(function () {
          that._startScanner(sRegionId, oDialog);
        }, 200);
      },

      _startScanner: function (sRegionId, oDialog) {
        var that = this;

        if (typeof Html5Qrcode === "undefined") {
          MessageBox.error("Barcode scanner library failed to load.");
          oDialog.close();
          return;
        }

        var oHtml5QrCode = new Html5Qrcode(sRegionId);
        this._oHtml5QrCode = oHtml5QrCode;
        this._bScanHandled = false;

        oHtml5QrCode
          .start(
            { facingMode: "environment" },
            { fps: 10, qrbox: { width: 250, height: 150 } },
            function (sDecodedText) {
              if (that._bScanHandled) {
                return;
              }
              that._bScanHandled = true;

              console.log("🟡 Scanned barcode value:", sDecodedText);
              oDialog.close();
              that._applyScannedMaterialDoc(sDecodedText);
            },
            function () {
              // Per-frame "not found" callback - ignore, keep scanning.
            },
          )
          .catch(function (oError) {
            console.log("🔴 Scanner start failed:", oError);
            MessageBox.error(
              "Could not access the camera. Please check permissions and try again.",
            );
            oDialog.close();
          });
      },

      _stopScanner: function () {
        var oHtml5QrCode = this._oHtml5QrCode;
        this._oHtml5QrCode = null;

        if (oHtml5QrCode) {
          oHtml5QrCode.stop().catch(function () {
            // Already stopped/never started - ignore.
          });
        }
      },

      /**
       * Extracts the material doc number (and doc year, if present) from a
       * decoded barcode value like "Material Doc-4904980047,Doc Year-2026"
       * and applies them via the Material Doc/Doc Year filter fields.
       */
      _applyScannedMaterialDoc: function (sDecodedText) {
        var sDocMatch = /Material\s*Doc\s*-\s*(\d+)/i.exec(sDecodedText || "");

        if (!sDocMatch) {
          MessageBox.error("Invalid QR code scanned.");
          return;
        }

        var sMaterialDoc = sDocMatch[1];
        var sYearMatch = /Doc\s*Year\s*-\s*(\d+)/i.exec(sDecodedText || "");
        var sMaterialDocYear = sYearMatch ? sYearMatch[1] : "";

        this._applyMaterialDocFilterFields(sMaterialDoc, sMaterialDocYear);
      },

      /**
       * Marks any confirmation whose materialDoc exactly matches the given
       * value as expanded, so its panel auto-expands once the model is
       * refreshed by _applySearch/_applyUrlMaterialDocFilter.
       */
      _expandExactMaterialDocMatches: function (sMaterialDoc) {
        (this._aAllConfirmations || []).forEach(function (oConfirmation) {
          if (oConfirmation.materialDoc === sMaterialDoc) {
            oConfirmation.expanded = true;
          }
        });
      },

      // ─────────────────────────────────────────────────────────────
      // ACTIONS
      // ─────────────────────────────────────────────────────────────

      /**
       * Opens the Print Receiving Slip app for the panel the button was
       * pressed in, passing the material doc/year as query params.
       */
      onPrintMaterialReceiptSlip: function (oEvent) {
        var oConfirmation = oEvent
          .getSource()
          .getBindingContext("confirmationsModel")
          .getObject();

        window.open(
          Print_Receiving_Slip_Url +
            "?doctype=receiving" +
            "&materialDoc=" +
            encodeURIComponent(oConfirmation.materialDoc) +
            "&materialDocYear=" +
            encodeURIComponent(oConfirmation.materialDocYear),
          "_blank",
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
