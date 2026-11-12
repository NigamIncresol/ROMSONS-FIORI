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
    "sap/ui/core/Fragment",
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
    Fragment,
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
    const IssueSlip_Url = "http://localhost:9011/index.html";

    //Internal URLs
    // const Login_Url = "https://romsonsfiori.incresol.com/LoginApp/index.html";
    // const IssueSlip_Url =
    //   "https://romsonsfiori.incresol.com/DocumentCenter/index.html";

    // Production URLs
    // const Login_Url = "https://webapps.romsons.com/LoginApp/index.html";
    // const IssueSlip_Url =
    //   "https://webapps.romsons.com/DocumentCenter/index.html";

    const ngrokHeaders = {
      "ngrok-skip-browser-warning": "69420",
    };

    return Controller.extend("materialissue.controller.View1", {
      // ─────────────────────────────────────────────────────────────
      // LIFECYCLE
      // ─────────────────────────────────────────────────────────────
      onInit: function () {
        this.getView().attachAfterRendering(
          function () {
            var sImageUrl = sap.ui.require.toUrl(
              "materialissue/images/logoNew.svg",
            );
            this.byId("logoImage").setSrc(sImageUrl);
          }.bind(this),
        );

        this.getView().setModel(
          new JSONModel({
            employeeId: "",
            plant: "",
            orderId: "",
            scanRequired: false,
            reservationNoInput: "",
            showBanner: false,
            bannerText: "",
            bannerType: "Warning",
          }),
          "appModel",
        );

        this.getView().setModel(
          new JSONModel({
            reservations: [],
          }),
          "materialsModel",
        );

        setTimeout(
          function () {
            var oCookies = this._parseCookies();
            this._sOrderId = this._getQueryParam("order");
            var sReservationNo = this._getQueryParam("reservation");

            this.getView()
              .getModel("appModel")
              .setProperty("/employeeId", oCookies["employeeId"] || "");
            this.getView()
              .getModel("appModel")
              .setProperty("/plant", oCookies["plant"] || "");
            this.getView()
              .getModel("appModel")
              .setProperty("/orderId", this._sOrderId || "");
            this.getView()
              .getModel("appModel")
              .setProperty("/reservationNoInput", sReservationNo || "");

            if (this._enforceSession()) {
              this._startSessionCheck();

              if (sReservationNo) {
                this._fetchReservationByNumber(sReservationNo);
              }
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
          "/api/materials/getReservations/" +
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

            var aReservations = aHeaders.map(this._mapReservationHeader, this);

            this._aAllReservations = aReservations;

            this.getView().setModel(
              new JSONModel({
                reservations: aReservations,
              }),
              "materialsModel",
            );

            setTimeout(
              function () {
                this.getView()
                  .findAggregatedObjects(true, function (oControl) {
                    return (
                      oControl.isA("sap.m.Panel") &&
                      oControl.hasStyleClass("storagePanel")
                    );
                  })
                  .forEach(function (oPanel) {
                    oPanel.setExpanded(false);
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

      /**
       * Maps a raw reservation header (as returned by getReservations /
       * getReservationByNumber) into the shape used by the view model:
       * sorts items by item number and attaches each item's batches.
       */
      _mapReservationHeader: function (oHeader) {
        var aItems = (oHeader.npToItem && oHeader.npToItem.results) || [];
        aItems.sort(function (a, b) {
          return (
            parseInt(a.reservationItemNo, 10) -
            parseInt(b.reservationItemNo, 10)
          );
        });
        aItems.forEach(function (oItem) {
          oItem.batches = this._mapBatches(oItem);
        }, this);

        var aAllBatches = aItems.reduce(function (aAcc, oItem) {
          return aAcc.concat(oItem.batches);
        }, []);

        return {
          reservationNumber: oHeader.reservationNumber || "",
          plant: oHeader.plant || "",
          issueStorgaeLoc: oHeader.issueStorgaeLoc || "",
          receivingStorgaeLoc: oHeader.receivingStorgaeLoc || "",
          items: aItems,
          // Not shown until the user clicks "Batch Info" on an item row.
          allBatches: [],
          canSubmit: true,
          _allBatchesFull: aAllBatches,
        };
      },

      // ─────────────────────────────────────────────────────────────
      // BATCH
      // ─────────────────────────────────────────────────────────────

      /**
       * Maps the item's npToBatch results into the batch shape used by the
       * flat all-batches table. Item context (item no, material, desc) is
       * attached directly onto each batch object so the flat table can
       * show it, and so submitting the transfer can group batches back by
       * item without needing a separate lookup.
       */
      _mapBatches: function (oItem) {
        var aBatches = (oItem.npToBatch && oItem.npToBatch.results) || [];
        return aBatches.map(function (oBatch) {
          return {
            batchNo: oBatch.batch || "",
            splitQty: oBatch.splitQty || "0",
            availableQty: oBatch.availableQty || "0",
            unit: oBatch.unit || "",
            reservationItemNo: oItem.reservationItemNo,
            material: oItem.material,
            materialDesc: oItem.materialDesc,
            bags: [],
          };
        });
      },

      /**
       * Writes the typed value into the model on every keystroke (Input's
       * value binding only updates on "change"/blur otherwise), and
       * prevents split qty from exceeding the batch's available qty.
       */
      onSplitQtyChange: function (oEvent) {
        var oInput = oEvent.getSource();
        var oBatchContext = oInput.getBindingContext("materialsModel");
        var oModel = oBatchContext.getModel();
        var sBatchPath = oBatchContext.getPath();
        var oBatch = oModel.getProperty(sBatchPath);

        var fAvailable = parseFloat(oBatch.availableQty) || 0;
        var sEntered = oEvent.getParameter("value");
        var fEntered = parseFloat(sEntered) || 0;

        if (fEntered > fAvailable) {
          MessageToast.show(
            "Split qty cannot be more than available qty (" + fAvailable + ").",
          );
          sEntered = String(fAvailable);
          oInput.setValue(sEntered);
        }

        oModel.setProperty(sBatchPath + "/splitQty", sEntered);
      },

      /**
       * Filters the flat batches table by item no, material, or
       * description as the user types. Filters against the reservation's
       * full cached batch list (_allBatchesFull) so repeated searches
       * (including clearing the field) always work off the complete set.
       */
      onBatchSearch: function (oEvent) {
        var oContext = oEvent.getSource().getBindingContext("materialsModel");
        var oModel = oContext.getModel();
        var sPath = oContext.getPath();
        var oReservation = oModel.getProperty(sPath);
        var sQuery = (oEvent.getParameter("newValue") || "")
          .trim()
          .toUpperCase();

        var aFull = oReservation._allBatchesFull || [];
        var aFiltered = sQuery
          ? aFull.filter(function (oBatch) {
              return (
                (oBatch.reservationItemNo || "")
                  .toUpperCase()
                  .indexOf(sQuery) !== -1 ||
                (oBatch.material || "").toUpperCase().indexOf(sQuery) !== -1 ||
                (oBatch.materialDesc || "").toUpperCase().indexOf(sQuery) !== -1
              );
            })
          : aFull;

        oModel.setProperty(sPath + "/allBatches", aFiltered);
      },

      onItemSelectionChange: function () {
        this._refreshSubmitState();
      },

      /**
       * Submit Issue is disabled while any ticked item has a pending qty
       * of 0 or less (canSubmit on the reservation).
       */
      _refreshSubmitState: function () {
        var oTable = this.getView().findAggregatedObjects(
          true,
          function (oControl) {
            return (
              oControl.isA("sap.m.Table") && oControl.hasStyleClass("itemsTable")
            );
          },
        )[0];
        var oContext = oTable && oTable.getBindingContext("materialsModel");
        if (!oContext) {
          return;
        }

        var bBlocked = oTable
          .getSelectedContexts("materialsModel")
          .some(function (oItemContext) {
            return !(parseFloat(oItemContext.getObject().pendingQty) > 0);
          });
        oContext.getModel().setProperty(oContext.getPath() + "/canSubmit", !bBlocked);
      },

      /**
       * Triggered by the "Batch Info" button on an item row in the top
       * table. Filters the Batches panel's table down to just that item's
       * batches, and syncs the batch search field to reflect the filter.
       */
      onShowItemBatches: function (oEvent) {
        var oButton = oEvent.getSource();
        var oItemContext = oButton.getBindingContext("materialsModel");
        var oModel = oItemContext.getModel();
        var oItem = oItemContext.getObject();

        var sReservationPath = oItemContext
          .getPath()
          .replace(/\/items\/\d+$/, "");
        var oReservation = oModel.getProperty(sReservationPath);

        var aFull = oReservation._allBatchesFull || [];
        var aFiltered = aFull.filter(function (oBatch) {
          return oBatch.reservationItemNo === oItem.reservationItemNo;
        });

        oModel.setProperty(sReservationPath + "/allBatches", aFiltered);

        if (!aFiltered.length) {
          MessageToast.show(
            "No batches available for item " + oItem.reservationItemNo + ".",
          );
        }

        var oSearchField = this.getView().findAggregatedObjects(
          true,
          function (oControl) {
            return oControl.isA("sap.m.SearchField");
          },
        )[0];
        if (oSearchField) {
          oSearchField.setValue(oItem.reservationItemNo);
        }
      },

      /**
       * Sums the filled-in split qty per item across the batches currently
       * displayed in the Batches panel (i.e. respects the active "Batch
       * Info" item filter and search filter) and writes each item's total
       * back as its target qty. Items with no batches in the current view
       * are left untouched. Rejects the whole save if any individual split
       * qty exceeds its batch's available qty, or if an item's total
       * exceeds its required qty.
       */
      onSaveBatchDraft: function (oEvent) {
        var oContext = oEvent.getSource().getBindingContext("materialsModel");
        var oModel = oContext.getModel();
        var sReservationPath = oContext.getPath();
        var oReservation = oModel.getProperty(sReservationPath);
        var aFullBatches = oReservation.allBatches || [];

        var oGroups = {};
        aFullBatches.forEach(function (oBatch) {
          (
            oGroups[oBatch.reservationItemNo] ||
            (oGroups[oBatch.reservationItemNo] = [])
          ).push(oBatch);
        });

        var oOverBatch = aFullBatches.find(function (oBatch) {
          return (
            (parseFloat(oBatch.splitQty) || 0) >
            (parseFloat(oBatch.availableQty) || 0)
          );
        });

        if (oOverBatch) {
          MessageBox.error(
            "Split qty for batch " +
              oOverBatch.batchNo +
              " cannot exceed its available qty (" +
              oOverBatch.availableQty +
              ").",
            { title: "Invalid Split Qty" },
          );
          return;
        }

        var aItemsByNo = {};
        (oReservation.items || []).forEach(function (oItem) {
          aItemsByNo[oItem.reservationItemNo] = oItem;
        });

        var oAppModelState = this.getView().getModel("appModel");
        var oOverItem = Object.keys(oGroups)
          .map(function (sItemNo) {
            var fTotal = oGroups[sItemNo].reduce(function (fSum, oBatch) {
              return fSum + (parseFloat(oBatch.splitQty) || 0);
            }, 0);
            var oItem = aItemsByNo[sItemNo] || {};
            return {
              reservationItemNo: sItemNo,
              total: fTotal,
              required: parseFloat(oItem.requirementQty) || 0,
            };
          })
          .find(function (oGroupTotal) {
            // In scan mode bags can't be split, so overshoot is allowed.
            return (
              !oAppModelState.getProperty("/scanRequired") &&
              oGroupTotal.total > oGroupTotal.required
            );
          });

        if (oOverItem) {
          MessageBox.error(
            "Total split qty (" +
              oOverItem.total +
              ") for item " +
              oOverItem.reservationItemNo +
              " cannot exceed its required qty (" +
              oOverItem.required +
              ").",
            { title: "Invalid Split Qty" },
          );
          return;
        }

        Object.keys(oGroups).forEach(function (sItemNo) {
          var fTotal = oGroups[sItemNo].reduce(function (fSum, oBatch) {
            return fSum + (parseFloat(oBatch.splitQty) || 0);
          }, 0);
          var iItemIndex = (oReservation.items || []).findIndex(
            function (oItem) {
              return oItem.reservationItemNo === sItemNo;
            },
          );
          if (iItemIndex !== -1) {
            oModel.setProperty(
              sReservationPath + "/items/" + iItemIndex + "/targetQty",
              String(fTotal),
            );
          }
        });

        MessageToast.show("Target qty updated for all items.");
      },

      // ─────────────────────────────────────────────────────────────
      // FORMATTERS
      // ─────────────────────────────────────────────────────────────

      /**
       * Formats a quantity with Indian digit grouping and up to 3 decimals
       * (e.g. "100000" -> "1,00,000", "247.000" -> "247").
       */
      formatQty: function (vQty) {
        if (vQty === null || vQty === undefined || vQty === "") {
          return "";
        }
        var fQty = parseFloat(vQty);
        if (isNaN(fQty)) {
          return String(vQty);
        }
        return fQty.toLocaleString("en-IN", { maximumFractionDigits: 3 });
      },

      /**
       * Strips leading zeros from a reservation number and prepends a
       * label for display (e.g. "0000367766" -> "Reservation No: 367766").
       */
      formatReservationNumber: function (sReservationNumber) {
        return (
          "Reservation No: " +
          (sReservationNumber || "").replace(/^0+(?=\d)/, "")
        );
      },

      /**
       * Triggered by the header's reservation-number Input (submit / Enter)
       * or the "Apply" Button next to it.
       */
      onApplyReservationSearch: function () {
        var oAppModel = this.getView().getModel("appModel");
        var sQuery = (
          oAppModel.getProperty("/reservationNoInput") || ""
        ).trim();

        if (!sQuery) {
          MessageToast.show("Please enter a reservation number to search.");
          return;
        }

        this._fetchReservationByNumber(sQuery);
      },

      /**
       * Value help for the reservation number filter. Loads the open
       * reservations from the F4 API and lets the user pick one.
       * GET /api/f4/issue_create/reservations_open
       */
      onReservationValueHelp: function () {
        var that = this;
        var oCookies = this._parseCookies();
        var sUrl =
          Base_url +
          "/api/f4/issue_create/reservations_open?empid=" +
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
            console.log("F4 reservations_open response:", oResponse);
            that._openValueHelpDialog(
              "Select Reservation",
              oResponse,
              /^key$/i,
              function (sValue) {
                that
                  .getView()
                  .getModel("appModel")
                  .setProperty("/reservationNoInput", sValue);
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

      /**
       * Generic value help dialog for an F4 API response. Rows are shown
       * with the key field (first field matching rKeyField, else the first
       * field) as title and the remaining fields as description; fnOnSelect
       * receives the key field's value.
       */
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
          search: function (oEvent) {
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
          },
          confirm: function (oEvent) {
            var oItem = oEvent.getParameter("selectedItem");
            if (oItem) {
              fnOnSelect(oItem.getBindingContext("vh").getProperty("key"));
            }
          },
          liveChange: function (oEvent) {
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
       * Opens a camera scanning dialog (QR + standard barcodes) using the
       * html5-qrcode/ZXing library loaded from CDN in index.html. Scans
       * once only: on the first successful decode the scanner is stopped
       * immediately. Expects the decoded payload to be JSON containing a
       * "Reservation No" key (e.g. {"Reservation No":"676776"}); on a
       * match, closes the dialog and auto-applies that reservation number
       * (same as typing it in and pressing Apply). On any other decoded
       * shape, shows an error and stops scanning without applying anything.
       */
      onScanReservation: function () {
        var that = this;

        this._openScanner("Scan Reservation QR / Barcode", function (sText) {
          var oMatch = /Reservation\s*No\s*-\s*(\S+)/i.exec(sText || "");
          var sReservationNo = oMatch ? oMatch[1].trim() : "";

          if (!sReservationNo) {
            MessageBox.error("invalid qr scanned");
            return;
          }

          that
            .getView()
            .getModel("appModel")
            .setProperty("/reservationNoInput", sReservationNo);
          that._fetchReservationByNumber(sReservationNo);
        });
      },

      /**
       * Scan button in the Batches panel header. For now it only logs the
       * decoded data to the console.
       */
      onScanBatch: function (oEvent) {
        var that = this;
        var oReservation = oEvent
          .getSource()
          .getBindingContext("materialsModel")
          .getObject();
        var sRsnum = oReservation.reservationNumber;

        // Item no is known only when the panel shows a single item's
        // batches (via "Batch Info"); otherwise it is sent blank and the
        // bag is matched by material + batch from the response.
        var aItemNos = [];
        (oReservation.allBatches || []).forEach(function (b) {
          if (aItemNos.indexOf(b.reservationItemNo) === -1) {
            aItemNos.push(b.reservationItemNo);
          }
        });
        var sRspos = aItemNos.length === 1 ? aItemNos[0] : " ";

        this._openScanner("Scan Batch QR / Barcode", function (sText) {
          console.log("Batch scan decoded data:", sText);

          // e.g. "SNo  : 2610910100000545,Bth  : IBATCH-4,VenBth  : ..."
          var oMatch = /SNo\s*:\s*([^,\s]+)/i.exec(sText || "");
          if (!oMatch) {
            MessageBox.error("invalid qr scanned");
            return;
          }

          that._verifyScan(oMatch[1].trim(), sRsnum, sRspos, oReservation);
        });
      },

      /**
       * Opens the scanned-bags dialog for the batch row whose bag button
       * was pressed.
       */
      onShowBags: function (oEvent) {
        var that = this;
        var oContext = oEvent.getSource().getBindingContext("materialsModel");

        Fragment.load({
          name: "materialissue.fragment.BagsDialog",
          controller: this,
        }).then(function (oDialog) {
          that.getView().addDependent(oDialog);
          oDialog.setBindingContext(oContext, "materialsModel");
          oDialog.open();
          that._oBagsDialog = oDialog;
        });
      },

      onCloseBagsDialog: function () {
        this._oBagsDialog.close();
        this._oBagsDialog.destroy();
        this._oBagsDialog = null;
      },

      /**
       * Handles a verifyScanCheck response. If Ok is "X", finds the batch
       * (by Charg) under the scanned item and records the bag on it.
       */
      _addScannedBag: function (oRes, sItemNo, oReservation) {
        if (oRes.Ok !== "X") {
          MessageBox.error(oRes.Message || "Scanned bag is not valid.", {
            title: "Scan Failed",
          });
          return;
        }

        var sItem = (sItemNo || "").trim();
        var oBatch = (oReservation._allBatchesFull || []).find(function (b) {
          return (
            b.batchNo === oRes.Charg &&
            b.material === oRes.Matnr &&
            (!sItem || b.reservationItemNo === sItem)
          );
        });

        if (!oBatch) {
          MessageBox.error(
            "Scanned bag (material " +
              oRes.Matnr +
              ", batch " +
              oRes.Charg +
              ") does not match any batch" +
              (sItem ? " of item " + sItem : "") +
              ".",
            { title: "Scan Failed" },
          );
          return;
        }

        var aAllBatches = oReservation._allBatchesFull || [];
        var bDuplicate = aAllBatches.some(function (b) {
          return b.bags.some(function (oBag) {
            return oBag.qrNo === oRes.QrNo;
          });
        });
        if (bDuplicate) {
          MessageToast.show("Bag " + oRes.QrNo + " is already scanned.");
          return;
        }

        // A bag can't be split, so an item's total may go over its pending
        // qty, but only once: block further bags once pending is reached.
        var oItem = (oReservation.items || []).find(function (i) {
          return i.reservationItemNo === oBatch.reservationItemNo;
        });
        var fItemTotal = aAllBatches
          .filter(function (b) {
            return b.reservationItemNo === oBatch.reservationItemNo;
          })
          .reduce(function (fSum, b) {
            return fSum + (parseFloat(b.splitQty) || 0);
          }, 0);
        var fPending = oItem ? parseFloat(oItem.pendingQty) || 0 : 0;
        if (fItemTotal >= fPending) {
          MessageBox.error(
            "Pending qty (" +
              fPending +
              ") is already reached for item " +
              oBatch.reservationItemNo +
              ". No more bags can be scanned.",
            { title: "Scan Failed" },
          );
          return;
        }

        var fNewBatchQty =
          (parseFloat(oBatch.splitQty) || 0) + (parseFloat(oRes.Qty) || 0);
        if (fNewBatchQty > (parseFloat(oBatch.availableQty) || 0)) {
          MessageBox.error(
            "Batch " +
              oBatch.batchNo +
              " has only " +
              oBatch.availableQty +
              " available. Cannot add this bag.",
            { title: "Scan Failed" },
          );
          return;
        }

        oBatch.bags.push({
          seq: oBatch.bags.length + 1,
          qrNo: oRes.QrNo,
          qty: oRes.Qty,
          unit: oRes.Meins,
          status: oRes.LblStatus,
        });
        oBatch.splitQty = this._sumBagQty(oBatch);
        this.getView().getModel("materialsModel").refresh(true);
        MessageToast.show(
          "Bag " + oRes.QrNo + " added to batch " + oRes.Charg + ".",
        );
      },

      /** Total qty of a batch's scanned bags, as a trimmed string. */
      _sumBagQty: function (oBatch) {
        var fSum = (oBatch.bags || []).reduce(function (f, oBag) {
          return f + (parseFloat(oBag.qty) || 0);
        }, 0);
        return String(parseFloat(fSum.toFixed(3)));
      },

      /**
       * "Scan Required" switch. When turned on, split qty of every batch is
       * reset to the sum of its scanned bags (0 if none) and becomes
       * read-only; it then only changes by scanning / deleting bags.
       */
      onScanRequiredChange: function (oEvent) {
        var bOn = oEvent.getParameter("state");
        var oModel = this.getView().getModel("materialsModel");

        if (bOn) {
          (oModel.getProperty("/reservations") || []).forEach(function (oRes) {
            (oRes._allBatchesFull || []).forEach(function (oBatch) {
              oBatch.splitQty = this._sumBagQty(oBatch);
            }, this);
          }, this);
          oModel.refresh(true);
        }
      },

      /**
       * Removes a scanned bag (frontend only) and subtracts its qty from
       * the batch's split qty.
       */
      onDeleteBag: function (oEvent) {
        var oContext = oEvent.getSource().getBindingContext("materialsModel");
        var oModel = oContext.getModel();
        var sBagPath = oContext.getPath();
        var iIndex = parseInt(sBagPath.split("/").pop(), 10);
        var sBatchPath = sBagPath.replace(/\/bags\/\d+$/, "");
        var oBatch = oModel.getProperty(sBatchPath);

        oBatch.bags.splice(iIndex, 1);
        oBatch.bags.forEach(function (oBag, i) {
          oBag.seq = i + 1;
        });
        oBatch.splitQty = this._sumBagQty(oBatch);
        oModel.refresh(true);
        MessageToast.show("Bag removed.");
      },

      /**
       * Calls verifyScanCheck for a scanned serial number (SNo) and logs
       * the payload and response.
       */
      _verifyScan: function (sQrNo, sRsnum, sRspos, oReservation) {
        var that = this;
        var oCookies = this._parseCookies();
        var oPayload = {
          QrNo: sQrNo,
          Action: "ISSUE",
          Rsnum: sRsnum,
          Rspos: sRspos,
          Empid: oCookies["employeeId"] || "",
          Sesid: oCookies["sessionId"] || "",
          Werks: oCookies["plant"] || "",
        };

        console.log("verifyScanCheck payload:", JSON.stringify(oPayload));
        sap.ui.core.BusyIndicator.show(0);

        $.ajax({
          url: Base_url + "/api/materials/verifyScanCheck",
          method: "POST",
          headers: ngrokHeaders,
          contentType: "application/json",
          data: JSON.stringify(oPayload),
          success: function (oResponse) {
            console.log("verifyScanCheck response:", oResponse);
            that._addScannedBag(
              oResponse.response || oResponse,
              sRspos,
              oReservation,
            );
          },
          error: function (xhr) {
            console.log("verifyScanCheck error:", xhr.responseText);
            var sMessage = "Scan verification failed.";
            try {
              var oError = JSON.parse(xhr.responseText);
              var oDetail = oError.error && oError.error.error;
              sMessage =
                (oDetail && oDetail.message && oDetail.message.value) ||
                oError.message ||
                sMessage;
            } catch (e) {
              /* keep default */
            }
            MessageBox.error(sMessage, { title: "Scan Failed" });
          },
          complete: function () {
            sap.ui.core.BusyIndicator.hide();
          },
        });
      },

      /**
       * Opens the camera scanner dialog, scans once, stops, closes the
       * dialog and then calls fnOnDecoded(sDecodedText).
       */
      _openScanner: function (sTitle, fnOnDecoded) {
        if (typeof Html5Qrcode === "undefined") {
          MessageBox.error(
            "QR scanner library failed to load. Please check your internet connection and try again.",
          );
          return;
        }

        var sReaderId = "qrScanReader";
        var oScannerDialog = new Dialog({
          title: sTitle,
          contentWidth: "360px",
          showHeader: true,
          content: [
            new HTML({
              content: "<div id='" + sReaderId + "' style='width:100%;'></div>",
            }),
          ],
          beginButton: new Button({
            text: "Cancel",
            press: function () {
              oScannerDialog.close();
            },
          }),
          afterClose: function () {
            oScannerDialog.destroy();
          },
        });

        var oHtml5Qrcode;
        var bStopped = false;

        function stopScanner() {
          if (bStopped || !oHtml5Qrcode) {
            return Promise.resolve();
          }
          bStopped = true;
          return oHtml5Qrcode.stop().catch(function () {
            /* ignore stop errors */
          });
        }

        oScannerDialog.attachAfterOpen(function () {
          oHtml5Qrcode = new Html5Qrcode(sReaderId, {
            formatsToSupport: [
              Html5QrcodeSupportedFormats.QR_CODE,
              Html5QrcodeSupportedFormats.CODE_128,
              Html5QrcodeSupportedFormats.EAN_13,
              Html5QrcodeSupportedFormats.EAN_8,
              Html5QrcodeSupportedFormats.CODE_39,
              Html5QrcodeSupportedFormats.UPC_A,
              Html5QrcodeSupportedFormats.UPC_E,
            ],
            verbose: false,
          });

          oHtml5Qrcode
            .start(
              { facingMode: "environment" },
              {
                fps: 10,
                qrbox: { width: 250, height: 150 },
              },
              function onScanSuccess(sDecodedText) {
                if (bStopped) {
                  return;
                }

                console.log("QR/Barcode scanner decoded:", sDecodedText);

                stopScanner().then(function () {
                  oScannerDialog.close();
                  fnOnDecoded(sDecodedText);
                });
              },
              function onScanFailure() {
                /* fires continuously while no code is found; ignore */
              },
            )
            .catch(function () {
              MessageBox.error(
                "Could not access the camera. Please check camera permissions and try again.",
              );
              oScannerDialog.close();
            });
        });

        oScannerDialog.attachAfterClose(function () {
          stopScanner();
        });

        oScannerDialog.open();
      },

      /**
       * Fetches a single reservation by number from the backend and shows
       * only that reservation. Passing an empty string restores the full
       * cached reservation list. Also merges the result into
       * _aAllReservations so it stays available if the user clears the
       * search afterwards. Uses the appModel banner (showBanner/bannerText/
       * bannerType) to surface not-found/error states, same as the "no
       * reservation param" banner shown on initial load.
       */
      _fetchReservationByNumber: function (sQuery) {
        var that = this;
        var oModel = this.getView().getModel("materialsModel");
        var oAppModel = this.getView().getModel("appModel");

        if (!sQuery) {
          oModel.setProperty("/searchQuery", "");
          oModel.setProperty("/reservations", this._aAllReservations || []);
          oAppModel.setProperty("/showBanner", false);
          return;
        }

        var oCookies = this._parseCookies();
        var sUrl =
          Base_url +
          "/api/materials/getReservationByNumber/" +
          (oCookies["employeeId"] || "") +
          "/" +
          (oCookies["plant"] || "") +
          "/" +
          (oCookies["sessionId"] || "") +
          "/" +
          sQuery;

        this.byId("dynamicPage").setBusy(true);

        $.ajax({
          url: sUrl,
          method: "GET",
          headers: ngrokHeaders,
          contentType: "application/json",
          success: function (oResponse) {
            var vHeaders = oResponse.results || oResponse.result || oResponse;
            var aHeaders = Array.isArray(vHeaders) ? vHeaders : [vHeaders];
            aHeaders = aHeaders.filter(Boolean);

            if (!aHeaders.length) {
              oModel.setProperty("/searchQuery", sQuery);
              oModel.setProperty("/reservations", []);
              oAppModel.setProperty("/showBanner", true);
              oAppModel.setProperty(
                "/bannerText",
                "Reservation number '" + sQuery + "' is not available.",
              );
              oAppModel.setProperty("/bannerType", "Error");
              return;
            }

            var aReservations = aHeaders.map(this._mapReservationHeader, this);

            aReservations.forEach(function (oReservation) {
              var aAll =
                that._aAllReservations || (that._aAllReservations = []);
              var iExisting = aAll.findIndex(function (oExisting) {
                return (
                  oExisting.reservationNumber === oReservation.reservationNumber
                );
              });
              if (iExisting !== -1) {
                aAll[iExisting] = oReservation;
              } else {
                aAll.push(oReservation);
              }
            });

            oModel.setProperty("/searchQuery", sQuery);
            oModel.setProperty("/reservations", aReservations);
            oAppModel.setProperty("/showBanner", false);
          }.bind(this),
          error: function () {
            oModel.setProperty("/searchQuery", sQuery);
            oModel.setProperty("/reservations", []);
            oAppModel.setProperty("/showBanner", true);
            oAppModel.setProperty(
              "/bannerText",
              "Reservation number '" + sQuery + "' is not available.",
            );
            oAppModel.setProperty("/bannerType", "Error");
            MessageToast.show("Could not find reservation " + sQuery + ".");
          },
          complete: function () {
            this.byId("dynamicPage").setBusy(false);
          }.bind(this),
        });
      },

      /**
       * Builds the transfer payload for a reservation from the selected
       * flat batch rows (each row carries reservationItemNo/material from
       * _mapBatches). Groups the selected batches back by item number,
       * using oReservation.items for the item-level fields (issue/receiving
       * loc, target qty, units). Batches with a split qty of 0 are dropped;
       * an item group left with no qualifying batch is dropped entirely
       * (reported back so the caller can inform the user before submitting).
       */
      _buildTransferPayload: function (oReservation, aSelectedBatches) {
        var oCookies = this._parseCookies();
        var aSkippedItems = [];
        var bScanRequired = !!this.getView()
          .getModel("appModel")
          .getProperty("/scanRequired");

        var oItemsByNo = {};
        (oReservation.items || []).forEach(function (oItem) {
          oItemsByNo[oItem.reservationItemNo] = oItem;
        });

        var oGroups = {};
        aSelectedBatches.forEach(function (oBatch) {
          var sKey = oBatch.reservationItemNo;
          (oGroups[sKey] || (oGroups[sKey] = [])).push(oBatch);
        });

        var aNpToItem = Object.keys(oGroups)
          .map(function (sItemNo) {
            var oItem = oItemsByNo[sItemNo] || {};
            var aGroupBatches = oGroups[sItemNo];

            var aNpToBatch = aGroupBatches
              .filter(function (oBatch) {
                return (parseFloat(oBatch.splitQty) || 0) > 0;
              })
              .map(function (oBatch) {
                return {
                  reservationNumber: oReservation.reservationNumber,
                  reservationItemNo: sItemNo,
                  batch: oBatch.batchNo,
                  splitQty: oBatch.splitQty,
                  unit: oBatch.unit,
                  NpToPack: (bScanRequired ? oBatch.bags || [] : []).map(
                    function (oBag) {
                      return {
                        QrNo: oBag.qrNo,
                        Qty: oBag.qty,
                        Meins: oBag.unit,
                      };
                    },
                  ),
                };
              });

            if (!aNpToBatch.length) {
              var oSampleBatch = aGroupBatches[0];
              aSkippedItems.push({
                reservationItemNo: sItemNo,
                material: oSampleBatch.material,
                materialDesc: oSampleBatch.materialDesc,
              });
              return null;
            }

            return {
              reservationItemNo: sItemNo,
              reservationNumber: oReservation.reservationNumber,
              material: oItem.material,
              issueStorageLoc: oItem.issueStorageLoc,
              receivingStorageLoc: oItem.receivingStorageLoc,
              targetQty: oItem.targetQty,
              units: oItem.units,
              npToBatch: aNpToBatch,
            };
          })
          .filter(Boolean);

        var oPayload = {
          reservationNumber: oReservation.reservationNumber,
          employeeId: oCookies["employeeId"] || "",
          sessionId: oCookies["sessionId"] || "",
          plant: oCookies["plant"] || "",
          npToItem: aNpToItem,
        };

        return { payload: oPayload, skippedItems: aSkippedItems };
      },

      onSubmitIssue: function (oEvent) {
        var that = this;
        var oButton = oEvent.getSource();
        var oReservation = oButton
          .getBindingContext("materialsModel")
          .getObject();

        var oItemsTable = this.getView().findAggregatedObjects(
          true,
          function (oControl) {
            return (
              oControl.isA("sap.m.Table") &&
              oControl.hasStyleClass("itemsTable")
            );
          },
        )[0];

        var aSelectedItems = oItemsTable
          .getSelectedContexts("materialsModel")
          .map(function (oContext) {
            return oContext.getObject();
          });

        if (!aSelectedItems.length) {
          MessageBox.warning(
            "Select at least one item (with batches) to submit for transfer.",
          );
          return;
        }

        var oUnallocatedItem = aSelectedItems.find(function (oItem) {
          return (parseFloat(oItem.targetQty) || 0) === 0;
        });

        if (oUnallocatedItem) {
          MessageBox.warning(
            "Batch allocation is not done for item " +
              oUnallocatedItem.reservationItemNo +
              " (" +
              oUnallocatedItem.material +
              " - " +
              oUnallocatedItem.materialDesc +
              "). Can't submit.",
          );
          return;
        }

        var aSelectedBatches = aSelectedItems.reduce(function (aAcc, oItem) {
          return aAcc.concat(oItem.batches || []);
        }, []);

        var oBuild = this._buildTransferPayload(oReservation, aSelectedBatches);
        var oPayload = oBuild.payload;
        var aSkippedItems = oBuild.skippedItems;

        if (!oPayload.npToItem.length) {
          MessageBox.warning(
            "No items have a batch with a split qty greater than 0. Nothing to submit.",
          );
          return;
        }

        var sSkippedText = aSkippedItems.length
          ? aSkippedItems
              .map(function (oSkipped) {
                return (
                  "Item " +
                  oSkipped.reservationItemNo +
                  " (" +
                  oSkipped.material +
                  " - " +
                  oSkipped.materialDesc +
                  ") has no batch selected and will be skipped."
                );
              })
              .join("\n")
          : "";

        var sConfirmText =
          "Reservation: " +
          oPayload.reservationNumber +
          "\nEmployee: " +
          oPayload.employeeId +
          "\nPlant: " +
          oPayload.plant +
          "\nItems to submit: " +
          oPayload.npToItem.length +
          (sSkippedText ? "\n\n" + sSkippedText : "");

        MessageBox.confirm(sConfirmText, {
          title: "Confirm Transfer Submission",
          onClose: function (sAction) {
            if (sAction !== MessageBox.Action.OK) {
              return;
            }

            console.log(
              "Material transfer payload:",
              JSON.stringify(oPayload, null, 2),
            );
            that._postTransfer(
              oPayload,
              oButton,
              oReservation.reservationNumber,
            );
          },
        });
      },

      _postTransfer: function (oPayload, oButton, sReservationNumber) {
        var that = this;
        oButton.setBusy(true);
        sap.ui.core.BusyIndicator.show(0);

        $.ajax({
          url: Base_url + "/api/materials/transferMaterials",
          method: "POST",
          headers: ngrokHeaders,
          contentType: "application/json",
          data: JSON.stringify(oPayload),
          success: function (oResponse) {
            var sMessage = "Material transfer submitted successfully.";
            try {
              var oMsg =
                typeof oResponse.message === "string"
                  ? JSON.parse(oResponse.message)
                  : oResponse.message;
              if (oMsg && oMsg.message) {
                sMessage = oMsg.message;
              }
            } catch (e) {
              /* keep default */
            }

            // e.g. "Document 4904980168 - 2026 has been created successfully."
            var oDocMatch = /Document\s+(\S+)\s*-\s*(\d{4})/.exec(sMessage);
            var sMaterialDoc = oDocMatch ? oDocMatch[1] : "";
            var sMaterialDocYear = oDocMatch ? oDocMatch[2] : "";

            var aButtons = [];
            if (sMaterialDoc && sMaterialDocYear) {
              aButtons.push(
                new Button({
                  text: "Print Slip",
                  type: "Success",
                  icon: "sap-icon://print",
                  press: function () {
                    window.open(
                      IssueSlip_Url +
                        "?doctype=issue&materialDoc=" +
                        sMaterialDoc +
                        "&materialDocYear=" +
                        sMaterialDocYear,
                      "_blank",
                    );
                  },
                }),
              );
            }
            aButtons.push(
              new Button({
                text: "OK",
                type: "Emphasized",
                press: function () {
                  oSuccessDialog.close();
                  that._fetchReservationByNumber(sReservationNumber);
                },
              }),
            );

            var oSuccessDialog = new Dialog({
              title: "Issue Submitted",
              type: "Message",
              state: "Success",
              content: new Text({ text: sMessage }),
              buttons: aButtons,
              afterClose: function () {
                oSuccessDialog.destroy();
              },
            });
            oSuccessDialog.open();
          },
          error: function (xhr) {
            var sMessage = "Failed to submit transfer. Please try again.";
            try {
              var oError = JSON.parse(xhr.responseText);
              var oErrorDetail = oError.error && oError.error.error;

              if (oErrorDetail) {
                var sMain = oErrorDetail.message && oErrorDetail.message.value;
                var aDetails =
                  (oErrorDetail.innererror &&
                    oErrorDetail.innererror.errordetails) ||
                  [];
                var aErrorMsgs = aDetails
                  .filter(function (d) {
                    return d.severity === "error" && d.message;
                  })
                  .map(function (d) {
                    return d.message;
                  });

                sMessage = sMain || sMessage;
                if (aErrorMsgs.length) {
                  sMessage += "\n\n" + aErrorMsgs.join("\n");
                }
              } else if (oError.message) {
                sMessage = oError.message;
              }
            } catch (e) {
              /* non-JSON response, keep default message */
            }
            MessageBox.error(sMessage, { title: "Transfer Failed" });
          },
          complete: function () {
            oButton.setBusy(false);
            sap.ui.core.BusyIndicator.hide();
          },
        });
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
