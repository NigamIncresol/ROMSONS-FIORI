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
    "sap/m/Column",
    "sap/m/ColumnListItem",
    "sap/m/Input",
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
    MessageBox,
    MessageToast,
    Column,
    ColumnListItem,
    Input,
    List,
    StandardListItem,
    SearchField,
  ) {
    "use strict";

    const Base_url = "http://localhost:3000";
    // const Base_url = "http://192.168.1.61:3000";
    // const Base_url = "http://192.168.0.136:3000";

    const ngrokHeaders = {
      "ngrok-skip-browser-warning": "69420",
    };

    //Localhost Urls
    const Login_Url = "http://localhost:9000/index.html";

    //Internal Urls
    // const Login_Url = "https://romsonsfiori.incresol.com/LoginApp/index.html";

    // Production URLs
    // const Login_Url = "https://webapps.romsons.com/LoginApp/index.html";

    return Controller.extend("materialtransfersloc.controller.View1", {
      onInit: function () {
        this.getView().attachAfterRendering(
          function () {
            var sImageUrl = sap.ui.require.toUrl(
              "materialtransfersloc/images/logoNew.svg",
            );
            this.byId("logoImage").setSrc(sImageUrl);
          }.bind(this),
        );

        this.getView().setModel(
          new JSONModel({ employeeId: "", plant: "" }),
          "appModel",
        );

        this.getView().setModel(
          new JSONModel({
            fromLoc: "",
            toLoc: "",
            remark: "",
            hasResults: false,
          }),
          "transferModel",
        );

        setTimeout(
          function () {
            var oCookies = this._parseCookies();
            var oModel = this.getView().getModel("appModel");
            oModel.setProperty("/employeeId", oCookies["employeeId"] || "");
            oModel.setProperty("/plant", oCookies["plant"] || "");

            if (this._enforceSession()) {
              this._startSessionCheck();
            }
          }.bind(this),
          300,
        );
      },

      // ─────────────────────────────────────────────────────────────
      // STOCK INFO
      // ─────────────────────────────────────────────────────────────

      // ─────────────────────────────────────────────────────────────
      // STORAGE LOCATION VALUE HELP
      // ─────────────────────────────────────────────────────────────

      onFromLocValueHelp: function () {
        this._openSlocValueHelp(
          "From Location",
          function (sKey) {
            this.getView()
              .getModel("transferModel")
              .setProperty("/fromLoc", sKey);
            this.onFromLocChange({
              getParameter: function () {
                return sKey;
              },
            });
          }.bind(this),
        );
      },

      onToLocValueHelp: function () {
        this._openSlocValueHelp(
          "To Location",
          function (sKey) {
            this.getView()
              .getModel("transferModel")
              .setProperty("/toLoc", sKey);
          }.bind(this),
        );
      },

      /** F4 list of storage locations; calls fnSelect(key) on selection. */
      _openSlocValueHelp: function (sTitle, fnSelect) {
        var oCookies = this._parseCookies();
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
          fnSelect(oEvt.getParameter("listItem").getTitle());
          oDlg.close();
        });

        oDlg.open();
        oDlg.setBusy(true);
        $.ajax({
          url:
            Base_url +
            "/api/f4/material_transfer/storage_locations?" +
            $.param({
              empid: oCookies["employeeId"],
              sesid: oCookies["sessionId"],
              plant: oCookies["plant"],
            }),
          method: "GET",
          headers: ngrokHeaders,
          success: function (oResp) {
            var aRows = Array.isArray(oResp) ? oResp : oResp.values || [];
            aRows.forEach(function (oRow) {
              oList.addItem(
                new StandardListItem({
                  title: oRow.key,
                  description: oRow.text,
                }),
              );
            });
          },
          error: function () {
            MessageToast.show("Could not load storage location list.");
          },
          complete: function () {
            oDlg.setBusy(false);
          },
        });
      },

      /** Fetches stock info for the entered From Location. */
      onFromLocChange: function (oEvent) {
        var sLoc = (oEvent.getParameter("value") || "").trim().toUpperCase();
        var oModel = this.getView().getModel("transferModel");
        oModel.setProperty("/fromLoc", sLoc);

        if (!sLoc) {
          oModel.setProperty("/hasResults", false);
          return;
        }

        var oCookies = this._parseCookies();
        var oParams = {
          plant: oCookies["plant"],
          storageLocation: sLoc,
          employeeId: oCookies["employeeId"],
          sessionId: oCookies["sessionId"],
        };

        this.byId("dynamicPage").setBusy(true);

        $.ajax({
          url: Base_url + "/api/materials/stockinfo?" + $.param(oParams),
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
            this._buildStockTable(aRows);
            oModel.setProperty("/hasResults", true);
          }.bind(this),
          error: function () {
            oModel.setProperty("/hasResults", false);
            MessageToast.show("Could not load stock info. Please try again.");
          },
          complete: function () {
            this.byId("dynamicPage").setBusy(false);
          }.bind(this),
        });
      },

      /** Shows the stock rows in fixed column order. */
      _buildStockTable: function (aRows) {
        var oTable = this.byId("stockTable");
        var that = this;
        var aItems = aRows.map(function (r) {
          return {
            Matnr: r.Matnr,
            Maktx: r.Maktx,
            Charg: r.Charg,
            Vfdat: that._formatSapDate(r.Vfdat),
            AvailQty: r.AvailQty,
            Meins: r.Meins,
            Bwart: r.Bwart,
            TransferQty: "",
          };
        });

        if (!oTable.getColumns().length) {
          [
            ["Material Code", "Matnr"],
            ["Material Description", "Maktx"],
            ["Batch", "Charg"],
            ["Expiry Date", "Vfdat"],
            ["Available Qty", "AvailQty"],
            ["UoM", "Meins"],
            ["Transfer Qty", "TransferQty"],
          ].forEach(function (a) {
            oTable.addColumn(new Column({ header: new Text({ text: a[0] }) }));
          });
          oTable.bindItems({
            path: "stockModel>/items",
            template: new ColumnListItem({
              cells: ["Matnr", "Maktx", "Charg", "Vfdat", "AvailQty", "Meins"]
                .map(function (k) {
                  return new Text({ text: "{stockModel>" + k + "}" });
                })
                .concat([
                  new Input({
                    value: "{stockModel>TransferQty}",
                    type: "Number",
                    width: "8rem",
                    liveChange: that.onTransferQtyChange.bind(that),
                  }),
                ]),
            }),
          });
        }
        oTable.setModel(new JSONModel({ items: aItems }), "stockModel");
      },

      /** Keeps the entered transfer qty within 0..available qty for that line. */
      onTransferQtyChange: function (oEvent) {
        var oInput = oEvent.getSource();
        var oCtx = oInput.getBindingContext("stockModel");
        if (!oCtx) {
          return;
        }
        var fAvail = parseFloat(oCtx.getProperty("AvailQty"));
        var fQty = parseFloat(oEvent.getParameter("value"));

        if (fQty < 0) {
          oCtx.getModel().setProperty("TransferQty", "", oCtx);
        } else if (fQty > fAvail) {
          oCtx.getModel().setProperty("TransferQty", String(fAvail), oCtx);
          MessageToast.show(
            "Transfer qty cannot exceed available qty (" + fAvail + ").",
          );
        }
      },

      /** Validates the selection and prepares the transfer payload. */
      onTransfer: function () {
        var oModel = this.getView().getModel("transferModel");
        var sFrom = oModel.getProperty("/fromLoc");
        var sTo = (oModel.getProperty("/toLoc") || "").trim().toUpperCase();
        var oTable = this.byId("stockTable");
        var aSelected = oTable.getSelectedItems();

        if (!sFrom || !sTo) {
          MessageToast.show("Enter both From Location and To Location.");
          return;
        }
        if (sFrom === sTo) {
          MessageToast.show("From and To Location cannot be the same.");
          return;
        }
        if (!aSelected.length) {
          MessageToast.show("Select at least one material to transfer.");
          return;
        }

        var aRows = [];
        for (var i = 0; i < aSelected.length; i++) {
          var o = aSelected[i].getBindingContext("stockModel").getObject();
          var fQty = parseFloat(o.TransferQty);
          if (!(fQty > 0)) {
            MessageToast.show(
              "Enter a transfer qty greater than 0 for " +
                o.Matnr +
                " / " +
                o.Charg +
                ".",
            );
            return;
          }
          if (fQty > parseFloat(o.AvailQty)) {
            MessageToast.show(
              "Transfer qty cannot exceed available qty (" +
                o.AvailQty +
                ") for " +
                o.Matnr +
                " / " +
                o.Charg +
                ".",
            );
            return;
          }
          aRows.push({ row: o, qty: fQty });
        }

        var oCookies = this._parseCookies();
        var sTransferId = "1";
        var oPayload = {
          TransferId: sTransferId,
          Werks: oCookies["plant"],
          FromLgort: sFrom,
          ToLgort: sTo,
          Bwart: aRows[0].row.Bwart || "311",
          HeaderText: (oModel.getProperty("/remark") || "")
            .trim()
            .substring(0, 24),
          Empid: oCookies["employeeId"],
          Sesid: oCookies["sessionId"],
          npToItem: aRows.map(function (x, idx) {
            return {
              TransferId: sTransferId,
              ItemNo: String(idx + 1).padStart(4, "0"),
              Matnr: x.row.Matnr,
              Charg: x.row.Charg,
              Qty: String(x.qty),
              Meins: x.row.Meins,
            };
          }),
        };

        console.log("Transfer payload:", JSON.stringify(oPayload, null, 2));
        var oPage = this.byId("dynamicPage");
        oPage.setBusy(true);

        $.ajax({
          url: Base_url + "/api/materials/createTransfer",
          method: "POST",
          contentType: "application/json",
          headers: ngrokHeaders,
          data: JSON.stringify(oPayload),
          success: function (oResponse) {
            console.log("Transfer response:", oResponse);
            var oRes = (oResponse && oResponse.response) || {};
            var sMsg =
              oRes.Message ||
              (oResponse && oResponse.message) ||
              "Material transfer created successfully.";
            MessageBox.success(sMsg, {
              onClose: function () {
                // reload stock for the From Location so quantities are current
                oTable.removeSelections(true);
                this.onFromLocChange({
                  getParameter: function () {
                    return sFrom;
                  },
                });
              }.bind(this),
            });
          }.bind(this),
          error: function (oXhr) {
            console.error("Transfer failed:", oXhr.responseText);
            var sMsg = "Could not create the transfer. Please try again.";
            try {
              var oErr = JSON.parse(oXhr.responseText);
              sMsg = oErr.message || oErr.error || sMsg;
            } catch (e) {
              // keep default message
            }
            MessageBox.error(sMsg);
          },
          complete: function () {
            oPage.setBusy(false);
          },
        });
      },

      /** Converts "/Date(ms)/" to dd.mm.yyyy; empty for null. */
      _formatSapDate: function (sDate) {
        var m = /\/Date\((-?\d+)\)\//.exec(sDate || "");
        if (!m) {
          return "";
        }
        var d = new Date(parseInt(m[1], 10));
        var p = function (n) {
          return String(n).padStart(2, "0");
        };
        return (
          p(d.getUTCDate()) +
          "." +
          p(d.getUTCMonth() + 1) +
          "." +
          d.getUTCFullYear()
        );
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
