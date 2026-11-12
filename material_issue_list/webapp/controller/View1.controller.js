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
    const Confirm_Receipt_Url = "http://localhost:9009/index.html";
    const Print_Issue_Slip_Url = "http://localhost:9011/index.html";

    //Internal URLs(61)
    // const Login_Url = "https://romsonsfiori.incresol.com/LoginApp/index.html";
    // const Issue_Details_Url =
    //   "https://romsonsfiori.incresol.com/IssueDetails/index.html";
    // const Confirm_Receipt_Url =
    //   "https://romsonsfiori.incresol.com/ReceiptConfirmation/index.html";
    // const Print_Issue_Slip_Url =
    //   "https://romsonsfiori.incresol.com/DocumentCenter/index.html";

    // Production URLs(136)
    // const Login_Url = "https://webapps.romsons.com/LoginApp/index.html";
    // const Issue_Details_Url =
    //   "https://webapps.romsons.com/IssueDetails/index.html";
    // const Confirm_Receipt_Url =
    //   "https://webapps.romsons.com/ReceiptConfirmation/index.html";
    // const Print_Issue_Slip_Url =
    //   "https://webapps.romsons.com/DocumentCenter/index.html";

    const ngrokHeaders = {
      "ngrok-skip-browser-warning": "69420",
    };

    return Controller.extend("materialissuelist.controller.View1", {
      // ─────────────────────────────────────────────────────────────
      // LIFECYCLE
      // ─────────────────────────────────────────────────────────────
      onInit: function () {
        this.getView().attachAfterRendering(
          function () {
            var sImageUrl = sap.ui.require.toUrl(
              "materialissuelist/images/logoNew.svg",
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
            issues: [],
            hasActiveFilters: false,
            activeFiltersText: "",
          }),
          "materialsModel",
        );

        this.getView().setModel(
          new JSONModel({
            matDoc: "",
            docYear: "",
            order: "",
            reservationNo: "",
            createdDate: "",
            issueLoc: "",
            receiveLoc: "",
            department: "",
            houseId: "",
            rcptStatus: "PENDING",
          }),
          "filterModel",
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
              this._loadIssueList();
            }
          }.bind(this),
          300,
        );
      },

      // ─────────────────────────────────────────────────────────────
      // DATA LOADING
      // ─────────────────────────────────────────────────────────────

      _loadIssueList: function () {
        var oCookies = this._parseCookies();
        var sEmployeeId = oCookies["employeeId"];
        var sPlant = oCookies["plant"];
        var sSessionId = oCookies["sessionId"];

        var sUrl =
          Base_url +
          "/api/materials/getIssueList/" +
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
            console.log("🟢 Issue List response:", oResponse);

            var aHeaders =
              oResponse.results || oResponse.result || oResponse || [];

            var aIssues = aHeaders.map(function (oHeader) {
              var aItems =
                (oHeader.npToIssueItem && oHeader.npToIssueItem.results) || [];
              aItems.sort(function (a, b) {
                return (
                  parseInt(a.materialDocItem, 10) -
                  parseInt(b.materialDocItem, 10)
                );
              });
              return {
                materialDoc: oHeader.materialDoc || "",
                materialDocYear: oHeader.materialDocYear || "",
                order: oHeader.order || "",
                reservationNumber: oHeader.reservationNumber || "",
                issueSloc: oHeader.issueSloc || "",
                receiveSloc: oHeader.receiveSloc || "",
                plant: oHeader.plant || "",
                createdBy: oHeader.createdBy || "",
                createdDate: oHeader.createdDate || "",
                createdTime: oHeader.createdTime || "",
                createdDateTime: this.formatCreatedDateTime(
                  oHeader.createdDate,
                  oHeader.createdTime,
                ),
                createdDateFormatted: this.formatCreatedDate(
                  oHeader.createdDate,
                ),
                employeeId: oHeader.employeeId || "",
                houseId: oHeader.HouseId || "",
                houseDesc: oHeader.HouseDesc || "",
                rcptStatus: oHeader.RcptStatus || "",
                department: oHeader.Department || "",
                items: aItems,
              };
            }, this);

            this._aAllIssues = aIssues;

            this.getView().setModel(
              new JSONModel({
                issues: aIssues,
                hasActiveFilters: false,
                activeFiltersText: "",
              }),
              "materialsModel",
            );

            // apply any default/active filters (e.g. Receipt Status = PENDING)
            this._applyFilters();

            setTimeout(
              function () {
                var oFirstPanel = this.getView().findAggregatedObjects(
                  true,
                  function (oControl) {
                    return (
                      oControl.isA("sap.m.Panel") &&
                      oControl.hasStyleClass("storagePanel")
                    );
                  },
                )[0];

                if (oFirstPanel) {
                  oFirstPanel.setExpanded(true);
                }
              }.bind(this),
              0,
            );
          }.bind(this),
          error: function (jqXHR, sTextStatus, sErrorThrown) {
            console.log(
              "🔴 Issue List request failed:",
              sTextStatus,
              sErrorThrown,
            );
            MessageToast.show(
              "Could not load material issues. Please try again.",
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
       * Strips leading zeros from an issue/reservation number for display
       * (e.g. "0000367766" -> "367766").
       */
      formatIssueNumber: function (sNumber) {
        return (sNumber || "").replace(/^0+(?=\d)/, "");
      },

      /**
       * Returns the value as-is, or "NA" if it is empty.
       */
      // 100000 -> 1,00,000 (Indian grouping); keeps up to 3 decimals
      formatQty: function (vValue) {
        if (vValue === null || vValue === undefined || vValue === "") {
          return "";
        }
        var fValue = parseFloat(vValue);
        if (isNaN(fValue)) {
          return String(vValue);
        }
        return fValue.toLocaleString("en-IN", { maximumFractionDigits: 3 });
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
       * Combines the created date and created time into a single
       * "DD.MM.YYYY HH:MM:SS" string, or "NA" if either part is missing.
       */
      formatCreatedDateTime: function (vCreatedDate, sCreatedTime) {
        var sDate = this.formatCreatedDate(vCreatedDate);
        var sTime = this.formatCreatedTime(sCreatedTime);
        if (sDate === "NA" || sTime === "NA") {
          return "NA";
        }
        return sDate + " " + sTime;
      },

      /**
       * Filters the displayed issues by material document, order, or
       * reservation number as the user types in the global search field.
       */
      onSearchIssue: function (oEvent) {
        this._applySearch(oEvent.getParameter("newValue") || "");
      },

      /**
       * Updates the global search query and re-applies all filters.
       */
      _applySearch: function (sRawValue) {
        var sRawQuery = (sRawValue || "").trim();
        this.getView()
          .getModel("materialsModel")
          .setProperty("/searchQuery", sRawQuery);
        this._applyFilters();
      },

      /**
       * Re-runs the Apply Filters action for the current filter bar
       * values.
       */
      onApplyFilters: function () {
        this._applyFilters();
      },

      /**
       * Clears every filter bar field (but keeps the global search box
       * as-is) and re-applies the remaining filters.
       */
      onClearFilters: function () {
        this.getView().setModel(
          new JSONModel({
            matDoc: "",
            docYear: "",
            order: "",
            reservationNo: "",
            createdDate: "",
            issueLoc: "",
            receiveLoc: "",
            department: "",
            houseId: "",
            rcptStatus: "",
          }),
          "filterModel",
        );
        this._applyFilters();
      },

      /**
       * Filters the issue list by combining the global search query with
       * the individual filter bar fields (material doc, doc year, order,
       * reservation no, created date, issue loc, receive loc). All
       * conditions must match (AND).
       */
      _applyFilters: function () {
        var aAll = this._aAllIssues || [];
        var oMaterialsModel = this.getView().getModel("materialsModel");
        var oFilters = this.getView().getModel("filterModel").getData();

        var sSearchQuery = (oMaterialsModel.getProperty("/searchQuery") || "")
          .trim()
          .toUpperCase();
        var sMatDoc = (oFilters.matDoc || "").trim().toUpperCase();
        var sDocYear = (oFilters.docYear || "").trim().toUpperCase();
        var sOrder = (oFilters.order || "").trim().toUpperCase();
        var sReservationNo = (oFilters.reservationNo || "")
          .trim()
          .toUpperCase();
        var sCreatedDate = oFilters.createdDate || "";
        var sIssueLoc = (oFilters.issueLoc || "").trim().toUpperCase();
        var sReceiveLoc = (oFilters.receiveLoc || "").trim().toUpperCase();
        var sDepartment = (oFilters.department || "").trim().toUpperCase();
        var sHouseId = (oFilters.houseId || "").trim().toUpperCase();
        var sRcptStatus = (oFilters.rcptStatus || "").trim().toUpperCase();

        var sCreatedDateFormatted = sCreatedDate
          ? this.formatCreatedDate(sCreatedDate)
          : "";

        var aFiltered = aAll.filter(function (oIssue) {
          if (
            sSearchQuery &&
            (oIssue.materialDoc || "").toUpperCase().indexOf(sSearchQuery) ===
              -1 &&
            (oIssue.order || "").toUpperCase().indexOf(sSearchQuery) === -1 &&
            (oIssue.reservationNumber || "")
              .toUpperCase()
              .indexOf(sSearchQuery) === -1
          ) {
            return false;
          }

          if (
            sMatDoc &&
            (oIssue.materialDoc || "").toUpperCase().indexOf(sMatDoc) === -1
          ) {
            return false;
          }

          if (
            sDocYear &&
            (oIssue.materialDocYear || "").toUpperCase().indexOf(sDocYear) ===
              -1
          ) {
            return false;
          }

          if (
            sOrder &&
            (oIssue.order || "").toUpperCase().indexOf(sOrder) === -1
          ) {
            return false;
          }

          if (
            sReservationNo &&
            (oIssue.reservationNumber || "")
              .toUpperCase()
              .indexOf(sReservationNo) === -1
          ) {
            return false;
          }

          if (
            sCreatedDateFormatted &&
            oIssue.createdDateFormatted !== sCreatedDateFormatted
          ) {
            return false;
          }

          if (
            sIssueLoc &&
            (oIssue.issueSloc || "").toUpperCase().indexOf(sIssueLoc) === -1
          ) {
            return false;
          }

          if (
            sReceiveLoc &&
            (oIssue.receiveSloc || "").toUpperCase().indexOf(sReceiveLoc) === -1
          ) {
            return false;
          }

          if (
            sDepartment &&
            (oIssue.department || "").toUpperCase().indexOf(sDepartment) === -1
          ) {
            return false;
          }

          if (sHouseId && (oIssue.houseId || "").toUpperCase() !== sHouseId) {
            return false;
          }

          if (
            sRcptStatus &&
            (oIssue.rcptStatus || "").toUpperCase() !== sRcptStatus
          ) {
            return false;
          }

          return true;
        });

        var aActiveFilters = [];
        if (sSearchQuery) {
          aActiveFilters.push("Search: " + sSearchQuery);
        }
        if (sMatDoc) {
          aActiveFilters.push("Material Doc: " + sMatDoc);
        }
        if (sDocYear) {
          aActiveFilters.push("Doc Year: " + sDocYear);
        }
        if (sOrder) {
          aActiveFilters.push("Order: " + sOrder);
        }
        if (sReservationNo) {
          aActiveFilters.push("Reservation No: " + sReservationNo);
        }
        if (sCreatedDateFormatted) {
          aActiveFilters.push("Created Date: " + sCreatedDateFormatted);
        }
        if (sIssueLoc) {
          aActiveFilters.push("Issue Loc: " + sIssueLoc);
        }
        if (sReceiveLoc) {
          aActiveFilters.push("Receive Loc: " + sReceiveLoc);
        }
        if (sDepartment) {
          aActiveFilters.push("Department: " + sDepartment);
        }
        if (sHouseId) {
          aActiveFilters.push("House ID: " + sHouseId);
        }
        if (sRcptStatus) {
          aActiveFilters.push("Receipt Status: " + sRcptStatus);
        }

        oMaterialsModel.setProperty(
          "/hasActiveFilters",
          aActiveFilters.length > 0,
        );
        oMaterialsModel.setProperty(
          "/activeFiltersText",
          aActiveFilters.length
            ? "Active Filters — " + aActiveFilters.join(" | ")
            : "",
        );
        oMaterialsModel.setProperty("/issues", aFiltered);
      },

      /**
       * Opens a camera scanner dialog (html5-qrcode/ZXing) so the user can
       * scan a barcode from a printed issue slip. On the first successful
       * decode, the camera is stopped, the raw result is logged, and the
       * decoded value is used to filter the issue list.
       */
      onScanIssueSlip: function () {
        var that = this;

        if (typeof Html5Qrcode === "undefined") {
          MessageBox.error(
            "Barcode scanner library failed to load. Please check your internet connection.",
          );
          return;
        }

        var sScannerDivId = "issueSlipScannerDiv";
        var oHTML = new HTML({
          content:
            "<div id='" + sScannerDivId + "' class='barcodeScannerBox'></div>",
        });

        var bScanHandled = false;
        var oScanner = null;

        var oDialog = new Dialog({
          title: "Scan Issue Slip",
          contentWidth: "28rem",
          resizable: false,
          draggable: true,
          content: [oHTML],
          endButton: new Button({
            text: "Close",
            type: "Reject",
            press: function () {
              oDialog.close();
            },
          }),
          afterOpen: function () {
            oScanner = new Html5Qrcode(sScannerDivId);
            oScanner
              .start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 150 } },
                function (sDecodedText, oDecodedResult) {
                  if (bScanHandled) {
                    return;
                  }
                  bScanHandled = true;

                  console.log(
                    "🟢 Issue slip scan result:",
                    sDecodedText,
                    oDecodedResult,
                  );

                  var sMatDocMatch = /Material Doc-(\w+)/i.exec(
                    sDecodedText || "",
                  );
                  var sDocYearMatch = /Doc Year-(\w+)/i.exec(
                    sDecodedText || "",
                  );

                  oScanner
                    .stop()
                    .catch(function () {})
                    .finally(function () {
                      oDialog.close();

                      if (!sMatDocMatch || !sDocYearMatch) {
                        MessageBox.error("Invalid QR code scanned.");
                        return;
                      }

                      var oFilterModel = that.getView().getModel("filterModel");
                      oFilterModel.setProperty("/matDoc", sMatDocMatch[1]);
                      oFilterModel.setProperty("/docYear", sDocYearMatch[1]);
                      that._applyFilters();
                    });
                },
              )
              .catch(function (oError) {
                console.log("🔴 Could not start barcode scanner:", oError);
                MessageBox.error(
                  "Could not access the camera. Please check permissions.",
                );
                oDialog.close();
              });
          },
          afterClose: function () {
            if (oScanner && !bScanHandled) {
              oScanner.stop().catch(function () {});
            }
            oDialog.destroy();
          },
        });

        oDialog.open();
      },

      /**
       * Opens the Print Issue Slip app for the material document of the
       * issue the button was pressed in.
       */
      onPrintIssueSlip: function (oEvent) {
        var oIssue = oEvent
          .getSource()
          .getBindingContext("materialsModel")
          .getObject();

        window.open(
          Print_Issue_Slip_Url +
            "?doctype=issue&materialDoc=" +
            encodeURIComponent(oIssue.materialDoc) +
            "&materialDocYear=" +
            encodeURIComponent(oIssue.materialDocYear),
          "_blank",
        );
      },

      /**
       * Shows the issue details for the panel the button was pressed in.
       */
      onShowIssueDetails: function (oEvent) {
        var oIssue = oEvent
          .getSource()
          .getBindingContext("materialsModel")
          .getObject();

        window.open(
          Issue_Details_Url +
            "?materialDoc=" +
            encodeURIComponent(oIssue.materialDoc) +
            "&materialDocYear=" +
            encodeURIComponent(oIssue.materialDocYear),
          "_blank",
        );
      },

      /**
       * Opens the Confirm Receipt app for the order of the issue the
       * button was pressed in.
       */
      // ─────────────────────────────────────────────────────────────
      // VALUE HELP (F4)
      // GET /api/f4/<appId>/<helpId>?empid=&sesid=&plant=
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
            Base_url + "/api/f4/issue_list/" + sHelpId + "?" + $.param(oParams),
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

      _openValueHelp: function (sTitle, sHelpId, sFilterProp, oExtraParams) {
        var oFilterModel = this.getView().getModel("filterModel");
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
              oFilterModel.setProperty(
                "/" + sFilterProp,
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
          this.getView().getModel("filterModel").getProperty("/docYear") || ""
        ).trim();
        this._openValueHelp(
          "Select Material Document",
          "issue_docs",
          "matDoc",
          sYear ? { year: sYear } : {},
        );
      },

      onDocYearValueHelp: function () {
        this._openValueHelp("Select Doc Year", "issue_doc_years", "docYear");
      },

      onOrderValueHelp: function () {
        this._openValueHelp("Select Order", "orders_with_issues", "order");
      },

      onReservationValueHelp: function () {
        this._openValueHelp(
          "Select Reservation",
          "reservations",
          "reservationNo",
        );
      },

      onIssueLocValueHelp: function () {
        this._openValueHelp(
          "Select Issue Location",
          "storage_locations",
          "issueLoc",
        );
      },

      onReceiveLocValueHelp: function () {
        this._openValueHelp(
          "Select Receive Location",
          "storage_locations",
          "receiveLoc",
        );
      },

      onDepartmentValueHelp: function () {
        this._openValueHelp("Select Department", "departments", "department");
      },

      onHouseValueHelp: function () {
        this._openValueHelp("Select House", "houses", "houseId");
      },

      onRcptStatusValueHelp: function () {
        this._openValueHelp(
          "Select Receipt Status",
          "issue_statuses",
          "rcptStatus",
        );
      },

      onCreateConfirm: function (oEvent) {
        var oIssue = oEvent
          .getSource()
          .getBindingContext("materialsModel")
          .getObject();

        window.open(
          Confirm_Receipt_Url +
            "?navType=matDoc" +
            "&materialDoc=" +
            encodeURIComponent(oIssue.materialDoc) +
            "&materialDocYear=" +
            encodeURIComponent(oIssue.materialDocYear),
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
