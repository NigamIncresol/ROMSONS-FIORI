sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel",
    "sap/m/Dialog",
    "sap/m/Button",
    "sap/ui/core/Item",
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
    Item,
    HTML,
    MessageToast,
    MessageBox,
    SelectDialog,
    StandardListItem,
    Filter,
    FilterOperator,
  ) {
    "use strict";

    const ngrokHeaders = {
      "ngrok-skip-browser-warning": "69420",
    };

    const Base_url = "http://localhost:3000";
    // const Base_url = "http://192.168.1.61:3000";
    // const Base_url = "http://192.168.0.136:3000";

    // const Login_Url = "https://romsonsfiori.incresol.com/LoginApp/index.html";
    const Login_Url = "http://localhost:9000/index.html";
    // const Login_Url = "https://webapps.romsons.com/LoginApp/index.html";

    // ─────────────────────────────────────────────────────────────
    // DOCUMENT TYPE CONFIG
    // Selected via the "doctype" URL param: jobcard | requisition | issue | receiving
    // Each type defines which filter fields are shown ("fields"), how to
    // validate them, how to build the API URL, and the summary line shown
    // once a document is found/not found.
    // ─────────────────────────────────────────────────────────────
    const DOC_TYPES = {
      jobcard: {
        title: "Job Card Download",
        icon: "sap-icon://print",
        goText: "Find",
        foundLabel: "Job card found",
        notFoundLabel: "Job card not found",
        emptyTitle: "Print a Job Card",
        emptyText:
          "Enter an Order ID, select a shift and click Find to generate the job card.",
        fields: "orderShiftDate",
        needsShiftList: true,
        validate: function (v) {
          if (!v.order) return "Please enter an Order ID.";
          if (!v.date) return "Please select a date.";
          if (!v.shift) return "Please select a shift.";
          return null;
        },
        buildUrl: function (v) {
          var sDateTime = v.date + "T00:00:00";
          return (
            Base_url +
            "/api/productionOrder/printJobCard/" +
            encodeURIComponent(v.order) +
            "/" +
            encodeURIComponent(v.shift) +
            "/" +
            encodeURIComponent(sDateTime)
          );
        },
        summary: function (v) {
          return (
            "Order: " +
            v.order +
            "  |  Date: " +
            v.date +
            "  |  Shift: " +
            v.shift
          );
        },
      },
      requisition: {
        title: "Reservation Slip Download",
        icon: "sap-icon://request",
        goText: "Find",
        foundLabel: "Reservation slip found",
        notFoundLabel: "Reservation slip not found",
        emptyTitle: "Download a Reservation Slip",
        emptyText:
          "Enter a Reservation Number and click Find to generate the slip.",
        fields: "reservation",
        needsShiftList: false,
        validate: function (v) {
          if (!v.reservationNumber) return "Please enter a Reservation Number.";
          return null;
        },
        buildUrl: function (v) {
          return (
            Base_url +
            "/api/materials/printReservationSlip/" +
            encodeURIComponent(v.reservationNumber)
          );
        },
        summary: function (v) {
          return "Reservation Number: " + v.reservationNumber;
        },
      },
      issue: {
        title: "Material Issue Slip Download",
        icon: "sap-icon://shipping-status",
        goText: "Find",
        foundLabel: "Material issue slip found",
        notFoundLabel: "Material issue slip not found",
        emptyTitle: "Download a Material Issue Slip",
        emptyText:
          "Enter the Material Document number and year, then click Find.",
        fields: "materialDoc",
        f4App: "issue_print",
        f4Years: "issue_doc_years",
        f4Docs: "issue_docs",
        needsShiftList: false,
        validate: function (v) {
          if (!v.materialDoc) return "Please enter a Material Document number.";
          if (!v.materialDocYear)
            return "Please enter the Material Document Year.";
          return null;
        },
        buildUrl: function (v) {
          return (
            Base_url +
            "/api/materials/printMaterialIssueSlip/" +
            encodeURIComponent(v.materialDoc) +
            "/" +
            encodeURIComponent(v.materialDocYear)
          );
        },
        summary: function (v) {
          return (
            "Material Doc: " + v.materialDoc + "  |  Year: " + v.materialDocYear
          );
        },
      },
      receiving: {
        title: "Material Receipt Slip Download",
        icon: "sap-icon://sales-order-item",
        goText: "Find",
        foundLabel: "Material receipt slip found",
        notFoundLabel: "Material receipt slip not found",
        emptyTitle: "Download a Material Receipt Slip",
        emptyText:
          "Enter the Material Document number and year, then click Find.",
        fields: "materialDoc",
        f4App: "receipt_print",
        f4Years: "receipt_doc_years",
        f4Docs: "receipt_docs",
        needsShiftList: false,
        validate: function (v) {
          if (!v.materialDoc) return "Please enter a Material Document number.";
          if (!v.materialDocYear)
            return "Please enter the Material Document Year.";
          return null;
        },
        buildUrl: function (v) {
          return (
            Base_url +
            "/api/materials/printMaterialReceiptSlip/" +
            encodeURIComponent(v.materialDoc) +
            "/" +
            encodeURIComponent(v.materialDocYear)
          );
        },
        summary: function (v) {
          return (
            "Material Doc: " + v.materialDoc + "  |  Year: " + v.materialDocYear
          );
        },
      },
    };

    return Controller.extend("downloaddocument.controller.View1", {
      // ─────────────────────────────────────────────────────────────
      // LIFECYCLE
      // ─────────────────────────────────────────────────────────────
      onInit: function () {
        this.getView().attachAfterRendering(
          function () {
            var sImageUrl = sap.ui.require.toUrl(
              "downloaddocument/images/logoNew.svg",
            );
            this.byId("logoImage").setSrc(sImageUrl);
          }.bind(this),
        );

        const oUrlParams = new URLSearchParams(window.location.search);
        const sOrderId = oUrlParams.get("order") || "";
        const sToday = new Date().toISOString().split("T")[0];

        const sRequestedDocType = (
          oUrlParams.get("doctype") || ""
        ).toLowerCase();
        const sDocType = DOC_TYPES[sRequestedDocType]
          ? sRequestedDocType
          : "jobcard";
        this._oDocConfig = DOC_TYPES[sDocType];

        this.getView().setModel(
          new JSONModel({
            employeeId: "",
            plant: "",
            order: sOrderId,
            orderInput: sOrderId,
            selectedDate: oUrlParams.get("date") || sToday,
            shiftEnabled: false,
            selectedShift: oUrlParams.get("shift") || "",
            reservationNumberInput: oUrlParams.get("reservationNumber") || "",
            materialDocInput: oUrlParams.get("materialDoc") || "",
            materialDocYearInput: oUrlParams.get("materialDocYear") || "",
            qrInput: "",
            appliedSummary: "",
            resultVisible: false,
            errorVisible: false,
            errorMessage: "",
            pdfUrl: "",
            docType: sDocType,
            docTitle: this._oDocConfig.title,
            docIcon: this._oDocConfig.icon,
            goText: this._oDocConfig.goText,
            foundLabel: this._oDocConfig.foundLabel,
            notFoundLabel: this._oDocConfig.notFoundLabel,
            emptyTitle: this._oDocConfig.emptyTitle,
            emptyText: this._oDocConfig.emptyText,
            showOrderShiftDate: this._oDocConfig.fields === "orderShiftDate",
            showReservationField: this._oDocConfig.fields === "reservation",
            showMaterialDocFields: this._oDocConfig.fields === "materialDoc",
            materialF4: !!this._oDocConfig.f4App,
          }),
          "appModel",
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
              this._autoApplyFromQuery();
            }
          }.bind(this),
          300,
        );
      },

      // ─────────────────────────────────────────────────────────────
      // AUTO-APPLY FROM QUERY STRING
      // If the URL already supplies all fields required by the current
      // doctype, run the search automatically instead of waiting for the
      // user to click Find.
      // ─────────────────────────────────────────────────────────────
      _autoApplyFromQuery: function () {
        var oModel = this.getView().getModel("appModel");
        var oValues = {
          order: (oModel.getProperty("/orderInput") || "").trim(),
          date: oModel.getProperty("/selectedDate"),
          shift: oModel.getProperty("/selectedShift"),
          reservationNumber: (
            oModel.getProperty("/reservationNumberInput") || ""
          ).trim(),
          materialDoc: (oModel.getProperty("/materialDocInput") || "").trim(),
          materialDocYear: (
            oModel.getProperty("/materialDocYearInput") || ""
          ).trim(),
        };

        if (!this._oDocConfig.validate(oValues)) {
          this.onGoPrintJobCard();
        }
      },

      // ─────────────────────────────────────────────────────────────
      // VALUE HELP (F4) – job card: order, shift date, shift
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
            Base_url +
            "/api/f4/" +
            (sHelpId.indexOf("/") > -1 ? sHelpId : "jobcard_print/" + sHelpId) +
            "?" +
            $.param(oParams),
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

      _openValueHelp: function (
        sTitle,
        sHelpId,
        oExtraParams,
        fnSelected,
        bTextAsTitle,
      ) {
        var that = this;
        var oListModel = new JSONModel({ items: [] });
        var oDialog = new SelectDialog({
          title: sTitle,
          items: {
            path: "/items",
            template: new StandardListItem({
              title: bTextAsTitle ? "{text}" : "{key}",
              description: bTextAsTitle ? "" : "{desc}",
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
                        new Filter("text", FilterOperator.Contains, sVal),
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
              fnSelected(oItem.getBindingContext().getProperty("key"));
            }
          },
          cancel: function () {},
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

      // ─────────────────────────────────────────────────────────────
      // QR SCAN (job card) – html5-qrcode, scans once then stops
      // ─────────────────────────────────────────────────────────────
      onScanQr: function () {
        var that = this;
        if (typeof Html5Qrcode === "undefined") {
          MessageBox.error("QR scanner library not loaded.");
          return;
        }

        var oScanner = null;
        var fnStop = function () {
          if (!oScanner) {
            return Promise.resolve();
          }
          var o = oScanner;
          oScanner = null;
          return o
            .stop()
            .catch(function () {})
            .then(function () {
              try {
                o.clear();
              } catch (e) {}
            });
        };

        var oDialog = new Dialog({
          title: "Scan Job Card QR",
          contentWidth: "340px",
          content: [
            new HTML({
              content:
                "<div id='qrScanReader' style='width:100%;min-height:260px'></div>",
            }),
          ],
          endButton: new Button({
            text: "Cancel",
            press: function () {
              fnStop().then(function () {
                oDialog.close();
              });
            },
          }),
          afterClose: function () {
            fnStop();
            oDialog.destroy();
          },
        });

        oDialog.attachAfterOpen(function () {
          oScanner = new Html5Qrcode("qrScanReader");
          oScanner
            .start(
              { facingMode: "environment" },
              { fps: 10, qrbox: { width: 220, height: 220 } },
              function (sText) {
                fnStop().then(function () {
                  oDialog.close();
                  that._processQrScanResult(sText);
                });
              },
              function () {},
            )
            .catch(function () {
              oScanner = null;
              oDialog.close();
              MessageBox.error("Unable to access the camera.");
            });
        });
        oDialog.open();
      },

      // 2D hardware scanner types the QR text into the field, then sends Enter
      onQrInputSubmit: function () {
        var oModel = this.getView().getModel("appModel");
        var sText = (oModel.getProperty("/qrInput") || "").trim();
        oModel.setProperty("/qrInput", "");
        if (!sText) {
          return;
        }
        this._processQrScanResult(sText);
        setTimeout(
          function () {
            this.byId("qrInput").focus();
          }.bind(this),
          0,
        );
      },

      _processQrScanResult: function (sText) {
        if (this._oDocConfig === DOC_TYPES.requisition) {
          // Expected format: "Reservation No-368126"
          var aRes = /^\s*Reservation\s*No\s*[-:]\s*(\d+)\s*$/i.exec(
            String(sText),
          );
          if (!aRes) {
            MessageBox.error("Invalid QR scanned.");
            return;
          }
          this.getView()
            .getModel("appModel")
            .setProperty("/reservationNumberInput", aRes[1]);
          this.onGoPrintJobCard();
          return;
        }

        if (this._oDocConfig.fields === "materialDoc") {
          // Expected format: "Material Doc-4904980045,Doc Year-2026"
          var aMat =
            /Material\s*Doc\s*[-:]\s*(\d+)\s*,\s*Doc\s*Year\s*[-:]\s*(\d{4})/i.exec(
              String(sText),
            );
          if (!aMat) {
            MessageBox.error("Invalid QR scanned.");
            return;
          }
          var oMatModel = this.getView().getModel("appModel");
          oMatModel.setProperty("/materialDocInput", aMat[1]);
          oMatModel.setProperty("/materialDocYearInput", aMat[2]);
          this.onGoPrintJobCard();
          return;
        }

        var oData = null;
        try {
          oData = JSON.parse(sText);
        } catch (e) {
          oData = null;
        }

        var sOrder = oData && String(oData["Order No"] || "").trim();
        var sShift = oData && String(oData["Shift ID"] || "").trim();
        var aDate =
          oData &&
          /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(
            String(oData["Shift Date"] || "").trim(),
          );

        if (!sOrder || !sShift || !aDate) {
          MessageBox.error("Invalid QR scanned.");
          return;
        }

        var oModel = this.getView().getModel("appModel");
        oModel.setProperty("/orderInput", sOrder.replace(/^0+(?=\d)/, ""));
        oModel.setProperty("/selectedShift", sShift);
        oModel.setProperty(
          "/selectedDate",
          aDate[3] + "-" + aDate[2] + "-" + aDate[1],
        );
        this.onGoPrintJobCard();
      },

      onMaterialDocYearValueHelp: function () {
        var oModel = this.getView().getModel("appModel");
        this._openValueHelp(
          "Select Material Doc Year",
          this._oDocConfig.f4App + "/" + this._oDocConfig.f4Years,
          {},
          function (s) {
            oModel.setProperty("/materialDocYearInput", s);
          },
        );
      },

      onMaterialDocValueHelp: function () {
        var oModel = this.getView().getModel("appModel");
        this._openValueHelp(
          "Select Material Document",
          this._oDocConfig.f4App + "/" + this._oDocConfig.f4Docs,
          { year: (oModel.getProperty("/materialDocYearInput") || "").trim() },
          function (s) {
            oModel.setProperty("/materialDocInput", s);
          },
        );
      },

      onReservationValueHelp: function () {
        var oModel = this.getView().getModel("appModel");
        this._openValueHelp(
          "Select Reservation",
          "reservation_print/reservations",
          {},
          function (s) {
            oModel.setProperty("/reservationNumberInput", s);
          },
        );
      },

      onOrderValueHelp: function () {
        var oModel = this.getView().getModel("appModel");
        this._openValueHelp(
          "Select Order",
          "orders_with_jobcards",
          {},
          function (s) {
            oModel.setProperty("/orderInput", s);
          },
        );
      },

      onShiftDateValueHelp: function () {
        var oModel = this.getView().getModel("appModel");
        this._openValueHelp(
          "Select Shift Date",
          "shift_dates_jobcards",
          { order: (oModel.getProperty("/orderInput") || "").trim() },
          function (s) {
            // key is yyyyMMdd; the model/API use yyyy-MM-dd
            oModel.setProperty(
              "/selectedDate",
              s.replace(/^(\d{4})(\d{2})(\d{2})$/, "$1-$2-$3"),
            );
          },
          true,
        );
      },

      onShiftValueHelp: function () {
        var oModel = this.getView().getModel("appModel");
        this._openValueHelp(
          "Select Shift",
          "shifts",
          {
            order: (oModel.getProperty("/orderInput") || "").trim(),
            shiftDate: oModel.getProperty("/selectedDate"),
          },
          function (s) {
            oModel.setProperty("/selectedShift", s);
          },
        );
      },

      // ─────────────────────────────────────────────────────────────
      // DOCUMENT DOWNLOAD (job card / reservation / issue / receipt slip)
      // ─────────────────────────────────────────────────────────────
      onGoPrintJobCard: function () {
        var oModel = this.getView().getModel("appModel");
        var oDocConfig = this._oDocConfig;

        var oValues = {
          order: (oModel.getProperty("/orderInput") || "").trim(),
          date: oModel.getProperty("/selectedDate"),
          shift: oModel.getProperty("/selectedShift"),
          reservationNumber: (
            oModel.getProperty("/reservationNumberInput") || ""
          ).trim(),
          materialDoc: (oModel.getProperty("/materialDocInput") || "").trim(),
          materialDocYear: (
            oModel.getProperty("/materialDocYearInput") || ""
          ).trim(),
        };

        var sValidationError = oDocConfig.validate(oValues);
        if (sValidationError) {
          MessageToast.show(sValidationError);
          return;
        }

        oModel.setProperty("/appliedSummary", oDocConfig.summary(oValues));
        oModel.setProperty("/resultVisible", false);
        oModel.setProperty("/errorVisible", false);

        var sUrl = oDocConfig.buildUrl(oValues);

        this.getView().setBusy(true);

        var that = this;
        var oNativeXhr;
        $.ajax({
          url: sUrl,
          method: "GET",
          headers: ngrokHeaders,
          xhrFields: {
            responseType: "arraybuffer",
          },
          xhr: function () {
            oNativeXhr = $.ajaxSettings.xhr();
            return oNativeXhr;
          },
          complete: function (jqXHR) {
            that.getView().setBusy(false);

            console.log("API response headers:", jqXHR.getAllResponseHeaders());

            var fnShowError = function (sMsg) {
              oModel.setProperty("/errorMessage", sMsg);
              oModel.setProperty("/errorVisible", true);
            };

            if (jqXHR.status === 0) {
              fnShowError("Network error. Please try again.");
              return;
            }

            var aBytes = new Uint8Array(oNativeXhr.response || []);
            // JSON error payloads start with '{' (0x7B); PDF payloads start with '%PDF' (0x25)
            var bIsJson = aBytes.length > 0 && aBytes[0] === 0x7b;

            var oResp = null;
            if (bIsJson) {
              try {
                oResp = JSON.parse(new TextDecoder("utf-8").decode(aBytes));
              } catch (e) {
                oResp = null;
              }
            }

            console.log(
              "API response:",
              bIsJson ? oResp : "<binary PDF, " + aBytes.length + " bytes>",
            );

            if (jqXHR.status === 200 && oResp && oResp.success === false) {
              var sErrMsg =
                (oResp.error &&
                  oResp.error.error &&
                  oResp.error.error.message &&
                  oResp.error.error.message.value) ||
                oResp.message ||
                "Failed to fetch document.";
              fnShowError(sErrMsg);
            } else if (jqXHR.status === 200 && !bIsJson) {
              var pdfBlob = new Blob([aBytes], {
                type: "application/pdf",
              });
              var pdfUrl = URL.createObjectURL(pdfBlob);
              oModel.setProperty("/pdfUrl", pdfUrl);
              oModel.setProperty("/resultVisible", true);
            } else {
              var sMsg =
                (oResp &&
                  oResp.error &&
                  oResp.error.error &&
                  oResp.error.error.message &&
                  oResp.error.error.message.value) ||
                (oResp && oResp.message) ||
                "Failed to fetch document.";
              fnShowError(sMsg);
            }
          },
        });
      },

      onOpenDocument: function () {
        var sPdfUrl = this.getView()
          .getModel("appModel")
          .getProperty("/pdfUrl");
        if (sPdfUrl) {
          window.open(sPdfUrl, "_blank");
        }
      },

      // ─────────────────────────────────────────────────────────────
      // FORMATTERS
      // ─────────────────────────────────────────────────────────────
      formatPdfIframe: function (sPdfUrl) {
        if (!sPdfUrl) {
          return "";
        }
        return (
          "<iframe class='jobCardPdfViewer' src='" +
          sPdfUrl.replace(/'/g, "&#39;") +
          "'></iframe>"
        );
      },

      // ─────────────────────────────────────────────────────────────
      // LOGOUT
      // ─────────────────────────────────────────────────────────────
      onLogout: function () {
        MessageBox.confirm("Are you sure you want to logout?", {
          title: "Confirm Logout",
          icon: MessageBox.Icon.WARNING,
          actions: [MessageBox.Action.YES, MessageBox.Action.NO],
          emphasizedAction: MessageBox.Action.YES,
          onClose: function (sAction) {
            if (sAction === MessageBox.Action.YES) {
              var sExpired = "; path=/; max-age=0";
              document.cookie = "employeeId=" + sExpired;
              document.cookie = "sessionId=" + sExpired;
              document.cookie = "plant=" + sExpired;
              document.cookie = "username=" + sExpired;
              window.location.href = Login_Url;
            }
          },
        });
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
