sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/VBox",
    "sap/m/HBox",
    "sap/m/Text",
    "sap/m/Label",
    "sap/m/Select",
    "sap/ui/core/Item",
    "sap/ui/core/HTML",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/m/SelectDialog",
    "sap/m/StandardListItem",
    "sap/m/Token",
  ],
  function (
    Controller,
    JSONModel,
    Dialog,
    Button,
    VBox,
    HBox,
    Text,
    Label,
    Select,
    Item,
    HTML,
    MessageToast,
    MessageBox,
    SelectDialog,
    StandardListItem,
    Token,
  ) {
    "use strict";

    const ngrokHeaders = {
      "ngrok-skip-browser-warning": "69420",
    };

    const Base_url = "http://localhost:3000";
    // const Base_url = "http://192.168.1.61:3000";
    // const Base_url = "http://192.168.0.136:3000";

    //Localhost URLs
    const Operator_Assignment_Url = "http://localhost:9002/index.html";
    const Create_Material_Reservation_Url = "http://localhost:9003/index.html";
    const Confirm_Receipt_Url = "http://localhost:9009/index.html";
    const Print_Job_Card_Url = "http://localhost:9011/index.html";
    const Login_Url = "http://localhost:9000/index.html";

    //Internal URLs(61)
    // const Operator_Assignment_Url =
    //   "https://romsonsfiori.incresol.com/CreateOperatorAssignment/index.html";
    // const Create_Material_Reservation_Url =
    //   "https://romsonsfiori.incresol.com/CreateMaterialReservation/index.html";
    // const Confirm_Receipt_Url =
    //   "https://romsonsfiori.incresol.com/ReceiptConfirmation/index.html";
    // const Print_Job_Card_Url =
    //   "https://romsonsfiori.incresol.com/DocumentCenter/index.html";
    // const Login_Url = "https://romsonsfiori.incresol.com/LoginApp/index.html";

    // Production URLs(136)
    // const Operator_Assignment_Url =
    //   "https://webapps.romsons.com/CreateOperatorAssignment/index.html";
    // const Create_Material_Reservation_Url =
    //   "https://webapps.romsons.com/CreateMaterialReservation/index.html";
    // const Confirm_Receipt_Url =
    //   "https://webapps.romsons.com/ReceiptConfirmation/index.html";
    // const Print_Job_Card_Url =
    //   "https://webapps.romsons.com/DocumentCenter/index.html";
    // const Login_Url = "https://webapps.romsons.com/LoginApp/index.html";

    return Controller.extend("productionorder.controller.View1", {
      // ─────────────────────────────────────────────────────────────
      // LIFECYCLE
      // ─────────────────────────────────────────────────────────────
      onInit: function () {
        this.getView().attachAfterRendering(
          function () {
            var sImageUrl = sap.ui.require.toUrl(
              "productionorder/images/logoNew.svg",
            );
            this.byId("logoImage").setSrc(sImageUrl);
          }.bind(this),
        );
        this.getView().setModel(
          new JSONModel({
            filtersApplied: false,
            filterBannerText: "",
            employeeId: "",
            plant: "",
          }),
          "appModel",
        );
        const oDeviceModel = this.getOwnerComponent().getModel("device");

        console.log(oDeviceModel.getData());

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
              this._loadOrders();
              this._startSessionCheck();
            }
          }.bind(this),
          300,
        );
      },

      // ─────────────────────────────────────────────────────────────
      // DATA LOADING
      // ─────────────────────────────────────────────────────────────
      _loadOrders: function () {
        var oCookies = this._parseCookies();
        var sEmployeeId = oCookies["employeeId"];
        var sPlant = oCookies["plant"];
        var sSessionId = oCookies["sessionId"];

        var sUrl =
          Base_url +
          "/api/productionOrder/getProductionOrders/" +
          sEmployeeId +
          "/" +
          sPlant +
          "/" +
          sSessionId;

        this.byId("ordersListVBox").setBusy(true);

        $.ajax({
          url: sUrl,
          method: "GET",
          headers: ngrokHeaders,
          contentType: "application/json",
          success: function (oResponse) {
            var aRaw = oResponse.results || [];
            var oModel = new JSONModel({
              orders: aRaw,
              _allOrders: aRaw,
            });
            oModel.setSizeLimit(10000);
            this.getView().setModel(oModel, "ordersModel");
            setTimeout(
              function () {
                this._applyFilters();
                this._collapseAllPanels();
                this._expandFirstPanel();
                this.byId("ordersListVBox").setBusy(false);
                var oBar = this.byId("titleRefreshBar");
                if (oBar) {
                  oBar.setBusy(false);
                }
              }.bind(this),
              0,
            );
          }.bind(this),
          error: function () {
            MessageToast.show("Could not load orders. Please try again.");
            this.byId("ordersListVBox").setBusy(false);
            var oBar = this.byId("titleRefreshBar");
            if (oBar) {
              oBar.setBusy(false);
            }
          }.bind(this),
        });
      },

      // ─────────────────────────────────────────────────────────────
      // SEARCH & FILTER
      // ─────────────────────────────────────────────────────────────
      onSearch: function () {
        this._debounceFilter();
      },

      onScanBarcode: function () {
        var that = this;
        var oScanner = null;
        var sScanDivId = "html5QrScanDiv";

        var oHTML = new HTML({
          content: "<div id='" + sScanDivId + "' style='width:100%;'></div>",
        });

        var oDialog = new Dialog({
          title: "Scan Barcode",
          contentWidth: "380px",
          content: [oHTML],
          endButton: new Button({
            text: "Cancel",
            press: function () {
              oDialog.close();
            },
          }),
          afterOpen: function () {
            if (!window.Html5Qrcode) {
              MessageToast.show("Scanner library not loaded.");
              oDialog.close();
              return;
            }
            oScanner = new window.Html5Qrcode(sScanDivId);
            oScanner
              .start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 150 } },
                function (sDecodedText) {
                  console.log("Scan raw data:", sDecodedText);
                  var oParsed;
                  try {
                    oParsed = JSON.parse(sDecodedText);
                  } catch (e) {
                    oParsed = null;
                  }
                  if (
                    !oParsed ||
                    !oParsed["Order No"] ||
                    !oParsed["Shift Date"] ||
                    !oParsed["Shift ID"]
                  ) {
                    oScanner.stop().catch(function () {});
                    oDialog.close();
                    MessageBox.error(
                      "Invalid QR scanned. Please scan a valid job card.",
                      {
                        title: "Invalid QR",
                      },
                    );
                    return;
                  }
                  oDialog.close();
                  var sOrderNo =
                    oParsed["Order No"].replace(/^0+/, "") ||
                    oParsed["Order No"];
                  that.byId("searchField").setValue(sOrderNo);
                  that._applyFilters();
                  setTimeout(function () {
                    var aPanels = that
                      .getView()
                      .findAggregatedObjects(true, function (o) {
                        return o.isA("sap.m.Panel");
                      });
                    if (aPanels.length > 0) {
                      aPanels[0].setExpanded(true);
                    }
                  }, 0);
                  MessageToast.show("Scanned: " + sOrderNo, {
                    duration: 2000,
                  });
                },
                function () {},
              )
              .catch(function (err) {
                MessageToast.show("Camera error: " + err);
                oDialog.close();
              });
          },
          afterClose: function () {
            if (oScanner) {
              oScanner
                .stop()
                .catch(function () {})
                .finally(function () {
                  oScanner.clear();
                  oDialog.destroy();
                });
            } else {
              oDialog.destroy();
            }
          },
        });

        oDialog.open();
      },

      onApplyFilters: function () {
        this.byId("filterBar").setBusy(true);
        setTimeout(
          function () {
            this._applyFilters();
            this._collapseAllPanels();
            this._expandFirstPanel();
            this.byId("filterBar").setBusy(false);
          }.bind(this),
          0,
        );
      },

      _debounceFilter: function () {
        clearTimeout(this._filterTimer);
        this.byId("filterBar").setBusy(true);
        this._filterTimer = setTimeout(
          function () {
            this._applyFilters();
            this.byId("filterBar").setBusy(false);
          }.bind(this),
          300,
        );
      },

      onClearFilters: function () {
        this.byId("searchField").setValue("");
        [
          "filterHouseId",
          "filterOrder",
          "filterOrderType",
          "filterMaterial",
          "filterOrderStatus",
          "filterFamily",
          "filterDepartment",
          // "filterShift",
          "filterBatch",
          "filterWorklist",
        ].forEach(
          function (sId) {
            this.byId(sId).removeAllTokens();
          }.bind(this),
        );
        [
          "filterCreatedOn",
          "filterActualRelease",
          "filterStartDate",
          "filterFinishDate",
        ].forEach(
          function (sId) {
            this.byId(sId).setValue("");
          }.bind(this),
        );
        this.byId("filterBar").setBusy(true);
        this.byId("ordersListVBox").setBusy(true);
        setTimeout(
          function () {
            this._applyFilters();
            this._collapseAllPanels();
            this._expandFirstPanel();
            this.byId("filterBar").setBusy(false);
            this.byId("ordersListVBox").setBusy(false);
          }.bind(this),
          0,
        );
      },

      // ── F4 Value Help ────────────────────────────────────────
      // Response shape: { values: [{key, key2, text, info}], ... }
      // tokenKey = what gets stored in the token and compared in _applyFilters
      // tokenText = label shown on the chip in the MultiInput
      // display   = text shown per row in the SelectDialog
      _f4Config: {
        filterHouseId: {
          helpId: "houses",
          // houseDesc in order data is the text (e.g. "RG-1 BLACK HOUSE")
          tokenKey: function (v) {
            return v.text;
          },
          tokenText: function (v) {
            return v.text;
          },
          display: function (v) {
            return v.key + " – " + v.text;
          },
        },
        filterOrder: {
          helpId: "orders_open",
          serverSearch: true,
          // order in order data has leading zeros stripped
          tokenKey: function (v) {
            return v.key.replace(/^0+/, "") || v.key;
          },
          tokenText: function (v) {
            return v.key.replace(/^0+/, "") || v.key;
          },
          display: function (v) {
            return v.key + "  " + v.text;
          },
        },
        filterOrderType: {
          helpId: "order_types",
          tokenKey: function (v) {
            return v.key;
          },
          tokenText: function (v) {
            return v.key;
          },
          display: function (v) {
            return v.key + " – " + v.text;
          },
        },
        filterMaterial: {
          helpId: "materials",
          // material in order data has no leading zeros to strip for alpha keys
          tokenKey: function (v) {
            return v.key;
          },
          tokenText: function (v) {
            return v.key;
          },
          display: function (v) {
            return v.key + " – " + v.text;
          },
        },
        filterOrderStatus: {
          helpId: "order_statuses",
          tokenKey: function (v) {
            return v.key;
          },
          tokenText: function (v) {
            return v.text;
          },
          display: function (v) {
            return v.key + " – " + v.text;
          },
        },
        filterFamily: {
          helpId: "families",
          tokenKey: function (v) {
            return v.key;
          },
          tokenText: function (v) {
            return v.text;
          },
          display: function (v) {
            return v.text;
          },
        },
        filterDepartment: {
          helpId: "departments",
          tokenKey: function (v) {
            return v.key;
          },
          tokenText: function (v) {
            return v.key;
          },
          display: function (v) {
            return v.key;
          },
        },
        filterShift: {
          helpId: "shifts",
          tokenKey: function (v) {
            return v.key;
          },
          tokenText: function (v) {
            return v.text;
          },
          display: function (v) {
            return v.key + " – " + v.text;
          },
        },
        filterBatch: {
          helpId: "order_batches",
          tokenKey: function (v) {
            return v.key;
          },
          tokenText: function (v) {
            return v.key;
          },
          display: function (v) {
            return v.key;
          },
        },
        filterWorklist: {
          helpId: "pol_worklists",
          tokenKey: function (v) {
            return v.key;
          },
          tokenText: function (v) {
            return v.text;
          },
          display: function (v) {
            return v.text;
          },
        },
      },

      onFilterValueHelp: function (oEvent) {
        var that = this;
        var oInput = oEvent.getSource();
        // Guard against double-fire of valueHelpRequest
        if (oInput._f4Open) {
          return;
        }
        oInput._f4Open = true;
        var sInputId = oInput.getId().split("--").pop();
        var oCfg = this._f4Config[sInputId];
        if (!oCfg) {
          oInput._f4Open = false;
          return;
        }

        var oCookies = this._parseCookies();
        var sUrl =
          Base_url +
          "/api/f4/prod_order_list/" +
          oCfg.helpId +
          "?empid=" +
          encodeURIComponent(oCookies["employeeId"] || "") +
          "&sesid=" +
          encodeURIComponent(oCookies["sessionId"] || "") +
          "&plant=" +
          encodeURIComponent(oCookies["plant"] || "");

        var PAGE_SIZE = 100;

        function normalise(aRaw) {
          return aRaw.map(function (v) {
            return {
              tokenKey: oCfg.tokenKey(v),
              tokenText: oCfg.tokenText(v),
              display: oCfg.display(v),
            };
          });
        }

        // State shared across pagination and search
        var iCurrentSkip = 0;
        var bHasMore = false;
        var sCurrentSearch = "";
        var iSearchTimer = null;
        var oVHModel = new JSONModel({ items: [] });
        oVHModel.setSizeLimit(10000);

        function fetchAndAppend(iSkip, sSearch, bReplace) {
          var sPageUrl =
            sUrl +
            "&top=" +
            PAGE_SIZE +
            "&skip=" +
            iSkip +
            (sSearch ? "&search=" + encodeURIComponent(sSearch) : "");

          return $.ajax({
            url: sPageUrl,
            method: "GET",
            headers: ngrokHeaders,
            success: function (oData) {
              var aPage = normalise((oData && oData.values) || []);
              bHasMore = !!(oData && oData.has_more && aPage.length > 0);
              iCurrentSkip = iSkip + PAGE_SIZE;

              if (bReplace) {
                oVHModel.setProperty("/items", aPage);
              } else {
                var aCurrent = oVHModel.getProperty("/items") || [];
                oVHModel.setProperty("/items", aCurrent.concat(aPage));
              }

              if (oLoadMoreBtn) {
                oLoadMoreBtn.setVisible(bHasMore);
                oLoadMoreBtn.setEnabled(true);
              }
            },
            error: function () {
              MessageToast.show("Could not load value help.");
            },
          });
        }

        // ── Open dialog immediately with first page ────────────
        var aExisting = oInput.getTokens().map(function (t) {
          return t.getKey();
        });
        var aSelected = []; // tracks keys chosen in this session

        // Pre-populate with already-tokenised keys
        aExisting.forEach(function (k) {
          aSelected.push(k);
        });

        var oList = new sap.m.List({
          mode: "MultiSelect",
          includeItemInSelection: true,
          items: {
            path: "vh>/items",
            template: new StandardListItem({
              title: "{vh>display}",
              selected: {
                path: "vh>tokenKey",
                formatter: function (sKey) {
                  return aSelected.indexOf(sKey) !== -1;
                },
              },
            }),
          },
          selectionChange: function (oEv) {
            var oItem = oEv.getParameter("listItem");
            var oCtx = oItem.getBindingContext("vh");
            var sKey = oVHModel.getProperty(oCtx.getPath() + "/tokenKey");
            if (oEv.getParameter("selected")) {
              if (aSelected.indexOf(sKey) === -1) {
                aSelected.push(sKey);
              }
            } else {
              aSelected = aSelected.filter(function (k) {
                return k !== sKey;
              });
            }
          },
        });

        var oSearchField = new sap.m.SearchField({
          width: "100%",
          placeholder: "Search...",
          liveChange: function (oEv) {
            var sVal = oEv.getParameter("newValue") || "";
            sCurrentSearch = sVal;
            if (iSearchTimer) {
              clearTimeout(iSearchTimer);
            }

            if (oCfg.serverSearch) {
              iSearchTimer = setTimeout(function () {
                oDialog.setBusy(true);
                fetchAndAppend(0, sVal, true).always(function () {
                  oDialog.setBusy(false);
                });
              }, 350);
            } else {
              oList
                .getBinding("items")
                .filter(
                  sVal
                    ? new sap.ui.model.Filter(
                        "display",
                        sap.ui.model.FilterOperator.Contains,
                        sVal,
                      )
                    : [],
                );
            }
          },
        });

        var oLoadMoreBtn = new Button({
          text: "Load More",
          type: "Transparent",
          visible: false,
          press: function () {
            oLoadMoreBtn.setEnabled(false);
            oDialog.setBusy(true);
            fetchAndAppend(iCurrentSkip, sCurrentSearch, false).always(
              function () {
                oDialog.setBusy(false);
              },
            );
          },
        });

        var oDialog = new sap.m.Dialog({
          title: oInput.getParent().getItems()[0].getText(),
          contentWidth: "400px",
          contentHeight: "60vh",
          subHeader: new sap.m.Bar({
            contentMiddle: [oSearchField],
          }),
          content: [
            oList,
            new HBox({
              justifyContent: "Center",
              items: [oLoadMoreBtn],
            }),
          ],
          beginButton: new Button({
            text: "OK",
            type: "Emphasized",
            press: function () {
              oInput.removeAllTokens();
              var aItems = oVHModel.getProperty("/items") || [];
              aSelected.forEach(function (sKey) {
                var oMatch = aItems.filter(function (i) {
                  return i.tokenKey === sKey;
                })[0];
                var sText = oMatch ? oMatch.tokenText : sKey;
                oInput.addToken(new Token({ key: sKey, text: sText }));
              });
              oInput._f4Open = false;
              oDialog.destroy();
            },
          }),
          endButton: new Button({
            text: "Cancel",
            press: function () {
              oInput._f4Open = false;
              oDialog.destroy();
            },
          }),
        });

        oDialog.setModel(oVHModel, "vh");
        that.getView().addDependent(oDialog);
        oDialog.open();

        // Load first page
        oDialog.setBusy(true);
        fetchAndAppend(0, "", true).always(function () {
          oDialog.setBusy(false);
        });
        oInput.setBusy(false);
      },

      // ── Production Order live-search in the input field ───────
      onOrderSuggest: function (oEvent) {
        var that = this;
        var oInput = oEvent.getSource();
        var sVal = oEvent.getParameter("suggestValue") || "";
        if (!sVal || sVal.length < 1) {
          oInput.destroySuggestionItems();
          return;
        }

        if (oInput._suggestTimer) {
          clearTimeout(oInput._suggestTimer);
        }
        oInput._suggestTimer = setTimeout(function () {
          var oCookies = that._parseCookies();
          var oCfg = that._f4Config["filterOrder"];
          var sUrl =
            Base_url +
            "/api/f4/prod_order_list/orders_open" +
            "?empid=" +
            encodeURIComponent(oCookies["employeeId"] || "") +
            "&sesid=" +
            encodeURIComponent(oCookies["sessionId"] || "") +
            "&plant=" +
            encodeURIComponent(oCookies["plant"] || "") +
            "&search=" +
            encodeURIComponent(sVal) +
            "&top=20&skip=0";

          $.ajax({
            url: sUrl,
            method: "GET",
            headers: ngrokHeaders,
            success: function (oData) {
              oInput.destroySuggestionItems();
              var aValues = oData && oData.values ? oData.values : [];
              aValues.forEach(function (v) {
                oInput.addSuggestionItem(
                  new Item({ key: oCfg.tokenKey(v), text: oCfg.display(v) }),
                );
              });
            },
          });
        }, 350);
      },

      onOrderSuggestionSelected: function (oEvent) {
        var oInput = oEvent.getSource();
        var oItem = oEvent.getParameter("selectedItem");
        if (!oItem) {
          return;
        }
        var sKey = oItem.getKey();
        // Avoid duplicate token
        var bExists = oInput.getTokens().some(function (t) {
          return t.getKey() === sKey;
        });
        if (!bExists) {
          oInput.addToken(new Token({ key: sKey, text: sKey }));
        }
        oInput.setValue("");
        oInput.destroySuggestionItems();
      },

      _applyFilters: function () {
        var that = this;
        var oModel = this.getView().getModel("ordersModel");
        if (!oModel) {
          return;
        }
        var aAll = oModel.getProperty("/_allOrders") || [];

        var sQuery = (this.byId("searchField").getValue() || "")
          .toLowerCase()
          .trim();

        var _stripLeadingZeros = function (s) {
          return (s || "").replace(/^0+/, "") || "0";
        };

        var _tokens = function (sId) {
          return that
            .byId(sId)
            .getTokens()
            .map(function (t) {
              return t.getKey();
            });
        };
        var aHouseId = _tokens("filterHouseId");
        var aOrder = _tokens("filterOrder").map(_stripLeadingZeros);
        var aOrderType = _tokens("filterOrderType");
        var aMaterial = _tokens("filterMaterial").map(_stripLeadingZeros);
        var aOrderStatus = _tokens("filterOrderStatus");
        var aFamily = _tokens("filterFamily");
        var aDepartment = _tokens("filterDepartment");
        // var aShift = _tokens("filterShift");
        var aBatch = _tokens("filterBatch");
        var aWorklist = _tokens("filterWorklist");

        var _parseSapDate = function (s) {
          var m = /\/Date\((\d+)\)\//.exec(s || "");
          return m ? new Date(parseInt(m[1], 10)) : null;
        };
        var _dateRange = function (sId) {
          var oCtrl = that.byId(sId);
          var dFrom = oCtrl.getDateValue();
          var dTo = oCtrl.getSecondDateValue();
          if (dTo) { dTo = new Date(dTo); dTo.setHours(23, 59, 59, 999); }
          return { from: dFrom, to: dTo };
        };
        var drCreatedOn     = _dateRange("filterCreatedOn");
        var drActualRelease = _dateRange("filterActualRelease");
        var drStartDate     = _dateRange("filterStartDate");
        var drFinishDate    = _dateRange("filterFinishDate");
        var _inRange = function (dr, sVal) {
          if (!dr.from && !dr.to) { return true; }
          var d = _parseSapDate(sVal);
          if (!d) { return false; }
          if (dr.from && d < dr.from) { return false; }
          if (dr.to   && d > dr.to)   { return false; }
          return true;
        };

        var _worklistFieldMap = {
          RES_PENDING: "ResPending",
          ISSUE_PENDING: "IssuePending",
          RECEIPT_PENDING: "ReceiptPending",
          OPER_PENDING: "OperPending",
          CONF_PENDING: "ConfPending",
          REL_PENDING: "releasePending",
          GR_PENDING: "GrPending",
        };

        var aFiltered = aAll.filter(function (o) {
          if (sQuery) {
            var bMatch =
              (o.order || "").toLowerCase().includes(sQuery) ||
              (o.materialDesc || "").toLowerCase().includes(sQuery) ||
              (o.material || "").toLowerCase().includes(sQuery) ||
              (o.orderType || "").toLowerCase().includes(sQuery) ||
              (o.orderStatus || "").toLowerCase().includes(sQuery) ||
              (o.houseDesc || "").toLowerCase().includes(sQuery);
            if (!bMatch) {
              return false;
            }
          }

          if (
            aHouseId.length &&
            !aHouseId.includes((o.houseDesc || "").trim())
          ) {
            return false;
          }
          if (
            aOrder.length &&
            !aOrder.includes(_stripLeadingZeros((o.order || "").trim()))
          ) {
            return false;
          }
          if (
            aOrderType.length &&
            !aOrderType.includes((o.orderType || "").trim())
          ) {
            return false;
          }
          if (
            aMaterial.length &&
            !aMaterial.includes(_stripLeadingZeros((o.material || "").trim()))
          ) {
            return false;
          }
          if (
            aOrderStatus.length &&
            !aOrderStatus.includes((o.orderStatus || "").trim())
          ) {
            return false;
          }
          if (aFamily.length && !aFamily.includes((o.family || "").trim())) {
            return false;
          }
          if (aBatch.length && !aBatch.includes((o.batch || "").trim())) {
            return false;
          }
          if (
            aDepartment.length &&
            !aDepartment.includes((o.Department || "").trim())
          ) {
            return false;
          }
          // if (aShift.length && !aShift.includes((o.ShiftId || "").trim())) {
          //   return false;
          // }
          if (aWorklist.length) {
            var bWorklistMatch = aWorklist.some(function (sKey) {
              if (sKey === "DELAYED") {
                return (o.statusBadge || "") === "DELAYED";
              }
              var sField = _worklistFieldMap[sKey];
              return sField && o[sField] === "X";
            });
            if (!bWorklistMatch) {
              return false;
            }
          }
          if (!_inRange(drCreatedOn,     o.createdOn))     { return false; }
          if (!_inRange(drActualRelease, o.actualRelease))  { return false; }
          if (!_inRange(drStartDate,     o.startDate))      { return false; }
          if (!_inRange(drFinishDate,    o.finishDate))     { return false; }

          return true;
        });

        oModel.setProperty("/orders", aFiltered);
        console.log("Production order panels shown:", aFiltered.length);
        this._updateFilterBanner();
      },

      _updateFilterBanner: function () {
        var sQuery = (this.byId("searchField").getValue() || "").trim();
        var aActiveFilters = [
          "filterHouseId",
          "filterOrder",
          "filterOrderType",
          "filterMaterial",
          "filterOrderStatus",
          "filterFamily",
          "filterDepartment",
          // "filterShift",
          "filterBatch",
          "filterWorklist",
        ].filter(
          function (sId) {
            return this.byId(sId).getTokens().length > 0;
          }.bind(this),
        );

        var aDateFilters = ["filterCreatedOn","filterActualRelease","filterStartDate","filterFinishDate"]
          .filter(function (sId) { return !!this.byId(sId).getValue(); }.bind(this));

        var bActive = !!sQuery || aActiveFilters.length > 0 || aDateFilters.length > 0;

        var oAppModel = this.getView().getModel("appModel");
        oAppModel.setProperty("/filtersApplied", bActive);
        oAppModel.setProperty("/filterBannerText", bActive ? "Filters applied" : "");
      },

      // ─────────────────────────────────────────────────────────────
      // FORMATTERS
      // ─────────────────────────────────────────────────────────────

      formatOperatorCount: function (sValue) {
        return String(parseInt(sValue, 10) || 0);
      },

      formatFallback: function (sValue) {
        return sValue === null ||
          sValue === undefined ||
          String(sValue).trim() === ""
          ? "--"
          : sValue;
      },

      // progress string → SVG circular progress HTML
      formatCircularProgress: function (sValue) {
        var iVal = Math.min(100, Math.max(0, parseFloat(sValue) || 0));
        var r = 12;
        var circ = 2 * Math.PI * r;
        var offset = circ * (1 - iVal / 100);
        var color = iVal > 60 ? "#107e3e" : iVal >= 30 ? "#e9730c" : "#bb0000";
        return (
          "<div style='display:inline-flex;align-items:center;vertical-align:middle;margin-left:1rem'>" +
          "<svg width='32' height='32' viewBox='0 0 32 32' xmlns='http://www.w3.org/2000/svg'>" +
          "<circle cx='16' cy='16' r='" +
          r +
          "' fill='none' stroke='#e0e0e0' stroke-width='3'/>" +
          "<circle cx='16' cy='16' r='" +
          r +
          "' fill='none' stroke='" +
          color +
          "' stroke-width='3'" +
          " stroke-dasharray='" +
          circ.toFixed(2) +
          "' stroke-dashoffset='" +
          offset.toFixed(2) +
          "'" +
          " stroke-linecap='round' transform='rotate(-90 16 16)'/>" +
          "<text x='16' y='20' text-anchor='middle' font-size='7' font-weight='700' fill='" +
          color +
          "' font-family='Arial,sans-serif'>" +
          iVal +
          "%</text>" +
          "</svg></div>"
        );
      },

      // colorCode → SAP ValueState
      formatStatusState: function (sColorCode) {
        switch ((sColorCode || "").toUpperCase()) {
          case "GREEN":
            return "Success";
          case "RED":
            return "Error";
          case "YELLOW":
          case "ORANGE":
            return "Warning";
          case "BLUE":
            return "Information";
          default:
            return "None";
        }
      },

      formatIndianNumber: function (v) {
        if (v === null || v === undefined || v === "") { return "–"; }
        var n = parseFloat(v);
        if (isNaN(n)) { return v; }
        var parts = n.toFixed(3).split(".");
        var intPart = parts[0].replace(/^-/, "");
        var sign = n < 0 ? "-" : "";
        var result = "";
        if (intPart.length > 3) {
          result = intPart.slice(-3);
          var rest = intPart.slice(0, -3);
          while (rest.length > 2) {
            result = rest.slice(-2) + "," + result;
            rest = rest.slice(0, -2);
          }
          result = rest + "," + result;
        } else {
          result = intPart;
        }
        return sign + result + "." + parts[1];
      },

      // /Date(ms)/ → "8 Apr 2026"
      formatDate: function (s) {
        var m = /\/Date\((\d+)\)\//.exec(s || "");
        if (!m) { return s || ""; }
        var d = new Date(parseInt(m[1], 10));
        var aMonths = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
        return d.getDate() + " " + aMonths[d.getMonth()] + " " + d.getFullYear();
      },

      // /Date(ms)/ + /Date(ms)/ → "8 Apr → 12 Apr"
      formatDateRange: function (sStart, sFinish) {
        var fnParse = function (s) {
          var m = /\/Date\((\d+)\)\//.exec(s || "");
          return m ? new Date(parseInt(m[1], 10)) : null;
        };
        var aMonths = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];
        var fnFmt = function (d) {
          return d ? d.getDate() + " " + aMonths[d.getMonth()] : "—";
        };
        return fnFmt(fnParse(sStart)) + " → " + fnFmt(fnParse(sFinish));
      },

      // /Date(ms)/ → "8 Apr 2025"  (full date for detail fields)
      formatSingleDate: function (sDate) {
        var m = /\/Date\((\d+)\)\//.exec(sDate || "");
        if (!m) {
          return "—";
        }
        var d = new Date(parseInt(m[1], 10));
        var aMonths = [
          "Jan",
          "Feb",
          "Mar",
          "Apr",
          "May",
          "Jun",
          "Jul",
          "Aug",
          "Sep",
          "Oct",
          "Nov",
          "Dec",
        ];
        return (
          d.getDate() + " " + aMonths[d.getMonth()] + " " + d.getFullYear()
        );
      },

      // ─────────────────────────────────────────────────────────────
      // ACTION HANDLERS
      // ─────────────────────────────────────────────────────────────
      onRefreshOrders: function () {
        this.byId("titleRefreshBar").setBusy(true);
        this.onClearFilters();
        this._loadOrders();
      },

      onReleaseOrder: function (oEvent) {
        var oOrder = oEvent
          .getSource()
          .getBindingContext("ordersModel")
          .getObject();

        var oCookies = this._parseCookies();

        MessageBox.confirm(
          "Are you sure you want to release order " + oOrder.order + "?",
          {
            title: "Release Order",
            actions: [MessageBox.Action.YES, MessageBox.Action.NO],
            onClose: function (sAction) {
              if (sAction !== MessageBox.Action.YES) {
                return;
              }
              this.byId("dynamicPage").setBusy(true);
              $.ajax({
                url: Base_url + "/api/productionOrder/releaseProdOrder",
                method: "POST",
                headers: ngrokHeaders,
                contentType: "application/json",
                data: JSON.stringify({
                  order: oOrder.order,
                  employeeId: oCookies["employeeId"],
                  sessionId: oCookies["sessionId"],
                  plant: oCookies["plant"],
                }),
                success: function (oResponse) {
                  console.log("Release Order Response:", oResponse);
                  MessageToast.show(
                    "Order " + oOrder.order + " released successfully.",
                  );
                  this._loadOrders();
                }.bind(this),
                error: function (oXHR) {
                  console.log(
                    "Release Order Error:",
                    oXHR.responseJSON || oXHR.responseText,
                  );
                  MessageToast.show(
                    "Failed to release order " + oOrder.order + ".",
                  );
                },
                complete: function () {
                  this.byId("dynamicPage").setBusy(false);
                }.bind(this),
              });
            }.bind(this),
          },
        );
      },

      onAssignOperators: function (oEvent) {
        var oOrder = oEvent
          .getSource()
          .getBindingContext("ordersModel")
          .getObject();
        window.open(
          Operator_Assignment_Url + "?order=" + oOrder.order,
          "_blank",
        );
      },

      onRequestMaterials: function (oEvent) {
        var oOrder = oEvent
          .getSource()
          .getBindingContext("ordersModel")
          .getObject();
        window.open(
          Create_Material_Reservation_Url +
            "?order=" +
            encodeURIComponent(oOrder.order),
          "_blank",
        );
      },

      onConfirmReceipt: function (oEvent) {
        var oOrder = oEvent
          .getSource()
          .getBindingContext("ordersModel")
          .getObject();
        window.open(
          Confirm_Receipt_Url +
            "?order=" +
            encodeURIComponent(oOrder.order) +
            "&navType=order",
          "_blank",
        );
      },

      onPrintOrderCard: function (oEvent) {
        var oOrder = oEvent
          .getSource()
          .getBindingContext("ordersModel")
          .getObject();
        var sUrl =
          Print_Job_Card_Url +
          "?doctype=jobcard&order=" +
          encodeURIComponent(oOrder.order);
        window.open(sUrl, "_blank");
      },

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
              window.location.href = Login_Url;
            },
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

      onScanQR: function () {
        MessageToast.show("QR scanner not yet implemented.");
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
      _collapseAllPanels: function () {
        this.getView()
          .findAggregatedObjects(true, function (oControl) {
            return oControl.isA("sap.m.Panel");
          })
          .forEach(function (oPanel) {
            oPanel.setExpanded(false);
          });
      },

      _expandFirstPanel: function () {
        var aPanels = this.getView().findAggregatedObjects(true, function (o) {
          return o.isA("sap.m.Panel");
        });
        if (aPanels.length > 0) {
          aPanels[0].setExpanded(true);
        }
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
