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
    "sap/m/Input",
    "sap/m/DateRangeSelection",
    "sap/ui/core/format/DateFormat",
    "sap/m/Label",
    "sap/m/List",
    "sap/m/StandardListItem",
    "sap/m/SearchField",
    "sap/m/VBox",
    "sap/m/Column",
    "sap/m/ColumnListItem",
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
    Input,
    DateRangeSelection,
    DateFormat,
    Label,
    List,
    StandardListItem,
    SearchField,
    VBox,
    Column,
    ColumnListItem,
  ) {
    "use strict";

    const Base_url = "http://localhost:3000";
    // const Base_url = "http://192.168.1.61:3000";
    // const Base_url = "http://192.168.0.136:3000";

    //Localhost Urls
    const Login_Url = "http://localhost:9000/index.html";

    //Internal Urls
    // const Login_Url = "https://romsonsfiori.incresol.com/LoginApp/index.html";

    // Production URLs
    // const Login_Url = "https://webapps.romsons.com/LoginApp/index.html";

    // Selection criteria shown in the start-up popup
    const F4_FIELDS = [
      { key: "plant", label: "Plant", path: "plants", required: true },
      { key: "dateRange", label: "Shift Date Range", dateRange: true },
      {
        key: "order",
        label: "Order",
        path: "orders_with_confirmations",
        required: true,
        paged: true,
      },
      { key: "house", label: "House ID", path: "houses" },
    ];

    const PAGE_SIZE = 50;

    // Result table columns (UserEmpid and Sesid are intentionally not shown)
    const COLUMNS = [
      { key: "Werks", label: "Plant", width: "5rem" },
      { key: "HouseId", label: "House ID", width: "5rem" },
      { key: "HouseDesc", label: "House", width: "10rem" },
      { key: "Aufnr", label: "Order", width: "8rem" },
      { key: "Charg", label: "Batch", width: "8rem" },
      { key: "ShiftDate", label: "Shift Date", width: "7rem" },
      { key: "ShiftId", label: "Shift", width: "4rem" },
      { key: "Empid", label: "Employee ID", width: "8rem" },
      { key: "Matnr", label: "Material", width: "8rem" },
      { key: "Maktx", label: "Material Description", width: "14rem" },
      { key: "Vornr", label: "Operation", width: "5rem" },
      { key: "Ltxa1", label: "Operation Description", width: "13rem" },
      { key: "Meins", label: "UoM", width: "4rem" },
      { key: "TargetQty", label: "Target Qty", width: "6rem" },
      { key: "AchievedQty", label: "Achieved Qty", width: "6rem" },
      { key: "Efficiency", label: "Efficiency %", width: "6rem" },
      { key: "ReworkQty", label: "Rework Qty", width: "6rem" },
      { key: "SampleQty", label: "Sample Qty", width: "6rem" },
      { key: "YieldQty", label: "Yield Qty", width: "6rem" },
    ];

    const ngrokHeaders = {
      "ngrok-skip-browser-warning": "69420",
    };

    return Controller.extend("operatorperformancereport.controller.View1", {
      // ─────────────────────────────────────────────────────────────
      // LIFECYCLE
      // ─────────────────────────────────────────────────────────────
      onInit: function () {
        this.getView().attachAfterRendering(
          function () {
            var sImageUrl = sap.ui.require.toUrl(
              "operatorperformancereport/images/logoNew.svg",
            );
            this.byId("logoImage").setSrc(sImageUrl);
          }.bind(this),
        );

        this.getView().setModel(
          new JSONModel({
            employeeId: "",
            plant: "",
            quickSearch: "",
            filterMaterial: "",
            filterLoc: "",
          }),
          "appModel",
        );

        this.getView().setModel(
          new JSONModel({
            items: [],
            hasResults: false,
            hasMore: false,
            hasActiveFilters: false,
            activeFiltersText: "",
          }),
          "perfModel",
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
              this._openCriteriaDialog();
            }
          }.bind(this),
          300,
        );
      },

      // ─────────────────────────────────────────────────────────────
      // DATA LOADING
      // ─────────────────────────────────────────────────────────────

      /** Loads the first page for the criteria chosen in the popup. */
      _loadReport: function () {
        var oC = this._oCriteria || {};
        var aApplied = F4_FIELDS.filter(function (o) {
          return o.dateRange ? oC.fromDate : (oC[o.key] || "").trim();
        }).map(function (o) {
          return o.dateRange
            ? o.label + ": " + oC.fromDate + " to " + (oC.toDate || oC.fromDate)
            : o.label + ": " + oC[o.key].trim();
        });
        this.getView()
          .getModel("perfModel")
          .setProperty(
            "/appliedCriteria",
            "Applied Filters: " + aApplied.join("  |  "),
          );
        this._aAllItems = [];
        this._iSkip = 0;
        this._fetchPage();
      },

      onLoadMore: function () {
        this._fetchPage();
      },

      _fetchPage: function () {
        var oC = this._oCriteria || {};
        var oCookies = this._parseCookies();
        var oParams = {
          plant: oC.plant,
          fromDate: this._toIso(oC.fromDate),
          toDate: this._toIso(oC.toDate),
          order: oC.order,
          houseId: oC.house,
          employeeId: oCookies["employeeId"],
          sessionId: oCookies["sessionId"],
          top: PAGE_SIZE,
          skip: this._iSkip,
        };
        Object.keys(oParams).forEach(function (k) {
          if (oParams[k] === undefined || oParams[k] === "") {
            delete oParams[k];
          }
        });

        this.byId("dynamicPage").setBusy(true);

        $.ajax({
          url: Base_url + "/api/report/operatorperformance?" + $.param(oParams),
          method: "GET",
          headers: ngrokHeaders,
          success: function (oResponse) {
            var aRows = Array.isArray(oResponse)
              ? oResponse
              : oResponse.values ||
                oResponse.results ||
                oResponse.result ||
                oResponse.data ||
                [];
            this._aAllItems = this._aAllItems.concat(
              aRows.map(this._formatRow),
            );
            this._iSkip += aRows.length;
            var bMore =
              oResponse.has_more !== undefined
                ? !!oResponse.has_more
                : aRows.length === PAGE_SIZE;
            this.getView().getModel("perfModel").setProperty("/hasMore", bMore);
            this.getView()
              .getModel("perfModel")
              .setProperty("/hasResults", true);
            this._buildTable();
            this._applyAllFilters();
          }.bind(this),
          error: function () {
            MessageToast.show(
              "Could not load operator performance report. Please try again.",
            );
          },
          complete: function () {
            this.byId("dynamicPage").setBusy(false);
          }.bind(this),
        });
      },

      /** Builds the table columns from the fixed COLUMNS definition. */
      _buildTable: function () {
        var oTable = this.byId("perfTable");
        if (!oTable || oTable.getColumns().length) {
          return;
        }
        var oTemplate = new ColumnListItem();
        COLUMNS.forEach(function (oCol) {
          oTable.addColumn(
            new Column({
              width: oCol.width || "7rem",
              header: new Text({ text: oCol.label, wrapping: true }),
            }),
          );
          oTemplate.addCell(
            new Text({ text: "{perfModel>" + oCol.key + "}", wrapping: true }),
          );
        });
        oTable.setWidth(
          COLUMNS.reduce(function (n, c) {
            return n + parseFloat(c.width || "7");
          }, 0) + "rem",
        );
        oTable.bindItems({ path: "perfModel>/items", template: oTemplate });
      },

      /** Exports the rows currently shown in the table to an Excel file. */
      onExport: function () {
        var aRows =
          this.getView().getModel("perfModel").getProperty("/items") || [];
        if (!aRows.length) {
          MessageToast.show("No data to export.");
          return;
        }
        var oNum =
          /^(TargetQty|AchievedQty|Efficiency|ReworkQty|SampleQty|YieldQty)$/;
        var aCols = COLUMNS.map(function (o) {
          return {
            label: o.label,
            property: o.key,
            type: oNum.test(o.key) ? "Number" : "String",
            scale: oNum.test(o.key) ? 2 : undefined,
          };
        });
        sap.ui.require(["sap/ui/export/Spreadsheet"], function (Spreadsheet) {
          new Spreadsheet({
            workbook: {
              columns: aCols,
              context: { sheetName: "Operator Performance" },
            },
            dataSource: aRows,
            fileName: "Operator_Performance_Report.xlsx",
          })
            .build()
            .finally(function () {
              MessageToast.show("Excel export complete.");
            });
        });
      },

      /** Converts OData /Date(ms)/ values to DD.MM.YYYY. */
      _formatRow: function (oRow) {
        var m = /\/Date\((-?\d+)\)\//.exec(oRow.ShiftDate || "");
        if (m) {
          var d = new Date(parseInt(m[1], 10));
          var p = function (n) {
            return ("0" + n).slice(-2);
          };
          oRow.ShiftDate =
            p(d.getUTCDate()) +
            "." +
            p(d.getUTCMonth() + 1) +
            "." +
            d.getUTCFullYear();
        }
        return oRow;
      },

      // ─────────────────────────────────────────────────────────────
      // START-UP CRITERIA POPUP (with F4 value helps)
      // ─────────────────────────────────────────────────────────────

      _f4Url: function (sPath, oExtra) {
        var oCookies = this._parseCookies();
        return (
          Base_url +
          "/api/f4/operator_perf/" +
          sPath +
          "?" +
          $.param(
            Object.assign(
              {
                empid: oCookies["employeeId"],
                sesid: oCookies["sessionId"],
                plant: oCookies["plant"],
              },
              oExtra || {},
            ),
          )
        );
      },

      _openCriteriaDialog: function () {
        var that = this;
        this._oCriteria = {};
        var oContent = new VBox().addStyleClass("sapUiTinyMargin");

        F4_FIELDS.forEach(function (oField) {
          oContent.addItem(
            new Label({ text: oField.label, required: !!oField.required }),
          );
          if (oField.dateRange) {
            oContent.addItem(
              new DateRangeSelection({
                width: "100%",
                valueFormat: "yyyy-MM-dd",
                displayFormat: "dd.MM.yyyy",
                change: function (oEvt) {
                  var oFrom = oEvt.getSource().getDateValue();
                  var oTo = oEvt.getSource().getSecondDateValue();
                  var oFmt = DateFormat.getDateInstance({
                    pattern: "yyyy-MM-dd",
                  });
                  that._oCriteria.fromDate = oFrom ? oFmt.format(oFrom) : "";
                  that._oCriteria.toDate = oTo ? oFmt.format(oTo) : "";
                },
              }).addStyleClass("sapUiTinyMarginBottom"),
            );
            return;
          }
          oContent.addItem(
            new Input({
              width: "100%",
              showValueHelp: true,
              liveChange: function (oEvt) {
                that._oCriteria[oField.key] = oEvt.getParameter("value");
              },
              valueHelpRequest: function (oEvt) {
                that._openValueHelp(oField, oEvt.getSource());
              },
            }).addStyleClass("sapUiTinyMarginBottom"),
          );
        });

        this._oCriteriaDialog = new Dialog({
          title: "Operator Performance Selection",
          contentWidth: "28rem",
          resizable: false,
          draggable: false,
          escapeHandler: function (oPromise) {
            oPromise.reject();
          },
          content: [oContent],
          beginButton: new Button({
            text: "Find",
            icon: "sap-icon://search",
            type: "Emphasized",
            press: function () {
              var aMissing = F4_FIELDS.filter(function (o) {
                return o.required && !(that._oCriteria[o.key] || "").trim();
              });
              if (aMissing.length) {
                MessageToast.show(
                  "Please fill: " +
                    aMissing
                      .map(function (o) {
                        return o.label;
                      })
                      .join(", "),
                );
                return;
              }
              that._oCriteriaDialog.close();
              that._loadReport();
            },
          }),
        });
        this._oCriteriaDialog.open();
      },

      _openValueHelp: function (oField, oInput) {
        var that = this;
        var iSkip = 0;
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
        var oMore = new Button({
          text: "Load More",
          visible: !!oField.paged,
          press: function () {
            load();
          },
        });
        var oDlg = new Dialog({
          title: oField.label,
          contentWidth: "28rem",
          contentHeight: "24rem",
          content: [oSearch, oList, oMore],
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
          var sKey = oEvt.getParameter("listItem").getTitle();
          oInput.setValue(sKey);
          that._oCriteria[oField.key] = sKey;
          oDlg.close();
        });

        function load() {
          oDlg.setBusy(true);
          $.ajax({
            url: that._f4Url(
              oField.path,
              oField.paged ? { top: 20, skip: iSkip } : null,
            ),
            method: "GET",
            headers: ngrokHeaders,
            success: function (oResp) {
              var aRows = oResp.values || [];
              aRows.forEach(function (oRow) {
                oList.addItem(
                  new StandardListItem({
                    title: oRow.key,
                    description: oRow.text,
                  }),
                );
              });
              iSkip += aRows.length;
              oMore.setVisible(!!oResp.has_more);
            },
            error: function () {
              MessageToast.show("Could not load " + oField.label + " list.");
            },
            complete: function () {
              oDlg.setBusy(false);
            },
          });
        }

        oDlg.open();
        load();
      },

      // ─────────────────────────────────────────────────────────────
      // FILTERS
      // ─────────────────────────────────────────────────────────────

      onSearchStock: function (oEvent) {
        var sRawQuery = (oEvent.getParameter("newValue") || "").trim();
        this.getView()
          .getModel("appModel")
          .setProperty("/quickSearch", sRawQuery);
        this._applyAllFilters();
      },

      onApplyFilters: function () {
        this._applyAllFilters();
      },

      onClearFilters: function () {
        var oAppModel = this.getView().getModel("appModel");
        oAppModel.setProperty("/quickSearch", "");
        oAppModel.setProperty("/filterMaterial", "");
        oAppModel.setProperty("/filterLoc", "");

        var oSearchField = this.byId("stockSearchField");
        if (oSearchField) {
          oSearchField.setValue("");
        }
        this._applyAllFilters();
      },

      _applyAllFilters: function () {
        var oAppModel = this.getView().getModel("appModel");
        var sQuick = (
          oAppModel.getProperty("/quickSearch") || ""
        ).toUpperCase();
        var sMaterial = (
          oAppModel.getProperty("/filterMaterial") || ""
        ).toUpperCase();
        var sLoc = (oAppModel.getProperty("/filterLoc") || "").toUpperCase();

        function matches(oItem, rKey, sNeedle) {
          return Object.keys(oItem).some(function (k) {
            return (
              (!rKey || rKey.test(k)) &&
              String(oItem[k] === null ? "" : oItem[k])
                .toUpperCase()
                .indexOf(sNeedle) !== -1
            );
          });
        }

        var aFiltered = (this._aAllItems || []).filter(function (oItem) {
          return (
            (!sQuick || matches(oItem, null, sQuick)) &&
            (!sMaterial || matches(oItem, /matnr|material/i, sMaterial)) &&
            (!sLoc || matches(oItem, /lgort|loc/i, sLoc))
          );
        });

        var aActive = [];
        if (sQuick) {
          aActive.push("Search: " + sQuick);
        }
        if (sMaterial) {
          aActive.push("Material: " + sMaterial);
        }
        if (sLoc) {
          aActive.push("Storage Loc: " + sLoc);
        }

        var oModel = this.getView().getModel("perfModel");
        oModel.setProperty("/items", aFiltered);
        oModel.setProperty("/hasActiveFilters", aActive.length > 0);
        oModel.setProperty(
          "/activeFiltersText",
          "Active Filters: " + aActive.join("  |  "),
        );

        var oSearchField = this.byId("stockSearchField");
        if (oSearchField) {
          oSearchField.setValue(oAppModel.getProperty("/quickSearch"));
        }
      },

      // ─────────────────────────────────────────────────────────────
      // SESSION GUARD
      // ─────────────────────────────────────────────────────────────

      /**
       * Checks every 20 seconds whether the session cookies still exist and
       * still belong to the same user/session that was active at start:
       * - Missing cookies -> session expired, redirect to login.
       * - Different employeeId -> another user logged in, redirect to login.
       * - Same employeeId but different sessionId -> prompt to refresh.
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

          if (bExpired || bUserChanged || bSessionChanged) {
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
       * present. Otherwise hides the view and shows the "Unauthorized" dialog.
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

      /** Normalises 2025-04-01 / 20250401 / 01.04.2025 to 2025-04-01T00:00:00. */
      _toIso: function (sDate) {
        var s = (sDate || "").trim();
        if (!s) {
          return "";
        }
        if (/^\d{8}$/.test(s)) {
          s = s.slice(0, 4) + "-" + s.slice(4, 6) + "-" + s.slice(6, 8);
        } else if (/^\d{2}[./]\d{2}[./]\d{4}$/.test(s)) {
          s = s.slice(6, 10) + "-" + s.slice(3, 5) + "-" + s.slice(0, 2);
        }
        return s.indexOf("T") === -1 ? s + "T00:00:00" : s;
      },

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
