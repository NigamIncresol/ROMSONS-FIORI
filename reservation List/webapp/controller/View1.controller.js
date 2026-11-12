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

    //Localhost Urls
    const Login_Url = "http://localhost:9000/index.html";
    const Reservation_Details_Url = "http://localhost:9006/index.html";
    const Material_Issue_Url = "http://localhost:9007/index.html";
    const Requisition_Slip_Url = "http://localhost:9011/index.html";

    //Internal Urls
    // const Login_Url = "https://romsonsfiori.incresol.com/LoginApp/index.html";
    // const Reservation_Details_Url =
    //   "https://romsonsfiori.incresol.com/ReservationDetails/index.html";
    // const Material_Issue_Url =
    //   "https://romsonsfiori.incresol.com/CreateMaterialIssue/index.html";
    // const Requisition_Slip_Url =
    //   "https://romsonsfiori.incresol.com/DocumentCenter/index.html";

    // Production URLs
    // const Login_Url = "https://webapps.romsons.com/LoginApp/index.html";
    // const Reservation_Details_Url =
    //   "https://webapps.romsons.com/ReservationDetails/index.html";
    // const Material_Issue_Url =
    //   "https://webapps.romsons.com/CreateMaterialIssue/index.html";
    // const Requisition_Slip_Url =
    //   "https://webapps.romsons.com/DocumentCenter/index.html";

    const ngrokHeaders = {
      "ngrok-skip-browser-warning": "69420",
    };

    return Controller.extend("reservationlist.controller.View1", {
      // ─────────────────────────────────────────────────────────────
      // LIFECYCLE
      // ─────────────────────────────────────────────────────────────
      onInit: function () {
        this.getView().attachAfterRendering(
          function () {
            var sImageUrl = sap.ui.require.toUrl(
              "reservationlist/images/logoNew.svg",
            );
            this.byId("logoImage").setSrc(sImageUrl);
          }.bind(this),
        );

        this.getView().setModel(
          new JSONModel({
            employeeId: "",
            plant: "",
            orderId: "",
            quickSearch: "",
            filterReservationNo: "",
            filterOrder: "",
            filterCreatedDate: "",
            filterIssueLoc: "",
            filterReceivingLoc: "",
            filterDepartment: "",
            filterHouse: "",
            filterMaterial: "",
            filterStatus: "OPEN",
          }),
          "appModel",
        );

        this.getView().setModel(
          new JSONModel({
            reservations: [],
            hasActiveFilters: false,
            activeFiltersText: "",
          }),
          "materialsModel",
        );

        setTimeout(
          function () {
            var oCookies = this._parseCookies();
            this._sOrderId = this._getQueryParam("order");

            this.getView()
              .getModel("appModel")
              .setProperty("/employeeId", oCookies["employeeId"] || "");
            this.getView()
              .getModel("appModel")
              .setProperty("/plant", oCookies["plant"] || "");
            this.getView()
              .getModel("appModel")
              .setProperty("/orderId", this._sOrderId || "");

            if (this._enforceSession()) {
              this._startSessionCheck();
              this._loadMaterialIssues();
            }
          }.bind(this),
          300,
        );
      },

      // ─────────────────────────────────────────────────────────────
      // DATA LOADING
      // ─────────────────────────────────────────────────────────────

      _loadMaterialIssues: function () {
        var oCookies = this._parseCookies();
        var sEmployeeId = oCookies["employeeId"];
        var sPlant = oCookies["plant"];
        var sSessionId = oCookies["sessionId"];

        var sUrl =
          Base_url +
          "/api/materials/getReservationList/" +
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
            var aHeaders =
              oResponse.results || oResponse.result || oResponse || [];

            var aReservations = aHeaders.map(function (oHeader) {
              var aItems = (oHeader.npToItem && oHeader.npToItem.results) || [];
              aItems.sort(function (a, b) {
                return (
                  parseInt(a.reservationItemNo, 10) -
                  parseInt(b.reservationItemNo, 10)
                );
              });
              return {
                reservationNumber: oHeader.reservationNumber || "",
                plant: oHeader.plant || "",
                issueStorgaeLoc: oHeader.issueStorgaeLoc || "",
                receivingStorgaeLoc: oHeader.receivingStorgaeLoc || "",
                order: oHeader.order || "",
                createdBy: oHeader.createdBy || "",
                createdDate: oHeader.createdDate || "",
                createdTime: oHeader.createdTime || "",
                employeeId: oHeader.employeeId || "",
                department: oHeader.department || oHeader.Department || "",
                houseId: oHeader.houseId || oHeader.HouseId || "",
                houseDesc: oHeader.houseDesc || oHeader.HouseDesc || "",
                resStatus:
                  oHeader.resStatus ||
                  oHeader.ResStatus ||
                  oHeader.status ||
                  "",
                items: aItems,
              };
            }, this);

            // Open first, then Partial, then Issued (stable within a status)
            var mStatusRank = { OPEN: 0, PARTIAL: 1, ISSUED: 2 };
            var fnRank = function (oRes) {
              var iRank = mStatusRank[(oRes.resStatus || "").toUpperCase()];
              return iRank === undefined ? 3 : iRank;
            };
            aReservations = aReservations
              .map(function (oRes, iIndex) {
                return { res: oRes, index: iIndex };
              })
              .sort(function (a, b) {
                return fnRank(a.res) - fnRank(b.res) || a.index - b.index;
              })
              .map(function (o) {
                return o.res;
              });

            this._aAllReservations = aReservations;

            this.getView().setModel(
              new JSONModel({
                reservations: aReservations,
                hasActiveFilters: false,
                activeFiltersText: "",
              }),
              "materialsModel",
            );

            // Apply whatever filters are currently set (Status defaults to OPEN)
            this._applyAllFilters();

            setTimeout(
              function () {
                var aPanels = this.getView().findAggregatedObjects(
                  true,
                  function (oControl) {
                    return (
                      oControl.isA("sap.m.Panel") &&
                      oControl.hasStyleClass("storagePanel")
                    );
                  },
                );
                aPanels.forEach(function (oPanel, iIndex) {
                  oPanel.setExpanded(iIndex === 0);
                });
              }.bind(this),
              0,
            );
          }.bind(this),
          error: function () {
            MessageToast.show(
              "Could not load material reservations. Please try again.",
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
      formatOrNA: function (sValue) {
        return sValue || "NA";
      },

      /**
       * Formats a quantity with Indian digit grouping (e.g. 100000 -> 1,00,000),
       * keeping the decimals exactly as received (5.000 -> 5.000).
       */
      formatQty: function (vValue) {
        if (vValue === null || vValue === undefined || vValue === "") {
          return "";
        }
        var sValue = String(vValue).trim();
        var aMatch = /^(-?)(\d+)(\.\d+)?$/.exec(sValue);
        if (!aMatch) {
          return sValue;
        }
        var sInt = aMatch[2];
        var sLast3 = sInt.slice(-3);
        var sRest = sInt.slice(0, -3);
        if (sRest) {
          sInt = sRest.replace(/\B(?=(\d{2})+(?!\d))/g, ",") + "," + sLast3;
        }
        return aMatch[1] + sInt + (aMatch[3] || "");
      },

      formatStatusText: function (sStatus) {
        var s = (sStatus || "").toLowerCase();
        return s ? s.charAt(0).toUpperCase() + s.slice(1) : "NA";
      },

      formatStatusState: function (sStatus) {
        switch ((sStatus || "").toUpperCase()) {
          case "ISSUED":
            return "Success";
          case "PARTIAL":
            return "Warning";
          case "OPEN":
            return "Information";
          default:
            return "None";
        }
      },

      formatHouse: function (sHouseId, sHouseDesc) {
        var aParts = [sHouseId, sHouseDesc].filter(Boolean);
        return aParts.length ? aParts.join(" - ") : "NA";
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
       * Combines the created date and time into a single display value,
       * e.g. "27.07.2026 14:32:05", or "NA" if both are empty.
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
       * Filters the displayed reservations by reservation number,
       * production order number, or receiving storage location as the
       * user types in the quick search field.
       */
      onSearchReservation: function (oEvent) {
        var sRawQuery = (oEvent.getParameter("newValue") || "").trim();
        this.getView()
          .getModel("appModel")
          .setProperty("/quickSearch", sRawQuery);
        this._applyAllFilters();
      },

      /**
       * Re-applies the current filters (called when "Apply Filters" is
       * pressed).
       */
      onApplyFilters: function () {
        this._applyAllFilters();
      },

      /**
       * Clears the quick search and all column filters, then shows the
       * full reservation list again.
       */
      onClearFilters: function () {
        this.getView().getModel("appModel").setProperty("/quickSearch", "");
        this.getView()
          .getModel("appModel")
          .setProperty("/filterReservationNo", "");
        this.getView().getModel("appModel").setProperty("/filterOrder", "");
        this.getView()
          .getModel("appModel")
          .setProperty("/filterCreatedDate", "");
        this.getView().getModel("appModel").setProperty("/filterIssueLoc", "");
        this.getView()
          .getModel("appModel")
          .setProperty("/filterReceivingLoc", "");
        ["Department", "House", "Material", "Status"].forEach(function (s) {
          this.getView().getModel("appModel").setProperty("/filter" + s, "");
        }, this);

        var oSearchField = this.byId("reservationSearchField");
        if (oSearchField) {
          oSearchField.setValue("");
        }

        this._applyAllFilters();
      },

      /**
       * Converts a DatePicker's "yyyy-MM-dd" value into the "DD.MM.YYYY"
       * format used by formatCreatedDate, so the two can be compared.
       */
      _isoDateToDDMMYYYY: function (sIsoDate) {
        var sMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(sIsoDate || "");
        return sMatch ? sMatch[3] + "." + sMatch[2] + "." + sMatch[1] : "";
      },

      /**
       * Filters the displayed reservations by the quick search text
       * (matching reservation number, order, or receiving loc) combined
       * with the individual column filters (reservation no, order,
       * created date, issue loc, receiving loc), and syncs the quick
       * search field's displayed value.
       */
      _applyAllFilters: function () {
        var oAppModel = this.getView().getModel("appModel");
        var sQuickSearch = (
          oAppModel.getProperty("/quickSearch") || ""
        ).toUpperCase();
        var sFilterReservationNo = (
          oAppModel.getProperty("/filterReservationNo") || ""
        ).toUpperCase();
        var sFilterOrder = (
          oAppModel.getProperty("/filterOrder") || ""
        ).toUpperCase();
        var sFilterIssueLoc = (
          oAppModel.getProperty("/filterIssueLoc") || ""
        ).toUpperCase();
        var sFilterReceivingLoc = (
          oAppModel.getProperty("/filterReceivingLoc") || ""
        ).toUpperCase();
        var sFilterCreatedDate = this._isoDateToDDMMYYYY(
          oAppModel.getProperty("/filterCreatedDate"),
        );

        var sFilterDepartment = (
          oAppModel.getProperty("/filterDepartment") || ""
        ).toUpperCase();
        var sFilterHouse = (
          oAppModel.getProperty("/filterHouse") || ""
        ).toUpperCase();
        var sFilterMaterial = (
          oAppModel.getProperty("/filterMaterial") || ""
        ).toUpperCase();
        var sFilterStatus = (
          oAppModel.getProperty("/filterStatus") || ""
        ).toUpperCase();

        var aAll = this._aAllReservations || [];

        var aFiltered = aAll.filter(
          function (oReservation) {
            var bQuickMatch =
              !sQuickSearch ||
              oReservation.reservationNumber.indexOf(sQuickSearch) !== -1 ||
              (oReservation.order || "").toUpperCase().indexOf(sQuickSearch) !==
                -1 ||
              (oReservation.receivingStorgaeLoc || "")
                .toUpperCase()
                .indexOf(sQuickSearch) !== -1;
            if (!bQuickMatch) {
              return false;
            }

            if (
              sFilterReservationNo &&
              oReservation.reservationNumber.indexOf(sFilterReservationNo) ===
                -1
            ) {
              return false;
            }
            if (
              sFilterOrder &&
              (oReservation.order || "").toUpperCase().indexOf(sFilterOrder) ===
                -1
            ) {
              return false;
            }
            if (
              sFilterIssueLoc &&
              (oReservation.issueStorgaeLoc || "")
                .toUpperCase()
                .indexOf(sFilterIssueLoc) === -1
            ) {
              return false;
            }
            if (
              sFilterReceivingLoc &&
              (oReservation.receivingStorgaeLoc || "")
                .toUpperCase()
                .indexOf(sFilterReceivingLoc) === -1
            ) {
              return false;
            }
            if (
              sFilterCreatedDate &&
              this.formatCreatedDate(oReservation.createdDate) !==
                sFilterCreatedDate
            ) {
              return false;
            }
            if (
              sFilterDepartment &&
              (oReservation.department || "")
                .toUpperCase()
                .indexOf(sFilterDepartment) === -1
            ) {
              return false;
            }
            if (
              sFilterHouse &&
              (oReservation.houseId || "").toUpperCase().indexOf(sFilterHouse) ===
                -1 &&
              (oReservation.houseDesc || "")
                .toUpperCase()
                .indexOf(sFilterHouse) === -1
            ) {
              return false;
            }
            if (
              sFilterStatus &&
              (oReservation.resStatus || "")
                .toUpperCase()
                .indexOf(sFilterStatus) === -1
            ) {
              return false;
            }
            if (
              sFilterMaterial &&
              !(oReservation.items || []).some(function (oItem) {
                return (
                  String(oItem.material || "")
                    .toUpperCase()
                    .indexOf(sFilterMaterial) !== -1
                );
              })
            ) {
              return false;
            }

            return true;
          }.bind(this),
        );

        var sSearchQueryDisplay =
          sQuickSearch ||
          sFilterReservationNo ||
          sFilterOrder ||
          sFilterIssueLoc ||
          sFilterReceivingLoc ||
          sFilterDepartment ||
          sFilterHouse ||
          sFilterMaterial ||
          sFilterStatus ||
          sFilterCreatedDate;

        var aActiveFilters = [];
        if (sQuickSearch) {
          aActiveFilters.push("Search: " + sQuickSearch);
        }
        if (sFilterReservationNo) {
          aActiveFilters.push("Reservation No: " + sFilterReservationNo);
        }
        if (sFilterOrder) {
          aActiveFilters.push("Order: " + sFilterOrder);
        }
        if (sFilterCreatedDate) {
          aActiveFilters.push("Created Date: " + sFilterCreatedDate);
        }
        if (sFilterIssueLoc) {
          aActiveFilters.push("Issue Loc: " + sFilterIssueLoc);
        }
        if (sFilterReceivingLoc) {
          aActiveFilters.push("Receiving Loc: " + sFilterReceivingLoc);
        }
        if (sFilterDepartment) {
          aActiveFilters.push("Department: " + sFilterDepartment);
        }
        if (sFilterHouse) {
          aActiveFilters.push("House: " + sFilterHouse);
        }
        if (sFilterMaterial) {
          aActiveFilters.push("Material: " + sFilterMaterial);
        }
        if (sFilterStatus) {
          aActiveFilters.push("Status: " + sFilterStatus);
        }

        var oModel = this.getView().getModel("materialsModel");
        oModel.setProperty("/searchQuery", sSearchQueryDisplay);
        oModel.setProperty("/reservations", aFiltered);
        oModel.setProperty("/hasActiveFilters", aActiveFilters.length > 0);
        oModel.setProperty(
          "/activeFiltersText",
          "Active Filters: " + aActiveFilters.join("  |  "),
        );

        var oSearchField = this.byId("reservationSearchField");
        if (oSearchField) {
          oSearchField.setValue(oAppModel.getProperty("/quickSearch"));
        }
      },

      // ── Value help (F4): GET /api/f4/reservation_list/<helpId>?empid=&sesid=&plant= ──
      _loadF4: function (sHelpId) {
        var oCookies = this._parseCookies();
        return $.ajax({
          url:
            Base_url +
            "/api/f4/reservation_list/" +
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

      _openValueHelp: function (sTitle, sHelpId, sTargetProperty) {
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
                .getView()
                .getModel("appModel")
                .setProperty(
                  sTargetProperty,
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

      onValueHelpReservationNo: function () {
        this._openValueHelp(
          "Reservation No",
          "reservations",
          "/filterReservationNo",
        );
      },

      onValueHelpOrder: function () {
        this._openValueHelp(
          "Order",
          "orders_with_reservations",
          "/filterOrder",
        );
      },

      onValueHelpIssueLoc: function () {
        this._openValueHelp(
          "Issue Loc",
          "storage_locations",
          "/filterIssueLoc",
        );
      },

      onValueHelpReceivingLoc: function () {
        this._openValueHelp(
          "Receiving Loc",
          "storage_locations",
          "/filterReceivingLoc",
        );
      },

      onValueHelpDepartment: function () {
        this._openValueHelp("Department", "departments", "/filterDepartment");
      },

      onValueHelpHouse: function () {
        this._openValueHelp("House", "houses", "/filterHouse");
      },

      onValueHelpMaterial: function () {
        this._openValueHelp("Material", "materials", "/filterMaterial");
      },

      onValueHelpStatus: function () {
        this._openValueHelp("Status", "reservation_statuses", "/filterStatus");
      },

      /**
       * Opens a popup with a live camera feed and starts an html5-qrcode
       * scanner inside it. Decoded results are logged to the console.
       */
      onOpenScanner: function () {
        var that = this;
        var oDialog;

        oDialog = new Dialog({
          title: "Scan Barcode",
          contentWidth: "30rem",
          resizable: false,
          draggable: false,
          content: [
            new HTML({
              content:
                "<div id='barcodeScannerRegion' style='width:100%;'></div>",
            }),
          ],
          endButton: new Button({
            text: "Close",
            type: "Reject",
            press: function () {
              oDialog.close();
            },
          }),
          afterOpen: function () {
            that._startScanner(oDialog);
          },
          afterClose: function () {
            that._stopScanner();
            oDialog.destroy();
          },
        });

        oDialog.open();
      },

      /**
       * Extracts the reservation number from a scanned string in the
       * expected "Reservation No-368126" format, or "" if it doesn't
       * match that format.
       */
      _extractReservationNumber: function (sDecodedText) {
        var sMatch = /^Reservation No-(\d+)$/i.exec(
          (sDecodedText || "").trim(),
        );
        return sMatch ? sMatch[1] : "";
      },

      /**
       * Starts the html5-qrcode scanner in the #barcodeScannerRegion div.
       * On a successful scan, logs the decoded text to the console and
       * applies the scanned reservation number to the search field, or
       * shows an error if the scanned QR isn't in the expected format.
       */
      _startScanner: function (oDialog) {
        var that = this;
        this._bScanHandled = false;

        this._oHtml5QrCode = new Html5Qrcode("barcodeScannerRegion");
        this._oHtml5QrCode
          .start(
            { facingMode: "environment" },
            { fps: 10, qrbox: 250 },
            function (sDecodedText) {
              if (that._bScanHandled) {
                return;
              }

              console.log("Scanned result:", sDecodedText);

              var sReservationNumber =
                that._extractReservationNumber(sDecodedText);

              if (!sReservationNumber) {
                that._bScanHandled = true;
                MessageBox.error("Invalid QR scanned");
                oDialog.close();
                return;
              }

              that._bScanHandled = true;
              that
                .getView()
                .getModel("appModel")
                .setProperty("/filterReservationNo", sReservationNumber);
              that._applyAllFilters();
              oDialog.close();
            },
            function () {
              // ignore per-frame decode failures
            },
          )
          .catch(function (oError) {
            MessageBox.error("Could not start the camera: " + oError);
          });
      },

      /**
       * Stops and releases the html5-qrcode scanner, if running.
       */
      _stopScanner: function () {
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
       * Shows the reservation details for the panel the button was
       * pressed in.
       */
      onShowReservationDetails: function (oEvent) {
        var oReservation = oEvent
          .getSource()
          .getBindingContext("materialsModel")
          .getObject();

        window.open(
          Reservation_Details_Url +
            "?reservation=" +
            encodeURIComponent(oReservation.reservationNumber),
          "_blank",
        );
      },

      /**
       * Opens the requisition slip app in a new tab for the reservation
       * the panel button was pressed in.
       */
      onPrintReservationSlip: function (oEvent) {
        var oReservation = oEvent
          .getSource()
          .getBindingContext("materialsModel")
          .getObject();

        var sReservationNumber = this.formatReservationNumber(
          oReservation.reservationNumber,
        );

        window.open(
          Requisition_Slip_Url +
            "?doctype=requisition&reservationNumber=" +
            encodeURIComponent(sReservationNumber),
          "_blank",
        );
      },

      /**
       * Issues material for the reservation the button was pressed in.
       */
      onIssueMaterial: function (oEvent) {
        var oReservation = oEvent
          .getSource()
          .getBindingContext("materialsModel")
          .getObject();

        window.open(
          Material_Issue_Url +
            "?reservation=" +
            encodeURIComponent(oReservation.reservationNumber),
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
