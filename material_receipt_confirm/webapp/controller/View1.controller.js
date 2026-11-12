sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/m/Text",
    "sap/ui/core/HTML",
    "sap/m/MessageBox",
    "sap/m/MessageToast",
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
    MessageBox,
    MessageToast,
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

    // Localhost URLs
    const Login_Url = "http://localhost:9000/index.html";
    const Print_Slip_Url = "http://localhost:9011/index.html";
    const Confirmation_List_Url = "http://localhost:9012/index.html";

    // Internal URLs(61)
    // const Login_Url = "https://romsonsfiori.incresol.com/LoginApp/index.html";
    // const Print_Slip_Url =
    //   "https://romsonsfiori.incresol.com/DocumentCenter/index.html";
    // const Confirmation_List_Url =
    //   "https://romsonsfiori.incresol.com/ConfirmationList/index.html";

    // Production URLs(136)
    // const Login_Url = "https://webapps.romsons.com/LoginApp/index.html";
    // const Print_Slip_Url =
    //   "https://webapps.romsons.com/DocumentCenter/index.html";
    // const Confirmation_List_Url =
    //   "https://webapps.romsons.com/ConfirmationList/index.html";

    const ngrokHeaders = {
      "ngrok-skip-browser-warning": "69420",
    };

    return Controller.extend("materialreceiptconfirm.controller.View1", {
      // ─────────────────────────────────────────────────────────────
      // LIFECYCLE
      // ─────────────────────────────────────────────────────────────
      onInit: function () {
        this.getView().attachAfterRendering(
          function () {
            var sImageUrl = sap.ui.require.toUrl(
              "materialreceiptconfirm/images/logoNew.svg",
            );
            var oImage = this.byId("logoImage");
            if (oImage) {
              oImage.setSrc(sImageUrl);
            }
          }.bind(this),
        );

        this.getView().setModel(
          new JSONModel({
            employeeId: "",
            plant: "",
            orderId: "",
            orderIdInput: "",
            navType: "",
            scanRequired: false,
            materialDocId: "",
            materialDocYearId: "",
            materialDocInput: "",
            materialDocYearInput: "",
          }),
          "appModel",
        );

        this.getView().setModel(
          new JSONModel({
            orderDetails: {},
            issues: [],
          }),
          "issueModel",
        );

        this.getView().setModel(
          new JSONModel({
            header: {},
            issueItems: [],
            receipts: [],
            hasSelection: false,
          }),
          "matDocModel",
        );

        setTimeout(
          function () {
            var oCookies = this._parseCookies();
            this._sOrderId = this._getQueryParam("order");
            this._sMaterialDoc = this._getQueryParam("materialDoc");
            this._sMaterialDocYear = this._getQueryParam("materialDocYear");
            this._sNavType = this._getQueryParam("navType");

            var oAppModel = this.getView().getModel("appModel");
            oAppModel.setProperty("/employeeId", oCookies["employeeId"] || "");
            oAppModel.setProperty("/plant", oCookies["plant"] || "");
            oAppModel.setProperty("/navType", this._sNavType || "");
            oAppModel.setProperty("/orderId", this._sOrderId || "");
            oAppModel.setProperty("/orderIdInput", this._sOrderId || "");
            oAppModel.setProperty("/materialDocId", this._sMaterialDoc || "");
            oAppModel.setProperty(
              "/materialDocYearId",
              this._sMaterialDocYear || "",
            );
            oAppModel.setProperty(
              "/materialDocInput",
              this._sMaterialDoc || "",
            );
            oAppModel.setProperty(
              "/materialDocYearInput",
              this._sMaterialDocYear || "",
            );

            if (this._enforceSession()) {
              this._startSessionCheck();

              if (this._sNavType !== "matDoc" && this._sOrderId) {
                this._loadMaterialIssue();
              } else if (
                this._sNavType === "matDoc" &&
                this._sMaterialDoc &&
                this._sMaterialDocYear
              ) {
                this._fetchIssueDetailByDocAndYear(
                  this._sMaterialDoc,
                  this._sMaterialDocYear,
                );
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
       * Triggered by the header's order-number Input (submit / Enter) or
       * the "Apply" Button next to it.
       */
      onApplyOrderSearch: function () {
        var oAppModel = this.getView().getModel("appModel");
        var sQuery = (oAppModel.getProperty("/orderIdInput") || "").trim();

        if (!sQuery) {
          MessageBox.warning("Please enter an order number to search.");
          return;
        }

        this._sOrderId = sQuery;
        oAppModel.setProperty("/orderId", sQuery);
        this._loadMaterialIssue();
      },

      /**
       * Triggered by the header's Material Doc / Doc Year Inputs (submit /
       * Enter) or the "Apply" Button next to them.
       */
      onApplyMatDocSearch: function () {
        var oAppModel = this.getView().getModel("appModel");
        var sMaterialDoc = (
          oAppModel.getProperty("/materialDocInput") || ""
        ).trim();
        var sMaterialDocYear = (
          oAppModel.getProperty("/materialDocYearInput") || ""
        ).trim();

        if (!sMaterialDoc || !sMaterialDocYear) {
          MessageBox.warning(
            "Please enter both material doc and doc year to search.",
          );
          return;
        }

        this._sMaterialDoc = sMaterialDoc;
        oAppModel.setProperty("/materialDocId", sMaterialDoc);
        oAppModel.setProperty("/materialDocYearId", sMaterialDocYear);

        this._fetchIssueDetailByDocAndYear(sMaterialDoc, sMaterialDocYear);
      },

      /**
       * Opens a camera scanning dialog (QR + standard barcodes) using the
       * html5-qrcode/ZXing library loaded from CDN in index.html. Scans
       * once only: on the first successful decode the scanner is stopped
       * immediately. Logs the raw decoded payload, then auto-applies it as
       * an order number search (same as switching to order mode, typing it
       * in, and pressing Apply).
       */
      onScanMatDocOrder: function () {
        var that = this;

        if (typeof Html5Qrcode === "undefined") {
          MessageBox.error(
            "QR scanner library failed to load. Please check your internet connection and try again.",
          );
          return;
        }

        var sReaderId = "matDocQrScanReader";
        var oScannerDialog = new Dialog({
          title: "Scan Order QR / Barcode",
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

                var sMaterialDoc = "";
                var sMaterialDocYear = "";
                var oDocMatch = /Material\s*Doc\s*-\s*(\S+?)(?:,|$)/i.exec(
                  sDecodedText || "",
                );
                var oYearMatch = /Doc\s*Year\s*-\s*(\S+)/i.exec(
                  sDecodedText || "",
                );
                if (oDocMatch) {
                  sMaterialDoc = oDocMatch[1].trim();
                }
                if (oYearMatch) {
                  sMaterialDocYear = oYearMatch[1].trim();
                }

                stopScanner().then(function () {
                  oScannerDialog.close();

                  if (!sMaterialDoc || !sMaterialDocYear) {
                    MessageBox.error("invalid qr scanned");
                    return;
                  }

                  var oAppModel = that.getView().getModel("appModel");
                  oAppModel.setProperty("/navType", "matDoc");
                  oAppModel.setProperty("/materialDocInput", sMaterialDoc);
                  oAppModel.setProperty(
                    "/materialDocYearInput",
                    sMaterialDocYear,
                  );
                  oAppModel.setProperty("/materialDocId", sMaterialDoc);
                  oAppModel.setProperty("/materialDocYearId", sMaterialDocYear);

                  that._sNavType = "matDoc";
                  that._sMaterialDoc = sMaterialDoc;
                  that._sMaterialDocYear = sMaterialDocYear;
                  that._fetchIssueDetailByDocAndYear(
                    sMaterialDoc,
                    sMaterialDocYear,
                  );
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

      // ─────────────────────────────────────────────────────────────
      // VALUE HELP (F4)
      // ─────────────────────────────────────────────────────────────

      /**
       * Value help for the Issue Mat. Doc input: lists open issue docs; the
       * chosen doc fills both the doc and (from key2) the doc year inputs.
       */
      onMatDocValueHelp: function () {
        var oAppModel = this.getView().getModel("appModel");

        this._openValueHelp(
          "Select Issue Material Doc",
          "issue_docs_open",
          function (oValue) {
            oAppModel.setProperty("/materialDocInput", oValue.key);
            if (oValue.key2) {
              oAppModel.setProperty("/materialDocYearInput", oValue.key2);
            }
          },
        );
      },

      /** Value help for the Doc Year input. */
      onMatDocYearValueHelp: function () {
        var oAppModel = this.getView().getModel("appModel");

        this._openValueHelp(
          "Select Doc Year",
          "issue_doc_years",
          function (oValue) {
            oAppModel.setProperty("/materialDocYearInput", oValue.key);
          },
        );
      },

      /**
       * Fetches /api/f4/receipt_confirm/<sHelpId> and shows the values
       * (key / text / info) in a searchable SelectDialog; calls
       * fnOnSelect({key, key2, text, info}) for the picked row.
       */
      _openValueHelp: function (sTitle, sHelpId, fnOnSelect) {
        var oCookies = this._parseCookies();
        var oValuesModel = new JSONModel({ values: [] });

        var oDialog = new SelectDialog({
          title: sTitle,
          items: {
            path: "/values",
            template: new StandardListItem({
              title: "{key}",
              description: "{text}",
              info: "{info}",
            }),
          },
          search: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            oEvent
              .getSource()
              .getBinding("items")
              .filter(
                sValue
                  ? new Filter({
                      filters: [
                        new Filter("key", FilterOperator.Contains, sValue),
                        new Filter("text", FilterOperator.Contains, sValue),
                      ],
                      and: false,
                    })
                  : [],
              );
          },
          confirm: function (oEvent) {
            var oSelected = oEvent.getParameter("selectedItem");
            if (oSelected) {
              fnOnSelect(oSelected.getBindingContext().getObject());
            }
          },
          liveChange: function (oEvent) {
            oEvent.getSource().fireSearch({
              value: oEvent.getParameter("value"),
            });
          },
          afterClose: function () {
            oDialog.destroy();
          },
        });
        oDialog.setModel(oValuesModel);
        this.getView().addDependent(oDialog);
        oDialog.open();
        oDialog.setBusy(true);

        $.ajax({
          url:
            Base_url +
            "/api/f4/receipt_confirm/" +
            sHelpId +
            "?empid=" +
            encodeURIComponent(oCookies["employeeId"] || "") +
            "&sesid=" +
            encodeURIComponent(oCookies["sessionId"] || "") +
            "&plant=" +
            encodeURIComponent(oCookies["plant"] || ""),
          method: "GET",
          headers: ngrokHeaders,
          success: function (oResponse) {
            oValuesModel.setProperty(
              "/values",
              (oResponse && oResponse.values) || [],
            );
          },
          error: function () {
            oDialog.close();
            MessageBox.error(
              "Could not load the value help. Please try again.",
            );
          },
          complete: function () {
            oDialog.setBusy(false);
          },
        });
      },

      // ─────────────────────────────────────────────────────────────
      // BAG SCAN
      // ─────────────────────────────────────────────────────────────

      /**
       * Scan button in the Issue Items header. Reads the bag's serial no
       * (SNo) from the QR, verifies it and adds the bag to the matching
       * issue item (by material + batch).
       */
      onScanBag: function () {
        var that = this;

        this._openScanner("Scan Bag QR / Barcode", function (sText) {
          console.log("Bag scan decoded data:", sText);

          // e.g. "SNo  : 2610910100000545,Bth  : IBATCH-4,VenBth  : ..."
          var oMatch = /SNo\s*:\s*([^,\s]+)/i.exec(sText || "");
          if (!oMatch) {
            MessageBox.error("invalid qr scanned");
            return;
          }

          that._verifyScan(oMatch[1].trim());
        });
      },

      /**
       * Calls verifyScanCheck for a scanned serial number and adds the bag
       * on success.
       */
      _verifyScan: function (sQrNo) {
        var that = this;
        var oHeader =
          this.getView().getModel("matDocModel").getProperty("/header") || {};
        var oCookies = this._parseCookies();
        var oPayload = {
          QrNo: sQrNo,
          Action: "RECEIVE",
          Mjahr: oHeader.materialDocYear || "",
          Mblnr: oHeader.materialDoc || "",
          Aufnr: oHeader.order || "",
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
            that._addScannedBag(oResponse.response || oResponse);
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
       * Handles a verifyScanCheck response. If Ok is "X", finds the issue
       * item (by material + batch) and records the bag on it; the item's
       * target qty becomes the sum of its bags.
       */
      _addScannedBag: function (oRes) {
        if (oRes.Ok !== "X") {
          MessageBox.error(oRes.Message || "Scanned bag is not valid.", {
            title: "Scan Failed",
          });
          return;
        }

        var oModel = this.getView().getModel("matDocModel");
        var aItems = oModel.getProperty("/issueItems") || [];
        var oItem = aItems.find(function (i) {
          return i.batch === oRes.Charg && i.material === oRes.Matnr;
        });

        if (!oItem) {
          MessageBox.error(
            "Scanned bag (material " +
              oRes.Matnr +
              ", batch " +
              oRes.Charg +
              ") does not match any issue item.",
            { title: "Scan Failed" },
          );
          return;
        }

        var bDuplicate = aItems.some(function (i) {
          return i.bags.some(function (oBag) {
            return oBag.qrNo === oRes.QrNo;
          });
        });
        if (bDuplicate) {
          MessageToast.show("Bag " + oRes.QrNo + " is already scanned.");
          return;
        }

        var fMax =
          (parseFloat(oItem.issuedQty) || 0) -
          (parseFloat(oItem.receivedQty) || 0);
        var fNewTotal =
          (parseFloat(this._sumBagQty(oItem)) || 0) +
          (parseFloat(oRes.Qty) || 0);
        if (fNewTotal > fMax) {
          MessageBox.error(
            "Item " +
              oItem.materialDocItem +
              " has only " +
              fMax +
              " pending to receive. Cannot add this bag.",
            { title: "Scan Failed" },
          );
          return;
        }

        oItem.bags.push({
          seq: oItem.bags.length + 1,
          qrNo: oRes.QrNo,
          qty: oRes.Qty,
          unit: oRes.Meins,
          status: oRes.LblStatus,
        });
        oItem.targetQty = this._sumBagQty(oItem);
        oModel.refresh(true);
        MessageToast.show(
          "Bag " + oRes.QrNo + " added to item " + oItem.materialDocItem + ".",
        );
      },

      /**
       * "Scan Required" switch. When turned on, every item's target qty is
       * reset to the sum of its scanned bags (0 if none) and becomes
       * read-only; it then only changes by scanning / deleting bags.
       */
      onScanRequiredChange: function (oEvent) {
        if (!oEvent.getParameter("state")) {
          return;
        }

        var oModel = this.getView().getModel("matDocModel");
        (oModel.getProperty("/issueItems") || []).forEach(function (oItem) {
          oItem.targetQty = this._sumBagQty(oItem);
        }, this);
        oModel.refresh(true);
      },

      /** Total qty of an item's scanned bags, as a trimmed string. */
      _sumBagQty: function (oItem) {
        var fSum = (oItem.bags || []).reduce(function (f, oBag) {
          return f + (parseFloat(oBag.qty) || 0);
        }, 0);
        return String(parseFloat(fSum.toFixed(3)));
      },

      /** Opens the scanned-bags dialog for the item whose bag button was pressed. */
      onShowBags: function (oEvent) {
        var that = this;
        var oContext = oEvent.getSource().getBindingContext("matDocModel");

        Fragment.load({
          name: "materialreceiptconfirm.fragment.BagsDialog",
          controller: this,
        }).then(function (oDialog) {
          that.getView().addDependent(oDialog);
          oDialog.setBindingContext(oContext, "matDocModel");
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
       * Removes a scanned bag (frontend only) and resets the item's target
       * qty to the sum of its remaining bags.
       */
      onDeleteBag: function (oEvent) {
        var oContext = oEvent.getSource().getBindingContext("matDocModel");
        var oModel = oContext.getModel();
        var sBagPath = oContext.getPath();
        var iIndex = parseInt(sBagPath.split("/").pop(), 10);
        var sItemPath = sBagPath.replace(/\/bags\/\d+$/, "");
        var oItem = oModel.getProperty(sItemPath);

        oItem.bags.splice(iIndex, 1);
        oItem.bags.forEach(function (oBag, i) {
          oBag.seq = i + 1;
        });
        oItem.targetQty = this._sumBagQty(oItem);
        oModel.refresh(true);
        MessageToast.show("Bag removed.");
      },

      /**
       * Opens the camera scanner dialog (html5-qrcode / ZXing), scans once,
       * stops, closes the dialog and then calls fnOnDecoded(sDecodedText).
       */
      _openScanner: function (sTitle, fnOnDecoded) {
        if (typeof Html5Qrcode === "undefined") {
          MessageBox.error(
            "QR scanner library failed to load. Please check your internet connection and try again.",
          );
          return;
        }

        var sReaderId = "bagQrScanReader";
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
              { fps: 10, qrbox: { width: 250, height: 150 } },
              function onScanSuccess(sDecodedText) {
                if (bStopped) {
                  return;
                }

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
       * Builds the create-receive-confirm payload from the currently loaded
       * matDoc header plus the (possibly edited) issue items table, confirms
       * with the user, then POSTs it to createReceiveConfirm.
       */
      onCreateIssue: function (oEvent) {
        var that = this;
        var oButton = oEvent.getSource();
        var oMatDocModel = this.getView().getModel("matDocModel");
        var oHeader = oMatDocModel.getProperty("/header") || {};
        var oCookies = this._parseCookies();
        var bScanRequired = !!this.getView()
          .getModel("appModel")
          .getProperty("/scanRequired");

        var oTable = oButton
          .getParent() // tableSubmitBar HBox
          .getParent() // Panel
          .getContent()
          .find(function (oControl) {
            return oControl.isA("sap.m.Table");
          });

        var aSelectedItems = oTable
          .getSelectedContexts("matDocModel")
          .map(function (oContext) {
            var oPayloadItem = Object.assign({}, oContext.getObject());
            oPayloadItem.NpToPack = (
              bScanRequired ? oPayloadItem.bags || [] : []
            ).map(function (oBag) {
              return {
                QrNo: oBag.qrNo,
                Qty: oBag.qty,
                Meins: oBag.unit,
              };
            });
            delete oPayloadItem.bags;
            return oPayloadItem;
          });

        if (!aSelectedItems.length) {
          MessageBox.warning("Select at least one item to confirm receipt.");
          return;
        }

        var oPayload = {
          createdBy: oHeader.createdBy || "",
          order: oHeader.order || "",
          createdDate: oHeader.createdDate || null,
          reservationNumber: oHeader.reservationNumber || "",
          createdTime: oHeader.createdTime || "",
          materialDoc: oHeader.materialDoc || "",
          materialDocYear: oHeader.materialDocYear || "",
          issueSloc: oHeader.issueSloc || "",
          receiveSloc: oHeader.receiveSloc || "",
          plant: oHeader.plant || "",
          employeeId: oCookies["employeeId"] || "",
          sessionId: oCookies["sessionId"] || "",
          npToIssueItem: aSelectedItems,
        };

        console.log("Create issue payload:", oPayload);

        MessageBox.confirm(
          "Records to confirm: " +
            aSelectedItems.length +
            "\nMaterial Doc: " +
            oPayload.materialDoc +
            "\nDoc Year: " +
            oPayload.materialDocYear,
          {
            title: "Confirm Receipt",
            onClose: function (sAction) {
              if (sAction !== MessageBox.Action.OK) {
                return;
              }
              that._postCreateReceiveConfirm(oPayload, oButton, oTable);
            },
          },
        );
      },

      _postCreateReceiveConfirm: function (oPayload, oButton, oTable) {
        var that = this;
        oButton.setBusy(true);
        sap.ui.core.BusyIndicator.show(0);

        $.ajax({
          url: Base_url + "/api/materials/createReceiveConfirm",
          method: "POST",
          headers: ngrokHeaders,
          contentType: "application/json",
          data: JSON.stringify(oPayload),
          success: function (oResponse) {
            console.log("Create receive confirm response:", oResponse);

            var sMessage = "Material receipt confirmed successfully.";
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

            var oDocMatch = /Document\s+(\S+)\s*-\s*(\d+)/i.exec(sMessage);
            var sReceiptDoc = oDocMatch ? oDocMatch[1] : "";
            var sReceiptDocYear = oDocMatch ? oDocMatch[2] : "";

            var fClearSelection = function () {
              if (oTable) {
                oTable.removeSelections(true);
              }
              that
                .getView()
                .getModel("matDocModel")
                .setProperty("/hasSelection", false);
            };

            var oSuccessDialog = new Dialog({
              title: "Receipt Confirmed",
              type: "Message",
              state: "Success",
              content: new Text({ text: sMessage }),
              beginButton: new Button({
                text: "Print Slip",
                type: "Emphasized",
                icon: "sap-icon://print",
                press: function () {
                  oSuccessDialog.close();
                  fClearSelection();
                  that._fetchIssueDetailByDocAndYear(
                    oPayload.materialDoc,
                    oPayload.materialDocYear,
                  );
                  window.open(
                    Print_Slip_Url +
                      "?doctype=receiving&materialDoc=" +
                      sReceiptDoc +
                      "&materialDocYear=" +
                      sReceiptDocYear,
                    "_blank",
                  );
                },
              }),
              endButton: new Button({
                text: "OK",
                type: "Default",
                press: function () {
                  oSuccessDialog.close();
                  fClearSelection();
                  that._fetchIssueDetailByDocAndYear(
                    oPayload.materialDoc,
                    oPayload.materialDocYear,
                  );
                },
              }),
              afterClose: function () {
                oSuccessDialog.destroy();
              },
            });
            oSuccessDialog.open();
          },
          error: function (xhr) {
            console.error("Create receive confirm failed:", xhr);
            MessageBox.error(
              "Failed to confirm material receipt. Please try again.",
              { title: "Confirmation Failed" },
            );
          },
          complete: function () {
            oButton.setBusy(false);
            sap.ui.core.BusyIndicator.hide();
          },
        });
      },

      _fetchIssueDetailByDocAndYear: function (sMaterialDoc, sMaterialDocYear) {
        var oCookies = this._parseCookies();
        var sUrl =
          Base_url +
          "/api/materials/issueDetailByDocAndYear/" +
          sMaterialDoc +
          "/" +
          sMaterialDocYear +
          "?empid=" +
          encodeURIComponent(oCookies["employeeId"] || "") +
          "&sesid=" +
          encodeURIComponent(oCookies["sessionId"] || "") +
          "&plant=" +
          encodeURIComponent(oCookies["plant"] || "");

        this.byId("page").setBusy(true);

        $.ajax({
          url: sUrl,
          method: "GET",
          headers: ngrokHeaders,
          contentType: "application/json",
          success: function (oResponse) {
            console.log("Issue detail by doc and year response:", oResponse);

            var oHeader = ((oResponse && oResponse.results) || [])[0] || {};

            var aIssueItems = (
              (oHeader.npToIssueItem && oHeader.npToIssueItem.results) ||
              []
            ).map(function (oItem) {
              return Object.assign({}, oItem, { bags: [] });
            });

            var aReceipts =
              (oHeader.npToReceipts && oHeader.npToReceipts.results) || [];

            this.getView().getModel("matDocModel").setData({
              header: oHeader,
              issueItems: aIssueItems,
              receipts: aReceipts,
              hasSelection: false,
            });

            var oIssueDetailsPanel = this.byId("issueDetailsPanel");
            if (oIssueDetailsPanel) {
              oIssueDetailsPanel.setExpanded(true);
            }
          }.bind(this),
          error: function () {
            this.getView().getModel("matDocModel").setData({
              header: {},
              issueItems: [],
              receipts: [],
              hasSelection: false,
            });
            MessageBox.error(
              "Could not load issue detail for the given material doc and year. Please try again.",
            );
          }.bind(this),
          complete: function () {
            this.byId("page").setBusy(false);
          }.bind(this),
        });
      },

      _loadMaterialIssue: function () {
        var oCookies = this._parseCookies();
        var sEmployeeId = oCookies["employeeId"];
        var sPlant = oCookies["plant"];
        var sSessionId = oCookies["sessionId"];
        var sOrderId = this._sOrderId;

        var sUrl =
          Base_url +
          "/api/materials/getMaterialIssue/" +
          sEmployeeId +
          "/" +
          sPlant +
          "/" +
          sSessionId +
          "/" +
          sOrderId;

        this.byId("page").setBusy(true);

        $.ajax({
          url: sUrl,
          method: "GET",
          headers: ngrokHeaders,
          contentType: "application/json",
          success: function (oResponse) {
            console.log("Material issue response:", oResponse);

            var oOrder = oResponse.d || oResponse || {};

            var aIssues = (
              (oOrder.npToIssue && oOrder.npToIssue.results) ||
              []
            ).map(function (oIssueHdr) {
              var aItems = (
                (oIssueHdr.npToIssueItem && oIssueHdr.npToIssueItem.results) ||
                []
              ).map(function (oItem) {
                var fIssuedQty = parseFloat(oItem.issuedQty) || 0;
                var fReceivedQty = parseFloat(oItem.receivedQty) || 0;
                var fMaxTargetQty = Math.max(fIssuedQty - fReceivedQty, 0);
                var fTargetQty = parseFloat(oItem.targetQty) || 0;

                return Object.assign({}, oItem, {
                  receivedQty: oItem.receivedQty || "0",
                  maxTargetQty: String(fMaxTargetQty),
                  targetQty: String(Math.min(fTargetQty, fMaxTargetQty)),
                });
              });

              return {
                order: oIssueHdr.order || "",
                reservationNumber: oIssueHdr.reservationNumber || "",
                materialDoc: oIssueHdr.materialDoc || "",
                materialDocYear: oIssueHdr.materialDocYear || "",
                issueSloc: oIssueHdr.issueSloc || "",
                receiveSloc: oIssueHdr.receiveSloc || "",
                plant: oIssueHdr.plant || "",
                items: aItems,
                hasSelection: false,
              };
            });

            if (this._sMaterialDoc) {
              aIssues = aIssues.filter(
                function (oIssue) {
                  return oIssue.materialDoc === this._sMaterialDoc;
                }.bind(this),
              );
            }

            this.getView().getModel("issueModel").setData({
              orderDetails: oOrder,
              issues: aIssues,
            });

            setTimeout(
              function () {
                this.getView()
                  .findAggregatedObjects(true, function (oControl) {
                    return oControl.isA("sap.m.Table");
                  })
                  .forEach(function (oTable) {
                    oTable.removeSelections(true);
                  });
              }.bind(this),
              0,
            );
          }.bind(this),
          error: function () {
            MessageBox.error(
              "Could not load material issue data. Please try again.",
            );
          },
          complete: function () {
            this.byId("page").setBusy(false);
          }.bind(this),
        });
      },

      // ─────────────────────────────────────────────────────────────
      // FORMATTERS
      // ─────────────────────────────────────────────────────────────

      /**
       * Strips leading zeros from a reservation number for display
       * (e.g. "0000367774" -> "367774").
       */
      formatReservationNumber: function (sReservationNumber) {
        return (sReservationNumber || "").replace(/^0+(?=\d)/, "");
      },

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

      /**
       * Converts an OData /Date(ms)/ string into a plain date string.
       */
      formatODataDate: function (sODataDate) {
        var oMatch = /\/Date\((\d+)\)\//.exec(sODataDate || "");
        if (!oMatch) {
          return "";
        }
        return new Date(parseInt(oMatch[1], 10)).toLocaleDateString();
      },

      /**
       * Converts an OData/ABAP ISO-8601 time duration (e.g. "PT16H36M26S")
       * into a plain "HH:MM:SS" string.
       */
      formatODataTime: function (sODataTime) {
        var oMatch = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(
          sODataTime || "",
        );
        if (!oMatch) {
          return sODataTime || "";
        }
        function pad(sValue) {
          return String(sValue || "0").padStart(2, "0");
        }
        return pad(oMatch[1]) + ":" + pad(oMatch[2]) + ":" + pad(oMatch[3]);
      },

      /**
       * Maps the order's colorCode into a sap.ui.core.ValueState for the
       * Status ObjectStatus in the order-details panel.
       */
      formatStatusState: function (sColorCode) {
        switch ((sColorCode || "").toUpperCase()) {
          case "RED":
            return "Error";
          case "YELLOW":
            return "Warning";
          case "GREEN":
            return "Success";
          default:
            return "None";
        }
      },

      // ─────────────────────────────────────────────────────────────
      // ITEM SELECTION / CONFIRM
      // ─────────────────────────────────────────────────────────────

      /** True when an item's issued qty equals its received qty (nothing left to receive). */
      _isFullyReceived: function (oItem) {
        return (
          Math.abs(
            (parseFloat(oItem.issuedQty) || 0) -
              (parseFloat(oItem.receivedQty) || 0),
          ) < 0.0005
        );
      },

      /**
       * Makes fully received rows unselectable: disables their selection
       * checkbox and deselects them (e.g. after "select all").
       */
      _lockFullyReceivedItems: function (oTable) {
        var sModel = oTable.getBindingInfo("items").model;

        oTable.getItems().forEach(function (oListItem) {
          var oContext = oListItem.getBindingContext(sModel);
          if (!oContext || !this._isFullyReceived(oContext.getObject())) {
            return;
          }
          if (oListItem.getSelected()) {
            oListItem.setSelected(false);
          }
          var oCheckBox = oListItem.getMultiSelectControl();
          if (oCheckBox) {
            oCheckBox.setEnabled(false);
          }
        }, this);
      },

      onItemsUpdateFinished: function (oEvent) {
        this._lockFullyReceivedItems(oEvent.getSource());
      },

      /**
       * Tracks whether the issue's table has any row selected, so the
       * Confirm Receipt button can be enabled/disabled accordingly.
       */
      onItemSelectionChange: function (oEvent) {
        var oTable = oEvent.getSource();
        this._lockFullyReceivedItems(oTable);
        var oContext = oTable.getBindingContext("issueModel");
        var oModel = oContext.getModel();

        oModel.setProperty(
          oContext.getPath() + "/hasSelection",
          oTable.getSelectedContexts("issueModel").length > 0,
        );
      },

      /**
       * Tracks whether the matDoc-mode issue items table has any row
       * selected, so the Confirm Receipt button can be enabled/disabled
       * accordingly.
       */
      onMatDocItemSelectionChange: function (oEvent) {
        var oTable = oEvent.getSource();
        this._lockFullyReceivedItems(oTable);
        var oModel = this.getView().getModel("matDocModel");

        oModel.setProperty(
          "/hasSelection",
          oTable.getSelectedContexts("matDocModel").length > 0,
        );
      },

      /**
       * Opens the confirmation list app for the receipt row's own material
       * doc / year in a new tab when "View Details" is pressed in the
       * Receipt History table.
       */
      onViewReceiptDetails: function (oEvent) {
        var oReceipt = oEvent
          .getSource()
          .getBindingContext("matDocModel")
          .getObject();

        window.open(
          Confirmation_List_Url +
            "?materialDoc=" +
            oReceipt.materialDoc +
            "&materialDocYear=" +
            oReceipt.materialDocYear,
          "_blank",
        );
      },

      /**
       * Prevents entering a target qty greater than issuedQty - receivedQty:
       * shows an error toast and resets the input to that max allowed value.
       */
      onTargetQtyChange: function (oEvent) {
        var oInput = oEvent.getSource();
        var oContext = oInput.getBindingContext("issueModel");
        var oModel = oContext.getModel();
        var sPath = oContext.getPath();
        var oItem = oModel.getProperty(sPath);

        var fMaxTargetQty = parseFloat(oItem.maxTargetQty) || 0;
        var sEntered = oEvent.getParameter("value");
        var fEntered = parseFloat(sEntered) || 0;

        if (fEntered > fMaxTargetQty) {
          MessageBox.error(
            "Target qty cannot exceed Issued Qty - Received Qty (" +
              fMaxTargetQty +
              ").",
            { title: "Invalid Target Qty" },
          );
          sEntered = String(fMaxTargetQty);
          oInput.setValue(sEntered);
        }

        oModel.setProperty(sPath + "/targetQty", sEntered);
      },

      onConfirmReceipt: function (oEvent) {
        var that = this;
        var oButton = oEvent.getSource();
        var oIssue = oButton.getBindingContext("issueModel").getObject();

        var oTable = oButton
          .getParent() // issueSubmitBar HBox
          .getParent() // Panel
          .getContent()
          .find(function (oControl) {
            return oControl.isA("sap.m.Table");
          });

        var aSelectedItems = oTable
          .getSelectedContexts("issueModel")
          .map(function (oContext) {
            return oContext.getObject();
          });

        if (!aSelectedItems.length) {
          MessageBox.warning("Select at least one item to confirm receipt.");
          return;
        }

        var aPayloadItems = aSelectedItems.map(function (oItem) {
          var oPayloadItem = Object.assign({}, oItem);
          delete oPayloadItem.maxTargetQty;
          return oPayloadItem;
        });

        var oCookies = this._parseCookies();
        var sEmployeeId = oCookies["employeeId"] || "";
        var sPlant = oCookies["plant"] || "";

        var oPayload = {
          order: this._sOrderId,
          employeeId: sEmployeeId,
          sessionId: oCookies["sessionId"] || "",
          plant: sPlant,
          npToIssue: [
            {
              order: oIssue.order,
              reservationNumber: oIssue.reservationNumber,
              materialDoc: oIssue.materialDoc,
              materialDocYear: oIssue.materialDocYear,
              issueSloc: oIssue.issueSloc,
              receiveSloc: oIssue.receiveSloc,
              plant: oIssue.plant,
              npToIssueItem: aPayloadItems,
            },
          ],
        };

        MessageBox.confirm(
          "Records to confirm: " +
            aSelectedItems.length +
            "\nEmployee: " +
            sEmployeeId +
            "\nPlant: " +
            sPlant,
          {
            title: "Confirm Receipt",
            onClose: function (sAction) {
              if (sAction !== MessageBox.Action.OK) {
                return;
              }
              that._postConfirmReceipt(oPayload, oButton);
            },
          },
        );
      },

      _postConfirmReceipt: function (oPayload, oButton) {
        var that = this;
        console.log("Material receipt confirmation payload:", oPayload);

        oButton.setBusy(true);
        sap.ui.core.BusyIndicator.show(0);

        $.ajax({
          url: Base_url + "/api/materials/confirmMaterialReceipt",
          method: "POST",
          headers: ngrokHeaders,
          contentType: "application/json",
          data: JSON.stringify(oPayload),
          success: function (oResponse) {
            console.log("Material receipt confirmation response:", oResponse);

            var sMessage = "Material receipt confirmed successfully.";
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

            MessageBox.success(sMessage, {
              title: "Receipt Confirmed",
              onClose: function () {
                that._loadMaterialIssue();
              },
            });
          },
          error: function (xhr) {
            console.error("Material receipt confirmation failed:", xhr);
            MessageBox.error(
              "Failed to confirm material receipt. Please try again.",
              { title: "Confirmation Failed" },
            );
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
       * still belong to the user/session active when the check started.
       * - Missing cookies -> session expired, redirect to login.
       * - employeeId changed -> another user logged in, redirect to login.
       * - sessionId changed (same employeeId) -> a new session was issued
       *   for this user, so just prompt a refresh instead of a re-login.
       */
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
