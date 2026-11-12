sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageBox",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/HTML",
    "sap/m/Dialog",
  ],
  (Controller, MessageBox, JSONModel, HTML, Dialog) => {
    "use strict";

    // TODO: point these at the real backend / login app for this environment.
    const Base_url = "http://localhost:3000";
    // const Base_url = "http://192.168.1.61:3000";
    // const Base_url = "http://192.168.0.136:3000";

    const Login_Url = "http://localhost:9000/index.html";
    // const Login_Url = "https://romsonsfiori.incresol.com/LoginApp";
    // const Login_Url = "https://webapps.romsons.com/LoginApp/index.html";

    const ngrokHeaders = { "ngrok-skip-browser-warning": "69420" };

    return Controller.extend("productionorderconfirmlist.controller.View1", {
      // ── Formatters ──────────────────────────────────────────────────
      // Falls back to "NA" for any missing/empty value.
      formatOrNA: function (vValue) {
        if (vValue === null || vValue === undefined || vValue === "") {
          return "NA";
        }
        return vValue;
      },

      // Converts an ISO-8601 duration ("PT09H00M00S") into "HH:MM" for
      // display; returns the raw value unchanged if it doesn't match.
      formatDuration: function (sDuration) {
        if (!sDuration) {
          return "";
        }
        var oMatch = sDuration.toString().match(/PT(\d+)H(\d+)M(\d+)S/);
        if (!oMatch) {
          return sDuration;
        }
        var sHours = oMatch[1].padStart(2, "0");
        var sMinutes = oMatch[2].padStart(2, "0");
        return sHours + ":" + sMinutes;
      },

      // Combines an OData date + an ISO-8601 duration into "dd MMM yyyy HH:MM".
      formatDateTime: function (sDate, sDuration) {
        if (!sDate) {
          return "NA";
        }
        var sFormattedDate = this.formatODataDate(sDate);
        var sFormattedTime = this.formatDuration(sDuration);
        return sFormattedTime
          ? sFormattedDate + " " + sFormattedTime
          : sFormattedDate;
      },

      // Converts OData's "/Date(<ms>)/" JSON format into "dd MMM yyyy".
      formatODataDate: function (sDate) {
        if (!sDate) {
          return "NA";
        }
        var oMatch = sDate.toString().match(/\/Date\((\d+)\)\//);
        if (!oMatch) {
          return sDate;
        }
        var oDate = new Date(parseInt(oMatch[1], 10));
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
          String(oDate.getUTCDate()).padStart(2, "0") +
          " " +
          aMonths[oDate.getUTCMonth()] +
          " " +
          oDate.getUTCFullYear()
        );
      },

      // ── Init ────────────────────────────────────────────────────────
      onInit: function () {
        this._sScannedJobCardId = null;

        var oLogo = this.byId("appLogo");
        if (oLogo) {
          var sLogoUrl = sap.ui.require.toUrl(
            "productionorderconfirmlist/images/logoNew.svg",
          );
          oLogo.setSrc(sLogoUrl);
        }

        var bValid = this._enforceSession();
        if (bValid) {
          this._startSessionCheck();
          var oCookies = this._parseCookies();
          this.getView().setModel(
            new JSONModel({
              employeeId: oCookies["employeeId"],
              plant: oCookies["plant"],
            }),
            "appModel",
          );
        }

        const oUrlParams = new URLSearchParams(window.location.search);
        const sOrderId = oUrlParams.get("order");
        const sUrlDate = oUrlParams.get("date");
        const sUrlShift = oUrlParams.get("shift");

        var sToday = new Date().toISOString().split("T")[0];
        var sFilterDate = sUrlDate || sToday;

        this.getView().setModel(
          new JSONModel({
            filterOrder: sOrderId || "",
            filterDate: sFilterDate,
            filterShift: sUrlShift || "",
            filtersDirty: false,
            listLoaded: false,
            grnAlreadyCreated: false,
          }),
          "viewModel",
        );

        this.getView().setModel(
          new JSONModel({ results: [] }),
          "orderListModel",
        );

        this._aOperationList = [];
        this.getView().setModel(
          new JSONModel({ visible: false, order: "", steps: [], infoText: "" }),
          "opSeqModel",
        );

        this._fetchOperationList(sOrderId || "");

        if (sOrderId || sUrlDate || sUrlShift) {
          this._applyFilters(sOrderId || "", sFilterDate, sUrlShift || "");
        }
      },

      // ── Operation List (fetched once on init) ─────────────────────────
      _fetchOperationList: function (sOrderId) {
        var o = this._getSessionParams();
        var sOrderPadded = (sOrderId || "").toString().padStart(12, "0");
        var sUrl =
          Base_url +
          "/api/operatorAssignment/getOperationList/" +
          o.employeeId +
          "/" +
          o.plant +
          "/" +
          o.sessionId +
          "/" +
          sOrderPadded;

        $.ajax({
          url: sUrl,
          method: "GET",
          headers: ngrokHeaders,
          contentType: "application/json",
          success: function (oResponse) {
            var aOperations = Array.isArray(oResponse)
              ? oResponse
              : (oResponse && oResponse.results) || [];

            var aTrimmed = aOperations
              .map(function (oOp) {
                return {
                  operation: oOp.operation,
                  operationDesc: oOp.operationDesc,
                };
              })
              .sort(function (a, b) {
                return (a.operation || "").localeCompare(b.operation || "");
              });

            var sHighestOperation = aTrimmed.length
              ? aTrimmed[aTrimmed.length - 1].operation
              : null;

            aTrimmed.forEach(function (oOp) {
              oOp.operationType =
                oOp.operation === sHighestOperation
                  ? "Final Operation"
                  : "Intermediate Operation";
            });

            console.log("Operation list:", aTrimmed);

            this._aOperationList = aTrimmed;
            this._updateOperationSequence();
          }.bind(this),
          error: function (oXHR, sStatus, sError) {
            console.log("Operation list error:", oXHR, sStatus, sError);
          },
        });
      },

      // ── Operation Sequence strip (above the confirm list table) ──────
      // Combines the operation list (operation/operationDesc/operationType)
      // with whether each operation already has at least one confirmation
      // in the currently loaded orderListModel, and publishes it as plain
      // step data for the view to render with standard sap.m controls
      // (Avatar, Icon, ObjectStatus) — no raw HTML.
      _updateOperationSequence: function () {
        var aOps = this._aOperationList || [];
        var oOpSeqModel = this.getView().getModel("opSeqModel");

        if (aOps.length === 0) {
          oOpSeqModel.setData({
            visible: false,
            order: "",
            steps: [],
            infoText: "",
          });
          return;
        }

        var aResults =
          this.getView().getModel("orderListModel").getProperty("/results") ||
          [];
        var oConfirmedOps = {};
        aResults.forEach(function (oRow) {
          if (oRow.operation) {
            oConfirmedOps[oRow.operation] = true;
          }
        });

        var sOrder =
          (aResults[0] && aResults[0].order) ||
          this.getView().getModel("viewModel").getProperty("/filterOrder") ||
          "";

        var aSteps = aOps.map(function (oOp, iIndex) {
          var bFinal = oOp.operationType === "Final Operation";
          var bConfirmed = !!oConfirmedOps[oOp.operation];

          return {
            operation: oOp.operation,
            operationDesc: oOp.operationDesc,
            confirmed: bConfirmed,
            isFinal: bFinal,
            isLast: iIndex === aOps.length - 1,
            avatarIcon: "sap-icon://accept",
            tickColor: bConfirmed ? "#ffffff" : "#8a938d",
            tickBg: bConfirmed ? "#1b5e3a" : "#e8ecea",
            chipText: bFinal
              ? "Final - GRN eligible"
              : bConfirmed
                ? "Confirmed"
                : "Pending",
            chipState: bFinal || bConfirmed ? "Success" : "None",
          };
        });

        var oFinalOp = aSteps.filter(function (oStep) {
          return oStep.isFinal;
        })[0];

        var sInfoText =
          "Only the final operation" +
          (oFinalOp ? " (" + oFinalOp.operation + ")" : "") +
          " can be submitted for GRN; earlier operations are shown for traceability only.";

        oOpSeqModel.setData({
          visible: true,
          order: sOrder,
          steps: aSteps,
          infoText: sInfoText,
        });
      },

      // ── Cookie / session helpers ───────────────────────────────────
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

      _getSessionParams: function () {
        var oCookies = this._parseCookies();
        return {
          employeeId: oCookies["employeeId"],
          plant: oCookies["plant"],
          sessionId: oCookies["sessionId"],
        };
      },

      // ── Session enforcement (redirects to login if cookies missing) ──
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

      // ── Periodic session validity check ─────────────────────────────
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

      // ── Logout ──────────────────────────────────────────────────────
      onLogout: function () {
        MessageBox.confirm("Are you sure you want to logout?", {
          title: "Confirm Logout",
          icon: MessageBox.Icon.WARNING,
          actions: [MessageBox.Action.YES, MessageBox.Action.NO],
          emphasizedAction: MessageBox.Action.YES,
          onClose: function (sAction) {
            if (sAction === MessageBox.Action.YES) {
              if (this._oSessionCheckTimer) {
                clearInterval(this._oSessionCheckTimer);
              }
              ["employeeId", "sessionId", "plant"].forEach(function (sKey) {
                document.cookie =
                  sKey + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
              });
              window.location.href = Login_Url;
            }
          }.bind(this),
        });
      },

      // ── Unapplied-filter warning ────────────────────────────────────
      _markFiltersDirty: function () {
        this.getView().getModel("viewModel").setProperty("/filtersDirty", true);
      },

      onOrderIdChange: function () {
        this._markFiltersDirty();

        // Manual edit invalidates any Job Card No captured from a
        // previous scan — go back to the concatenated fallback.
        this._sScannedJobCardId = null;
      },

      onFilterDateChange: function () {
        this._markFiltersDirty();
      },

      onShiftChange: function () {
        this._markFiltersDirty();
      },

      // ── Clear Filter ─────────────────────────────────────────────────
      onClearFilter: function () {
        var oModel = this.getView().getModel("viewModel");
        var sToday = new Date().toISOString().split("T")[0];

        oModel.setProperty("/filterOrder", "");
        oModel.setProperty("/filterDate", sToday);
        oModel.setProperty("/filterShift", "");
        oModel.setProperty("/filtersDirty", false);
        oModel.setProperty("/listLoaded", false);
        oModel.setProperty("/grnAlreadyCreated", false);
        this._sScannedJobCardId = null;

        this.getView().setModel(
          new JSONModel({ results: [] }),
          "orderListModel",
        );

        this._aOperationList = [];
        this.getView()
          .getModel("opSeqModel")
          .setData({ visible: false, order: "", steps: [], infoText: "" });

        var oOrderInput = this.byId("orderFilterInput");
        if (oOrderInput) {
          oOrderInput.setValue("");
        }
        var oDateInput = this.byId("dateFilterInput");
        if (oDateInput) {
          oDateInput.setValue(sToday);
        }
        var oShiftInput = this.byId("shiftInput");
        if (oShiftInput) {
          oShiftInput.setValue("");
        }

        sap.m.MessageToast.show("Filters cleared.");
      },

      // ── Apply Filter ────────────────────────────────────────────────
      onApplyFilter: function () {
        var oModel = this.getView().getModel("viewModel");
        var sOrderId = (oModel.getProperty("/filterOrder") || "").trim();
        var sFilterDate = oModel.getProperty("/filterDate");
        var sShiftId = (oModel.getProperty("/filterShift") || "").trim();

        if (!sFilterDate) {
          sap.m.MessageToast.show("Please select a date.");
          return;
        }

        this._applyFilters(sOrderId, sFilterDate, sShiftId);
      },

      // ── Shared filter-apply logic (manual Apply click, URL deep link, or
      //     scan) ─────────────────────────────────────────────────────────
      _applyFilters: function (sOrderId, sFilterDate, sShiftId) {
        var oModel = this.getView().getModel("viewModel");
        oModel.setProperty("/filtersDirty", false);

        // Prefer the Job Card No captured from a QR scan, if any; only
        // fall back to concatenating {OrderNo}-{yyyyMMdd}-{ShiftId} when
        // scanning didn't provide one (sFilterDate is already
        // yyyy-MM-dd — DatePicker valueFormat).
        var sJobCardNo = this._sScannedJobCardId;
        if (!sJobCardNo) {
          var sJobCardDate = (sFilterDate || "").split("-").join("");
          sJobCardNo = [sOrderId, sJobCardDate, sShiftId]
            .filter(Boolean)
            .join("-");
        }
        console.log("Job Card ID:", sJobCardNo);

        var o = this._getSessionParams();
        var sUrl =
          Base_url +
          "/api/productionconfirmation/prodorderconfirmlist/" +
          sJobCardNo +
          "/" +
          o.plant +
          "/" +
          o.sessionId +
          "/" +
          o.employeeId;

        this.getView().setBusy(true);
        $.ajax({
          url: sUrl,
          method: "GET",
          headers: ngrokHeaders,
          contentType: "application/json",
          success: function (oResponse) {
            console.log("Prod order confirm list:", oResponse);
            // The API may return either a plain array or the classic
            // OData { results: [...] } envelope — support both.
            var aHeaders = Array.isArray(oResponse)
              ? oResponse
              : (oResponse && oResponse.results) || [];
            var aClean = this._cleanConfirmations(aHeaders);
            this.getView().setModel(
              new JSONModel({ results: aClean }),
              "orderListModel",
            );
            oModel.setProperty("/listLoaded", true);
            // Only the first job card is checked — if it already has a
            // GRN document, show that notice instead of the Submit button.
            oModel.setProperty(
              "/grnAlreadyCreated",
              !!(aClean[0] && aClean[0].grnAlreadyCreated),
            );

            this._updateOperationSequence();

            var oFilterSelect = this.byId("operationStatusFilter");
            if (oFilterSelect) {
              oFilterSelect.setSelectedKey("Final");
            }
            this._applyOperationStatusFilter("Final");
          }.bind(this),
          error: function (oXHR, sStatus, sError) {
            console.log(
              "Prod order confirm list error:",
              oXHR,
              sStatus,
              sError,
            );
            this.getView().setModel(
              new JSONModel({ results: [] }),
              "orderListModel",
            );
            oModel.setProperty("/listLoaded", true);
            MessageBox.error("Failed to fetch order confirm list.");
          }.bind(this),
          complete: function () {
            this.getView().setBusy(false);
          }.bind(this),
        });
      },

      // ── Cleans the JobCardList response for display: each job card
      //    carries its confirmations under npToConfirmation.results[] —
      //    flatten that into one row per confirmation, stamping the
      //    parent job card's fields (jobCard, order, shiftId, shiftDt,
      //    houseId, houseDesc, assigOper) onto every confirmation row.
      //    Each confirmation's own npToItem is unwrapped into a plain
      //    "items" array (falls back to [] when there's nothing to
      //    unwrap, e.g. __deferred).
      _cleanConfirmations: function (aJobCards) {
        var aRows = [];

        aJobCards.forEach(function (oJobCard) {
          var oJobCardInfo = {
            jobCard: oJobCard.jobCardNo,
            order: oJobCard.order,
            shiftId: oJobCard.shiftId,
            shiftDt: oJobCard.shiftDt,
            houseId: oJobCard.houseId,
            houseDesc: oJobCard.houseDesc,
            assigOper: oJobCard.assigOper,
          };

          var aConfirmations =
            (oJobCard.npToConfirmation && oJobCard.npToConfirmation.results) ||
            [];

          if (aConfirmations.length === 0) {
            // No confirmations for this job card — don't add a row for
            // it; the table's noDataText ("No confirmation found") will
            // show instead if this leaves the whole list empty.
            return;
          }

          aConfirmations.forEach(function (oConfirmation) {
            var oClean = Object.assign({}, oJobCardInfo, oConfirmation);
            delete oClean.__metadata;

            var aItems =
              (oConfirmation.npToItem && oConfirmation.npToItem.results) || [];
            oClean.items = aItems.map(function (oItem) {
              var oCleanItem = Object.assign({}, oItem);
              delete oCleanItem.__metadata;
              return oCleanItem;
            });
            delete oClean.npToItem;

            aRows.push(oClean);
          });
        });

        return aRows.map(function (oRow, iIndex) {
          // Only the first row opens expanded by default; the rest
          // start collapsed.
          oRow.expanded = iIndex === 0;

          // A GRN document already exists for this confirmation once it
          // has been confirmed by someone AND has a real material doc
          // no/year.
          oRow.grnAlreadyCreated = !!(
            oRow.grnDoneBy &&
            oRow.materialDocNo &&
            oRow.materialDocYear &&
            oRow.materialDocYear !== "0000"
          );

          // status "X" = the final operation for this job card; anything
          // else is an intermediate operation and can't be submitted for GRN.
          oRow.isFinalOps = oRow.status === "X";

          // Nothing is pre-selected on load — the user picks which
          // confirmation(s) to submit for GRN.
          oRow.selected = false;

          return oRow;
        });
      },

      // ── F4 value helps (GET /api/f4/:appid/:helpid) ──────────────────
      onOrderValueHelp: function () {
        this._openF4(
          "orders_with_confirmations",
          "Select Order",
          function (sKey) {
            var oModel = this.getView().getModel("viewModel");
            oModel.setProperty("/filterOrder", sKey);
            this._sScannedJobCardId = null;
            this._markFiltersDirty();
            this._fetchOperationList(sKey);
          },
        );
      },

      onDateValueHelp: function () {
        this._openF4(
          "shift_dates_confirmations",
          "Select Date",
          function (sKey) {
            this.getView()
              .getModel("viewModel")
              .setProperty("/filterDate", this._normalizeF4Date(sKey));
            this._markFiltersDirty();
          },
          true,
        );
      },

      onShiftValueHelp: function () {
        this._openF4("shifts", "Select Shift", function (sKey) {
          this.getView()
            .getModel("viewModel")
            .setProperty("/filterShift", sKey);
          this._markFiltersDirty();
        });
      },

      _openF4: function (sHelpId, sTitle, fnSelect, bTitleFromText) {
        var o = this._getSessionParams();
        var sUrl =
          Base_url +
          "/api/f4/order_conf_list/" +
          sHelpId +
          "?empid=" +
          encodeURIComponent(o.employeeId) +
          "&sesid=" +
          encodeURIComponent(o.sessionId) +
          "&plant=" +
          encodeURIComponent(o.plant);

        this.getView().setBusy(true);
        $.ajax({
          url: sUrl,
          method: "GET",
          headers: ngrokHeaders,
          contentType: "application/json",
          success: function (oResponse) {
            console.log("F4 " + sHelpId + ":", oResponse);
            this._showF4Dialog(
              sTitle,
              this._mapF4Rows(oResponse, bTitleFromText),
              fnSelect,
            );
          }.bind(this),
          error: function (oXHR, sStatus, sError) {
            console.log("F4 " + sHelpId + " error:", oXHR, sStatus, sError);
            MessageBox.error(
              "Failed to fetch " + sTitle.toLowerCase() + " list.",
            );
          },
          complete: function () {
            this.getView().setBusy(false);
          }.bind(this),
        });
      },

      // F4 response: { values: [{ key, key2, text, info }] }. The list item
      // shows the key (or the text when bTitleFromText, e.g. dates) with
      // text/info as the description; the key is what gets selected.
      _mapF4Rows: function (oResponse, bTitleFromText) {
        var aRows = (oResponse && oResponse.values) || [];
        return aRows.map(function (oRow) {
          var aDesc = bTitleFromText ? [oRow.info] : [oRow.text, oRow.info];
          return {
            key: String(oRow.key),
            title: bTitleFromText ? oRow.text || oRow.key : String(oRow.key),
            description: aDesc.filter(Boolean).join(" · "),
          };
        });
      },

      _normalizeF4Date: function (sValue) {
        var sVal = String(sValue || "").trim();
        var oOData = sVal.match(/\/Date\((\d+)\)\//);
        if (oOData) {
          return new Date(parseInt(oOData[1], 10)).toISOString().split("T")[0];
        }
        var oDots = sVal.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
        if (oDots) {
          return oDots[3] + "-" + oDots[2] + "-" + oDots[1];
        }
        var oCompact = sVal.match(/^(\d{4})(\d{2})(\d{2})$/);
        if (oCompact) {
          return oCompact[1] + "-" + oCompact[2] + "-" + oCompact[3];
        }
        return sVal;
      },

      _showF4Dialog: function (sTitle, aRows, fnSelect) {
        var that = this;
        var oDialog = new sap.m.SelectDialog({
          title: sTitle,
          noDataText: "No data found",
          items: {
            path: "/items",
            template: new sap.m.StandardListItem({
              title: "{title}",
              description: "{description}",
              customData: [
                new sap.ui.core.CustomData({ key: "f4key", value: "{key}" }),
              ],
            }),
          },
          search: function (oEvent) {
            var sValue = oEvent.getParameter("value");
            oEvent
              .getSource()
              .getBinding("items")
              .filter(
                sValue
                  ? [
                      new sap.ui.model.Filter({
                        filters: [
                          new sap.ui.model.Filter(
                            "title",
                            sap.ui.model.FilterOperator.Contains,
                            sValue,
                          ),
                          new sap.ui.model.Filter(
                            "description",
                            sap.ui.model.FilterOperator.Contains,
                            sValue,
                          ),
                        ],
                        and: false,
                      }),
                    ]
                  : [],
              );
          },
          confirm: function (oEvent) {
            var oItem = oEvent.getParameter("selectedItem");
            if (oItem) {
              fnSelect.call(that, oItem.data("f4key"));
            }
          },
          cancel: function () {},
          afterClose: function () {
            oDialog.destroy();
          },
        });
        oDialog.setModel(new JSONModel({ items: aRows }));
        this.getView().addDependent(oDialog);
        oDialog.open();
      },

      // ── Operation Status filter (All / Final / Intermediate) ─────────
      onOperationStatusFilterChange: function (oEvent) {
        this._applyOperationStatusFilter(
          oEvent.getParameter("selectedItem").getKey(),
        );
      },

      _applyOperationStatusFilter: function (sKey) {
        var oBinding = this.byId("orderConfirmListTable").getBinding("items");
        if (!oBinding) {
          return;
        }

        if (sKey === "All") {
          oBinding.filter([]);
          return;
        }

        var oFilter = new sap.ui.model.Filter(
          "isFinalOps",
          sap.ui.model.FilterOperator.EQ,
          sKey === "Final",
        );
        oBinding.filter([oFilter]);
      },

      // ── Row selection (Table mode="MultiSelect") — block selecting a
      //    row whose GRN is already done, or that's an intermediate
      //    (non-final) operation, and revert its checkbox. ─────────────
      onOrderListSelectionChange: function (oEvent) {
        var bSelected = oEvent.getParameter("selected");
        if (!bSelected) {
          return;
        }

        var aListItems = oEvent.getParameter("listItems");
        if (!aListItems || aListItems.length === 0) {
          var oSingle = oEvent.getParameter("listItem");
          aListItems = oSingle ? [oSingle] : [];
        }

        var oOrderListModel = this.getView().getModel("orderListModel");
        var sBlockedMsg = "";

        aListItems.forEach(function (oListItem) {
          var oContext = oListItem.getBindingContext("orderListModel");
          var oRow = oContext && oContext.getObject();
          if (!oRow) {
            return;
          }

          if (oRow.grnAlreadyCreated) {
            oListItem.setSelected(false);
            oOrderListModel.setProperty(
              oContext.getPath() + "/selected",
              false,
            );
            sBlockedMsg =
              "GRN is already done for this confirmation. Cannot select.";
          } else if (!oRow.isFinalOps) {
            oListItem.setSelected(false);
            oOrderListModel.setProperty(
              oContext.getPath() + "/selected",
              false,
            );
            sBlockedMsg =
              "This is an intermediate operation. Only the final operation can be submitted for GRN.";
          }
        });

        if (sBlockedMsg) {
          sap.m.MessageToast.show(sBlockedMsg);
        }
      },

      // ── View Confirmation (popup with the selected row's npToItem data) ──
      onViewConfirmationPress: function (oEvent) {
        var oContext = oEvent.getSource().getBindingContext("orderListModel");
        var oRow = oContext ? oContext.getObject() : null;
        var aItems = (oRow && oRow.items) || [];
        console.log("View Confirmation - npToItem data:", aItems);

        var oTable = this.byId("confirmationItemsTable");
        var oDialog = this.byId("confirmationItemsDialog");

        // Build the rows directly (no data binding) — one ColumnListItem
        // per npToItem entry, in the same order as the table's columns.
        oTable.removeAllItems();
        aItems.forEach(function (oItem) {
          oTable.addItem(
            new sap.m.ColumnListItem({
              cells: [
                new sap.m.Text({ text: oItem.confirmationNo }),
                new sap.m.Text({ text: oItem.operation }),
                new sap.m.ObjectStatus({
                  text: oItem.employeeId,
                  icon: "sap-icon://employee",
                  state: "Success",
                  inverted: true,
                }),
                new sap.m.ObjectNumber({
                  number: oItem.yieldQty,
                  unit: oItem.unit,
                }),
                new sap.m.ObjectNumber({
                  number: oItem.scrapQty,
                  unit: oItem.unit,
                }),
                new sap.m.ObjectNumber({
                  number: oItem.reworkQty,
                  unit: oItem.unit,
                }),
                new sap.m.Text({ text: oItem.unit }),
                new sap.m.Text({ text: oItem.order }),
              ],
            }),
          );
        }, this);

        console.log(
          "Confirmation items table row count:",
          oTable.getItems().length,
        );

        oDialog.open();
      },

      onCloseConfirmationItemsDialog: function () {
        this.byId("confirmationItemsDialog").close();
      },

      // ── Order ID Scanner (QR / Barcode) ─────────────────────────────
      onScanOrderId: function () {
        if (typeof Html5Qrcode === "undefined") {
          MessageBox.error(
            "Scanner library failed to load. Please check your internet connection.",
          );
          return;
        }

        const that = this;

        if (!this._oScanDialog) {
          this._oScanDialog = new Dialog({
            title: "Scan Order ID",
            contentWidth: "360px",
            content: [
              new HTML({
                content: '<div id="orderScanReader" style="width:100%;"></div>',
              }),
            ],
            beginButton: new sap.m.Button({
              text: "Cancel",
              icon: "sap-icon://decline",
              type: "Negative",
              press: function () {
                that._stopScanner();
                that._oScanDialog.close();
              },
            }),
            afterClose: function () {
              that._stopScanner();
            },
          });
          this.getView().addDependent(this._oScanDialog);
        }

        this._oScanDialog.open();

        // Give the dialog a moment to render the HTML container before
        // attaching the camera to it.
        setTimeout(function () {
          that._startScanner();
        }, 300);
      },

      _startScanner: function () {
        const that = this;
        this._bScanHandled = false;

        this._oHtml5Qrcode = new Html5Qrcode("orderScanReader");
        this._oHtml5Qrcode
          .start(
            { facingMode: "environment" },
            {
              fps: 10,
              qrbox: { width: 250, height: 150 },
            },
            function onScanSuccess(decodedText /*, decodedResult*/) {
              if (that._bScanHandled) {
                return;
              }
              that._bScanHandled = true;
              console.log("Scanned data:", decodedText);

              that._stopScanner();
              if (that._oScanDialog) {
                that._oScanDialog.close();
              }

              that._applyScannedOrder(decodedText);
            },
            function onScanFailure() {
              // ignore per-frame decode failures
            },
          )
          .catch(function (err) {
            MessageBox.error(
              "Unable to access the camera for scanning: " + err,
            );
          });
      },

      _applyScannedOrder: function (sDecodedText) {
        var oScanned = null;
        try {
          oScanned = JSON.parse(sDecodedText);
        } catch (e) {
          oScanned = null;
        }
        console.log("Parsed scanned data:", oScanned || sDecodedText);

        var sOrderNo = oScanned ? oScanned["Order No"] : sDecodedText;
        sOrderNo = (sOrderNo || "").toString().trim();

        if (!sOrderNo) {
          MessageBox.error(
            "Could not read an Order No. from the scanned code.",
          );
          return;
        }

        var sShiftDateRaw = oScanned ? oScanned["Shift Date"] : null;
        var sShiftId = oScanned ? oScanned["Shift ID"] : null;
        sShiftId = sShiftId ? sShiftId.toString().trim() : "";

        // If the scan carries the Job Card No directly, use it as-is on
        // the next Apply instead of concatenating order/date/shift.
        var sScannedJobCard = oScanned ? oScanned["Job Card"] : null;
        this._sScannedJobCardId = sScannedJobCard
          ? sScannedJobCard.toString().trim()
          : null;

        // Convert "dd.MM.yyyy" -> "yyyy-MM-dd" (DatePicker valueFormat)
        var sFilterDate = null;
        if (sShiftDateRaw) {
          var aParts = sShiftDateRaw.toString().trim().split(".");
          if (aParts.length === 3) {
            sFilterDate =
              aParts[2] +
              "-" +
              aParts[1].padStart(2, "0") +
              "-" +
              aParts[0].padStart(2, "0");
          }
        }

        var oModel = this.getView().getModel("viewModel");
        oModel.setProperty("/filterOrder", sOrderNo);

        var oOrderInput = this.byId("orderFilterInput");
        if (oOrderInput) {
          oOrderInput.setValue(sOrderNo);
        }

        if (sFilterDate) {
          oModel.setProperty("/filterDate", sFilterDate);
          var oDateInput = this.byId("dateFilterInput");
          if (oDateInput) {
            oDateInput.setValue(sFilterDate);
          }
        } else {
          sFilterDate = oModel.getProperty("/filterDate");
        }

        if (sShiftId) {
          oModel.setProperty("/filterShift", sShiftId);
          var oShiftInput = this.byId("shiftInput");
          if (oShiftInput) {
            oShiftInput.setValue(sShiftId);
          }
        } else {
          sShiftId = oModel.getProperty("/filterShift");
        }

        this._fetchOperationList(sOrderNo);

        // A successful scan auto-applies the filters and fetches the list
        // right away, so the user doesn't need a separate Apply click.
        this._applyFilters(sOrderNo, sFilterDate, sShiftId);
      },

      _stopScanner: function () {
        if (this._oHtml5Qrcode) {
          const oScanner = this._oHtml5Qrcode;
          this._oHtml5Qrcode = null;
          oScanner.stop().then(
            function () {
              oScanner.clear();
            },
            function () {
              // scanner may already be stopped
            },
          );
        }
      },

      // ── Submit for GRN (button) ──────────────────────────────────────
      onSubmitForGrnPress: function () {
        var aResults =
          this.getView().getModel("orderListModel").getProperty("/results") ||
          [];
        var bAnySelected = aResults.some(function (oHeader) {
          return oHeader.selected;
        });

        if (!bAnySelected) {
          MessageBox.warning(
            "Please select at least one confirmation to submit for GRN.",
          );
          return;
        }

        MessageBox.confirm(
          "This will submit the loaded confirmation(s) for GRN. Continue?",
          {
            title: "Submit for GRN",
            actions: [MessageBox.Action.YES, MessageBox.Action.NO],
            emphasizedAction: MessageBox.Action.YES,
            onClose: function (sAction) {
              if (sAction === MessageBox.Action.YES) {
                this._submitForGrn();
              }
            }.bind(this),
          },
        );
      },

      // Builds a JobCardList-shaped payload — the same shape the list API
      // returns — with npToConfirmation holding only the selected
      // confirmations (each still carrying its own npToItem operator
      // rows), and POSTs it to submitorderforgrn.
      _submitForGrn: function () {
        var oView = this.getView();
        var aResults =
          oView.getModel("orderListModel").getProperty("/results") || [];
        var aSelected = aResults.filter(function (oHeader) {
          return oHeader.selected;
        });

        if (aSelected.length === 0) {
          MessageBox.warning(
            "Please select at least one confirmation to submit for GRN.",
          );
          return;
        }

        var oFirst = aSelected[0];
        var o = this._getSessionParams();

        var oPayload = {
          houseDesc: oFirst.houseDesc,
          houseId: oFirst.houseId,
          jobCardNo: oFirst.jobCard,
          order: oFirst.order,
          shiftId: oFirst.shiftId,
          shiftDt: oFirst.shiftDt,
          employeeId: o.employeeId,
          plant: o.plant,
          sessionId: o.sessionId,
          assigOper: oFirst.assigOper,
          npToConfirmation: aSelected.map(function (oRow) {
            return {
              confirmationNo: oRow.confirmationNo,
              Guid: oRow.Guid,
              sessionId: oRow.sessionId,
              counter: oRow.counter,
              employeeId: oRow.employeeId,
              jobCard: oRow.jobCard,
              plant: oRow.plant,
              operation: oRow.operation,
              order: oRow.order,
              shiftId: oRow.shiftId,
              shiftDt: oRow.shiftDt,
              execStartDt: oRow.execStartDt,
              execStartTm: oRow.execStartTm,
              execEndDt: oRow.execEndDt,
              execEndTm: oRow.execEndTm,
              postingDate: oRow.postingDate,
              materialDocNo: oRow.materialDocNo,
              materialDocYear: oRow.materialDocYear,
              grnDoneBy: oRow.grnDoneBy,
              confirmationDoneBy: oRow.confirmationDoneBy,
              CreatedBy: oRow.CreatedBy,
              CreatedDate: oRow.CreatedDate,
              CreatedTime: oRow.CreatedTime,
              npToItem: oRow.items || [],
            };
          }),
        };

        console.log("Submit for GRN payload:", oPayload);

        var sUrl = Base_url + "/api/productionconfirmation/submitorderforgrn";

        oView.setBusy(true);
        $.ajax({
          url: sUrl,
          method: "POST",
          headers: ngrokHeaders,
          contentType: "application/json",
          data: JSON.stringify(oPayload),
          success: function (oResponse) {
            console.log("Submit for GRN response:", oResponse);
            if (oResponse && oResponse.success === false) {
              MessageBox.error(this._extractErrorMessage(oResponse));
              return;
            }

            var sMsg = "Order submitted for GRN successfully.";
            try {
              var oMsg = JSON.parse(oResponse.message);
              sMsg = oMsg.message || sMsg;
            } catch (e) {
              if (oResponse && oResponse.message) {
                sMsg = oResponse.message;
              }
            }
            MessageBox.success(sMsg, {
              title: "Submit for GRN",
              onClose: function () {
                // Re-fetch the same job card so the list reflects the
                // GRN doc(s) that were just created.
                var oViewModel = this.getView().getModel("viewModel");
                this._applyFilters(
                  oViewModel.getProperty("/filterOrder"),
                  oViewModel.getProperty("/filterDate"),
                  oViewModel.getProperty("/filterShift"),
                );
              }.bind(this),
            });
          }.bind(this),
          error: function (oXHR, sStatus, sError) {
            console.log("Submit for GRN error:", oXHR, sStatus, sError);
            MessageBox.error(this._extractErrorMessage(oXHR));
          }.bind(this),
          complete: function () {
            oView.setBusy(false);
          },
        });
      },

      // Pulls the SAP OData error message out of a failed response —
      // handles both a jqXHR (error callback) and an already-parsed JSON
      // body (success callback with { success: false, ... }) — e.g.
      // { error: { error: { message: { value: "..." } } } } or
      // { error: { message: { value: "..." } } }, falling back to
      // response.message / a generic message when nothing matches.
      _extractErrorMessage: function (vSource) {
        var oBody = vSource;
        if (vSource && typeof vSource.responseText === "string") {
          try {
            oBody = JSON.parse(vSource.responseText);
          } catch (e) {
            oBody = null;
          }
        }

        var oError = oBody && (oBody.error || oBody);
        // Unwrap one more "error" level if present (SAP often nests it
        // twice: { error: { error: { message: {...} } } }).
        if (oError && oError.error) {
          oError = oError.error;
        }

        var vMessage = oError && oError.message;
        var sMessage =
          (vMessage && typeof vMessage === "object"
            ? vMessage.value
            : vMessage) ||
          (oBody && oBody.message) ||
          "Failed to submit for GRN.";

        return sMessage;
      },
    });
  },
);
