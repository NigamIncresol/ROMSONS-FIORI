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
    "sap/m/Label",
    "sap/m/List",
    "sap/m/StandardListItem",
    "sap/m/SearchField",
    "sap/m/VBox",
    "sap/m/Column",
    "sap/m/ColumnListItem",
    "sap/ui/export/Spreadsheet",
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
    Label,
    List,
    StandardListItem,
    SearchField,
    VBox,
    Column,
    ColumnListItem,
    Spreadsheet,
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
      {
        key: "mrpController",
        label: "MRP Controller",
        path: "mrp_controllers",
        required: true,
      },
      {
        key: "material",
        label: "Material Code",
        path: "materials",
        paged: true,
      },
      { key: "materialType", label: "Material Type", path: "material_types" },
      { key: "house", label: "House ID", path: "houses" },
      { key: "department", label: "Department", path: "departments" },
      { key: "family", label: "Family", path: "families" },
    ];

    const STOCK_PAGE_SIZE = 50;

    // Friendly headings for known SAP field names (key lower-cased, symbols stripped)
    const COLUMN_LABELS = {
      werks: "Plant",
      plant: "Plant",
      dispo: "MRP Controller",
      mrpcontroller: "MRP Controller",
      matnr: "Material Code",
      material: "Material Code",
      maktx: "Material Description",
      mtart: "Material Type",
      matkl: "Material Group",
      meins: "UoM",
      lgort: "Storage Location",
      labst: "Unrestricted Stock",
    };

    /** "stockQty" / "STOCK_QTY" -> "Stock Qty" unless a known label exists. */
    function toHeading(sKey) {
      var sNorm = sKey.toLowerCase().replace(/[^a-z0-9]/g, "");
      if (COLUMN_LABELS[sNorm]) {
        return COLUMN_LABELS[sNorm];
      }
      return sKey
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/[_-]+/g, " ")
        .trim()
        .toLowerCase()
        .replace(/\b\w/g, function (c) {
          return c.toUpperCase();
        });
    }

    // Columns not shown in the results table (matched on lower-cased key, symbols stripped)
    const HIDDEN_COLUMNS =
      /^(family|employeeid|houseid|sessionid|department|housedesc\w*)$/;

    const ngrokHeaders = {
      "ngrok-skip-browser-warning": "69420",
    };

    return Controller.extend("stockreport.controller.View1", {
      // ─────────────────────────────────────────────────────────────
      // LIFECYCLE
      // ─────────────────────────────────────────────────────────────
      onInit: function () {
        this.getView().attachAfterRendering(
          function () {
            var sImageUrl = sap.ui.require.toUrl(
              "stockreport/images/logoNew.svg",
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
          "stockModel",
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
      _loadStock: function () {
        var oC = this._oCriteria || {};
        var aApplied = F4_FIELDS.filter(function (o) {
          return (oC[o.key] || "").trim();
        }).map(function (o) {
          return o.label + ": " + oC[o.key].trim();
        });
        this.getView()
          .getModel("stockModel")
          .setProperty(
            "/appliedCriteria",
            "Applied Filters: " + aApplied.join("  |  "),
          );
        this._aAllItems = [];
        this._iSkip = 0;
        this._fetchStockPage();
      },

      /** Exports the rows currently loaded in the table to an .xlsx file. */
      onExportExcel: function () {
        var aRows = this.getView().getModel("stockModel").getProperty("/items");
        if (!aRows || !aRows.length || !this._aExportColumns) {
          MessageToast.show("No data to export.");
          return;
        }
        new Spreadsheet({
          workbook: { columns: this._aExportColumns },
          dataSource: aRows,
          fileName: "Stock_Report.xlsx",
        })
          .build()
          .finally(function () {
            /* spreadsheet instance is single-use */
          });
      },

      onLoadMore: function () {
        this._fetchStockPage();
      },

      _fetchStockPage: function () {
        var oC = this._oCriteria || {};
        var oCookies = this._parseCookies();
        var oParams = {
          plant: oC.plant,
          mrpController: oC.mrpController,
          material: oC.material,
          materialType: oC.materialType,
          houseId: oC.house,
          department: oC.department,
          family: oC.family,
          employeeId: oCookies["employeeId"],
          sessionId: oCookies["sessionId"],
          top: STOCK_PAGE_SIZE,
          skip: this._iSkip,
        };
        Object.keys(oParams).forEach(function (k) {
          if (oParams[k] === undefined || oParams[k] === "") {
            delete oParams[k];
          }
        });

        this.byId("dynamicPage").setBusy(true);

        $.ajax({
          url: Base_url + "/api/report/stockreport?" + $.param(oParams),
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
            this._aAllItems = this._aAllItems.concat(aRows);
            this._iSkip += aRows.length;
            var bMore =
              oResponse.has_more !== undefined
                ? !!oResponse.has_more
                : aRows.length === STOCK_PAGE_SIZE;
            this.getView()
              .getModel("stockModel")
              .setProperty("/hasMore", bMore);
            this.getView()
              .getModel("stockModel")
              .setProperty("/hasResults", true);
            this._buildStockTable();
            this._applyAllFilters();
          }.bind(this),
          error: function () {
            MessageToast.show("Could not load stock report. Please try again.");
          },
          complete: function () {
            this.byId("dynamicPage").setBusy(false);
          }.bind(this),
        });
      },

      /** Builds table columns from the keys of the first returned row. */
      _buildStockTable: function () {
        var oTable = this.byId("stockTable");
        var oFirst = this._aAllItems[0];
        if (!oTable || !oFirst || oTable.getColumns().length) {
          return;
        }
        var aKeys = Object.keys(oFirst).filter(function (k) {
          var sNorm = k.toLowerCase().replace(/[^a-z0-9]/g, "");
          return (
            k !== "__metadata" &&
            typeof oFirst[k] !== "object" &&
            !HIDDEN_COLUMNS.test(sNorm)
          );
        });
        this._aExportColumns = aKeys.map(function (sKey) {
          return { label: toHeading(sKey), property: sKey, type: "string" };
        });
        var oTemplate = new ColumnListItem();
        aKeys.forEach(function (sKey) {
          oTable.addColumn(
            new Column({
              width: "6rem",
              header: new Text({ text: toHeading(sKey), wrapping: true }),
            }),
          );
          oTemplate.addCell(
            new Text({ text: "{stockModel>" + sKey + "}", wrapping: true }),
          );
        });
        oTable.setWidth(aKeys.length * 6 + "rem");
        oTable.bindItems({ path: "stockModel>/items", template: oTemplate });
      },

      // ─────────────────────────────────────────────────────────────
      // START-UP CRITERIA POPUP (with F4 value helps)
      // ─────────────────────────────────────────────────────────────

      _f4Url: function (sPath, oExtra) {
        var oCookies = this._parseCookies();
        return (
          Base_url +
          "/api/f4/stock_report/" +
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
          title: "Stock Report Selection",
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
              that._loadStock();
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

        var oModel = this.getView().getModel("stockModel");
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
