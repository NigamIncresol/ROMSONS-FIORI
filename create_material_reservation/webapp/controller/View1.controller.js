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
    const Print_Url = "http://localhost:9011/index.html";

    //Internal URLs
    // const Login_Url = "https://romsonsfiori.incresol.com/LoginApp/index.html";
    // const Print_Url =
    //   "https://romsonsfiori.incresol.com/DocumentCenter/index.html";

    // Production URLs
    // const Login_Url = "https://webapps.romsons.com/LoginApp/index.html";
    // const Print_Url = "https://webapps.romsons.com/DocumentCenter/index.html";

    const ngrokHeaders = {
      "ngrok-skip-browser-warning": "69420",
    };

    return Controller.extend("materialrequest.controller.View1", {
      // ─────────────────────────────────────────────────────────────
      // LIFECYCLE
      // ─────────────────────────────────────────────────────────────
      onInit: function () {
        this.getView().attachAfterRendering(
          function () {
            var sImageUrl = sap.ui.require.toUrl(
              "materialrequest/images/logoNew.svg",
            );
            this.byId("logoImage").setSrc(sImageUrl);
          }.bind(this),
        );

        this.getView().setModel(
          new JSONModel({
            employeeId: "",
            plant: "",
            orderId: "",
            searchOrderId: "",
            orderLoaded: false,
          }),
          "appModel",
        );

        setTimeout(
          function () {
            var oCookies = this._parseCookies();
            var sQueryOrder = this._getQueryParam("order");
            this._sOrderId = sQueryOrder;

            var oAppModel = this.getView().getModel("appModel");
            oAppModel.setProperty("/employeeId", oCookies["employeeId"] || "");
            oAppModel.setProperty("/plant", oCookies["plant"] || "");
            oAppModel.setProperty("/orderId", sQueryOrder || "");
            oAppModel.setProperty("/searchOrderId", sQueryOrder || "");

            if (this._enforceSession()) {
              this._startSessionCheck();
              if (sQueryOrder) {
                this._loadMaterialRequests();
              }
            }
          }.bind(this),
          300,
        );
      },

      // ─────────────────────────────────────────────────────────────
      // DATA LOADING
      // ─────────────────────────────────────────────────────────────

      _loadMaterialRequests: function () {
        var oCookies = this._parseCookies();
        var sEmployeeId = oCookies["employeeId"];
        var sPlant = oCookies["plant"];
        var sSessionId = oCookies["sessionId"];
        var sOrderId = this._sOrderId;

        if (!sOrderId) {
          MessageToast.show("No production order specified.");
          return;
        }

        console.log("Loading materials for order:", sOrderId);

        var sUrl =
          Base_url +
          "/api/materials/prodOrderMatList/" +
          sEmployeeId +
          "/" +
          sPlant +
          "/" +
          sSessionId +
          "/" +
          sOrderId;

        this.byId("dynamicPage").setBusy(true);

        $.ajax({
          url: sUrl,
          method: "GET",
          headers: ngrokHeaders,
          contentType: "application/json",
          success: function (oResponse) {
            console.log("Material request response:", oResponse);
            this.getView()
              .getModel("appModel")
              .setProperty("/orderLoaded", true);
            var oOrder = oResponse.result || oResponse || {};
            var aComponents =
              (oOrder.npToComponents && oOrder.npToComponents.results) || [];

            // Group components by issueStorlc
            var oGroupMap = {};
            aComponents.forEach(function (oItem) {
              var sKey = oItem.issueStorlc || "—";
              if (!oGroupMap[sKey]) {
                oGroupMap[sKey] = { storageLocation: sKey, items: [] };
              }
              oGroupMap[sKey].items.push(oItem);
            });
            var aGroups = Object.keys(oGroupMap).map(function (k) {
              return oGroupMap[k];
            });

            // Prefill pendReq and selection state
            aGroups.forEach(function (oGroup) {
              oGroup.selected = true;
              oGroup.items.forEach(function (oItem) {
                var fMax =
                  (parseFloat(oItem.reqQuan) || 0) -
                  (parseFloat(oItem.reservationQty) || 0);
                oItem.pendReq = String(
                  Math.max(0, parseFloat(fMax.toFixed(3))),
                );
                oItem.selected = true;
              });
              // canSubmit: true only if at least one selected item has pendReq > 0
              oGroup.canSubmit = oGroup.items.some(function (o) {
                return o.selected && parseFloat(o.pendReq) > 0;
              });
              // disable submit if this issue location is the same as the order's receiving location
              oGroup.isReceivingLoc = (oGroup.storageLocation === (oOrder.receivingSloc || ""));
            });

            this.getView().setModel(
              new JSONModel({
                order: oOrder,
                groups: aGroups,
              }),
              "materialsModel",
            );

            // Collapse all storage panels except the first one
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
            this.getView()
              .getModel("appModel")
              .setProperty("/orderLoaded", false);
            MessageToast.show(
              "Could not load material requests. Please try again.",
            );
          }.bind(this),
          complete: function () {
            this.byId("dynamicPage").setBusy(false);
          }.bind(this),
        });
      },

      _updateGroupCanSubmit: function (oModel, sGroupPath) {
        var aItems = oModel.getProperty(sGroupPath + "/items");
        var bCanSubmit = aItems.some(function (o) {
          return o.selected && parseFloat(o.pendReq) > 0;
        });
        oModel.setProperty(sGroupPath + "/canSubmit", bCanSubmit);
      },

      onSelectAllItems: function (oEvent) {
        var bSelected = oEvent.getParameter("selected");
        var oGroupContext = oEvent
          .getSource()
          .getBindingContext("materialsModel");
        var oModel = this.getView().getModel("materialsModel");
        var sGroupPath = oGroupContext.getPath();
        var aItems = oModel.getProperty(sGroupPath + "/items");
        aItems.forEach(function (oItem, i) {
          oModel.setProperty(
            sGroupPath + "/items/" + i + "/selected",
            bSelected,
          );
        });
        oModel.setProperty(sGroupPath + "/selected", bSelected);
        this._updateGroupCanSubmit(oModel, sGroupPath);
      },

      onSelectItem: function (oEvent) {
        var bSelected = oEvent.getParameter("selected");
        var oItemContext = oEvent
          .getSource()
          .getBindingContext("materialsModel");
        var oModel = this.getView().getModel("materialsModel");
        oModel.setProperty(oItemContext.getPath() + "/selected", bSelected);

        var sItemPath = oItemContext.getPath();
        var sGroupPath = sItemPath.substring(0, sItemPath.indexOf("/items"));
        var aItems = oModel.getProperty(sGroupPath + "/items");
        var bAllSelected = aItems.every(function (o) {
          return o.selected;
        });
        oModel.setProperty(sGroupPath + "/selected", bAllSelected);
        this._updateGroupCanSubmit(oModel, sGroupPath);
      },

      onTargetQtyChange: function (oEvent) {
        var oInput = oEvent.getSource();
        var oContext = oInput.getBindingContext("materialsModel");
        var fReqQuan = parseFloat(oContext.getProperty("reqQuan")) || 0;
        var fReservationQty =
          parseFloat(oContext.getProperty("reservationQty")) || 0;
        var fMax = fReqQuan - fReservationQty;
        var fEntered = parseFloat(oEvent.getParameter("value")) || 0;

        var sItemPath = oContext.getPath();
        var sGroupPath = sItemPath.substring(0, sItemPath.indexOf("/items"));
        this._updateGroupCanSubmit(oContext.getModel(), sGroupPath);

        if (fEntered > fMax) {
          oInput.setValueState("Error");
          oInput.setValueStateText(
            "Target Qty cannot exceed " + fMax + " (Required - Reservation)",
          );
          oInput.setValue("");
          oContext.getModel().setProperty(oContext.getPath() + "/pendReq", "");
        } else if (fEntered < 0) {
          oInput.setValueState("Error");
          oInput.setValueStateText("Target Qty cannot be negative.");
          oInput.setValue("");
          oContext.getModel().setProperty(oContext.getPath() + "/pendReq", "");
        } else {
          oInput.setValueState("None");
          oInput.setValueStateText("");
        }
      },

      onSubmitRequest: function (oEvent) {
        var that = this;
        var oCookies = this._parseCookies();
        var oOrder = this.getView()
          .getModel("materialsModel")
          .getProperty("/order");

        // Get the group (items for this storage location) from the binding context
        var oGroup = oEvent
          .getSource()
          .getBindingContext("materialsModel")
          .getObject();

        var aSelectedItems = oGroup.items.filter(function (oItem) {
          return oItem.selected;
        });

        if (!aSelectedItems.length) {
          MessageBox.warning(
            "Please select at least one item before submitting.",
            {
              title: "No Items Selected",
            },
          );
          return;
        }

        var oPayload = {
          order: oOrder.order,
          employeeId: oCookies["employeeId"] || "",
          sessionId: oCookies["sessionId"] || "",
          plant: oCookies["plant"] || "",
          npToComponents: aSelectedItems.map(function (oItem) {
            return {
              employeeId: oItem.employeeId || "",
              materialDesc: oItem.materialDesc || "",
              receivStorlc: oItem.receivStorlc || "",
              plant: oItem.plant || "",
              sessionId: oItem.sessionId || "",
              item: oItem.item || "",
              order: oItem.order || "",
              component: oItem.component || "",
              operation: oItem.operation || "",
              reqQuan: oItem.reqQuan || "0",
              baseUom: oItem.baseUom || "",
              wdranQuan: oItem.wdranQuan || "0",
              stockSf: oItem.stockSf || "0",
              stockSrc: oItem.stockSrc || "0",
              pendReq: oItem.pendReq || "0",
              issueStorlc: oItem.issueStorlc || "",
            };
          }),
        };

        console.log("📤 Submitting material request:", oPayload);

        var oButton = oEvent.getSource();
        oButton.setBusy(true);
        sap.ui.core.BusyIndicator.show(0);

        $.ajax({
          url: Base_url + "/api/materials/requestMaterials",
          method: "POST",
          headers: ngrokHeaders,
          contentType: "application/json",
          data: JSON.stringify(oPayload),
          success: function (oResponse) {
            console.log("✅ Submit response:", oResponse);
            var sMessage = "Material request submitted successfully.";
            var sReservationNumber = "";
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
            var oMatch = sMessage.match(/\d+/);
            if (oMatch) {
              sReservationNumber = oMatch[0];
            }
            var sPrintUrl =
              Print_Url +
              "?doctype=requisition&reservationNumber=" +
              encodeURIComponent(sReservationNumber);
            var oSuccessDialog = new Dialog({
              title: "Request Submitted",
              type: "Message",
              state: "Success",
              content: new Text({ text: sMessage }),
              beginButton: new Button({
                text: "OK",
                type: "Emphasized",
                press: function () {
                  oSuccessDialog.close();
                  that._loadMaterialRequests();
                },
              }),
              endButton: new Button({
                text: "Print Slip",
                type: "Success",
                icon: "sap-icon://print",
                press: function () {
                  oSuccessDialog.close();
                  that._loadMaterialRequests();
                  window.open(sPrintUrl, "_blank");
                },
              }),
              afterClose: function () {
                oSuccessDialog.destroy();
              },
            });
            oSuccessDialog.open();
          },
          error: function (xhr) {
            console.error("❌ Submit failed:", xhr);
            var sMessage = "Failed to submit request. Please try again.";
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
                sMessage = sMain || oError.message || sMessage;
                if (aErrorMsgs.length) {
                  sMessage += "\n\n" + aErrorMsgs.join("\n");
                }
              } else if (oError.message) {
                sMessage = oError.message;
              }
            } catch (e) {
              /* non-JSON response, keep default message */
            }
            MessageBox.error(sMessage, { title: "Request Failed" });
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
       * Checks every 20 seconds whether the session cookies still exist.
       * If any required cookie is missing, shows the session-expired dialog
       * and clears the interval so only one dialog ever appears.
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
      // FORMATTERS
      // ─────────────────────────────────────────────────────────────

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

      formatQty: function (sVal) {
        var f = parseFloat(sVal);
        if (isNaN(f)) return sVal || "—";
        return f.toLocaleString("en-IN", {
          minimumFractionDigits: 0,
          maximumFractionDigits: 3,
        });
      },

      formatDuration: function (s) {
        var m = /PT(\d+)H(\d+)M(\d+)S/.exec(s || "");
        if (!m) return s || "—";
        return m[1].padStart(2, "0") + ":" + m[2].padStart(2, "0") + ":" + m[3].padStart(2, "0");
      },

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

      // ─────────────────────────────────────────────────────────────
      // ACTION HANDLERS
      // ─────────────────────────────────────────────────────────────

      /**
       * Confirms logout with the user, clears all session cookies,
       * then redirects to the login page.
       */

      onScanOrder: function () {
        var that = this;
        var oScanner = null;
        var bScanDone = false;

        // Create scanner container div
        var sScanDivId = "mr-qr-reader-" + Date.now();
        var oHTML = new HTML({
          content: "<div id='" + sScanDivId + "' style='width:100%;'></div>",
        });

        var oScanDialog = new Dialog({
          title: "Scan Production Order",
          contentWidth: "320px",
          content: [oHTML],
          endButton: new Button({
            text: "Cancel",
            press: function () {
              oScanDialog.close();
            },
          }),
          afterOpen: function () {
            oScanner = new Html5Qrcode(sScanDivId);
            oScanner
              .start(
                { facingMode: "environment" },
                { fps: 10, qrbox: { width: 250, height: 150 } },
                function (sDecodedText) {
                  if (bScanDone) return;
                  bScanDone = true;

                  oScanner
                    .stop()
                    .then(function () {
                      oScanDialog.close();

                      try {
                        var oData = JSON.parse(sDecodedText);
                        var sOrderNo = (oData["Order No"] || "").trim();
                        if (!sOrderNo) {
                          MessageBox.error(
                            'Invalid QR scanned. Expected format: {"Order No":"..."}',
                            { title: "Invalid QR Code" },
                          );
                          return;
                        }
                        var oAppModel = that.getView().getModel("appModel");
                        oAppModel.setProperty("/searchOrderId", sOrderNo);
                        oAppModel.setProperty("/orderId", sOrderNo);
                        oAppModel.setProperty("/orderLoaded", false);
                        that._sOrderId = sOrderNo;
                        that._loadMaterialRequests();
                      } catch (e) {
                        // Not valid JSON — wrong QR/barcode scanned
                        MessageBox.error(
                          "Invalid QR scanned. Please scan a valid Production Order QR code.",
                          { title: "Invalid QR Code" },
                        );
                      }
                    })
                    .catch(function () {
                      oScanDialog.close();
                    });
                },
                function () {
                  /* scan error — keep trying */
                },
              )
              .catch(function (sErr) {
                MessageBox.error("Camera could not be started: " + sErr, {
                  title: "Scanner Error",
                });
                oScanDialog.close();
              });
          },
          afterClose: function () {
            if (oScanner) {
              oScanner.stop().catch(function () {});
            }
            oScanDialog.destroy();
          },
        });

        oScanDialog.open();
      },

      onOrderValueHelp: function () {
        var that = this;
        var oCookies = this._parseCookies();

        var sUrl =
          Base_url +
          "/api/f4/reservation_create/orders_released" +
          "?empid=" +
          encodeURIComponent(oCookies["employeeId"] || "") +
          "&sesid=" +
          encodeURIComponent(oCookies["sessionId"] || "") +
          "&plant=" +
          encodeURIComponent(oCookies["plant"] || "");

        // Reuse dialog if already created
        if (!this._oOrderVHDialog) {
          this._oOrderVHDialog = new SelectDialog({
            title: "Select Production Order",
            noDataText: "No orders found",
            search: function (oEvent) {
              var sVal = oEvent.getParameter("value");
              var oFilter = new Filter({
                filters: [
                  new Filter("key", FilterOperator.Contains, sVal),
                  new Filter("text", FilterOperator.Contains, sVal),
                ],
                and: false,
              });
              oEvent.getParameter("itemsBinding").filter([oFilter]);
            },
            confirm: function (oEvent) {
              var oSelected = oEvent.getParameter("selectedItem");
              if (oSelected) {
                var sOrderNo = oSelected.getTitle();
                var oAppModel = that.getView().getModel("appModel");
                oAppModel.setProperty("/searchOrderId", sOrderNo);
              }
            },
            cancel: function () {},
          });

          this._oOrderVHDialog.bindAggregation("items", {
            path: "vhModel>/values",
            template: new StandardListItem({
              title: "{vhModel>key}",
              description: "{vhModel>text}",
            }),
          });

          this.getView().addDependent(this._oOrderVHDialog);
        }

        // Set empty model while loading
        var oVHModel = new JSONModel([]);
        this.getView().setModel(oVHModel, "vhModel");
        this._oOrderVHDialog.setBusy(true);
        this._oOrderVHDialog.open();

        $.ajax({
          url: sUrl,
          method: "GET",
          headers: ngrokHeaders,
          contentType: "application/json",
          success: function (oResponse) {
            oVHModel.setData(oResponse);
            console.log("Order VH response:", oResponse);
          },
          error: function () {
            MessageToast.show("Could not load orders. Please try again.");
          },
          complete: function () {
            that._oOrderVHDialog.setBusy(false);
          },
        });
      },

      onApplyOrder: function () {
        var oAppModel = this.getView().getModel("appModel");
        var sOrderId = (oAppModel.getProperty("/searchOrderId") || "").trim();
        if (!sOrderId) {
          MessageToast.show("Please enter a Production Order ID.");
          return;
        }
        this._sOrderId = sOrderId;
        oAppModel.setProperty("/orderId", sOrderId);
        oAppModel.setProperty("/orderLoaded", false);
        this._loadMaterialRequests();
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
