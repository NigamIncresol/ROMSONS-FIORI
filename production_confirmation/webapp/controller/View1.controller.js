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

    return Controller.extend("productionconfirmation.controller.View1", {
      // ── Formatters ──────────────────────────────────────────────────
      // Converts an ISO-8601 duration ("PT02H30M00S") into "HH:MM" for
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

      // Converts an ISO-8601 duration ("PT00H00M00S") into "HH:MM:SS" for
      // display; returns the raw value unchanged if it doesn't match.
      formatDurationHMS: function (sDuration) {
        if (!sDuration) {
          return "";
        }
        var oMatch = sDuration.toString().match(/PT(\d+)H(\d+)M(\d+)S/);
        if (!oMatch) {
          return sDuration;
        }
        var sHours = oMatch[1].padStart(2, "0");
        var sMinutes = oMatch[2].padStart(2, "0");
        var sSeconds = oMatch[3].padStart(2, "0");
        return sHours + ":" + sMinutes + ":" + sSeconds;
      },

      // Formats a quantity for use in a URL path segment: whole numbers
      // pass through as-is, decimal quantities get 3 decimal places and a
      // trailing "m" (e.g. 0.298 -> "0.298m"), matching the yield format.
      _formatQtyForUrl: function (vQty) {
        var fQty = parseFloat(vQty);
        if (isNaN(fQty)) {
          return vQty;
        }
        if (fQty % 1 !== 0) {
          return fQty.toFixed(3) + "m";
        }
        return String(fQty);
      },

      // Converts "yyyy-MM-dd" into OData's "/Date(<ms>)/" JSON format.
      _toODataDate: function (sDate) {
        if (!sDate) {
          return null;
        }
        var oDate = new Date(sDate + "T00:00:00Z");
        return "/Date(" + oDate.getTime() + ")/";
      },

      // Converts "HH:MM" or "HH:MM:SS" into an ISO-8601 duration
      // ("PT06H00M00S").
      _toIsoDuration: function (sTime) {
        if (!sTime) {
          return "PT00H00M00S";
        }
        var aParts = sTime.split(":");
        var sHours = (aParts[0] || "0").padStart(2, "0");
        var sMinutes = (aParts[1] || "0").padStart(2, "0");
        var sSeconds = (aParts[2] || "0").padStart(2, "0");
        return "PT" + sHours + "H" + sMinutes + "M" + sSeconds + "S";
      },

      // Builds the "Activity Details" list: one row per activityType1-6
      // (from oLabelSource, e.g. npToOperation) that actually has a value,
      // paired with its ConfActivity{n}/ConfActiUnit{n} value+unit — taken
      // from oValueSource if given (e.g. the activitydetails API response),
      // otherwise from oLabelSource itself.
      _buildActivityList: function (oLabelSource, oValueSource) {
        oValueSource = oValueSource || oLabelSource;
        var aActivities = [];
        for (var i = 1; i <= 6; i++) {
          var sLabel = oLabelSource["activityType" + i];
          if (!sLabel) {
            continue;
          }
          var sValue = oValueSource["ConfActivity" + i] || "0";
          var sUnit = oValueSource["ConfActiUnit" + i] || "";
          aActivities.push({
            label: sLabel,
            value: sValue,
            unit: sUnit,
            valueFmt: sUnit ? sValue + " " + sUnit : sValue,
          });
        }
        return aActivities;
      },

      // ── Init ────────────────────────────────────────────────────────
      onInit: function () {
        this._oMaterialBatches = {};
        this._oConsumptionContext = null;
        this._bBatchDraftSaved = false;
        this._fLastActivityYield = null;
        this._sScannedJobCardId = null;

        var oLogo = this.byId("appLogo");
        if (oLogo) {
          var sLogoUrl = sap.ui.require.toUrl(
            "productionconfirmation/images/logoNew.svg",
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
            filterOperation: "",
            operationEnabled: false,
            operationDetailLoaded: false,
            selectedOperatorLabel: "",
            orderLoaded: false,
            filtersDirty: false,
            confirmationTotals: { yieldQty: 0, reworkQty: 0, scrapQty: 0 },
          }),
          "viewModel",
        );

        this.getView().setModel(
          new JSONModel({ results: [] }),
          "operationListModel",
        );

        this.getView().setModel(
          new JSONModel({ order: "", houseId: "", houseDesc: "" }),
          "productionOrderModel",
        );

        this.getView().setModel(new JSONModel({ items: [] }), "jobCardModel");

        this.getView().setModel(new JSONModel({}), "operationDetailModel");

        this.getView().setModel(
          new JSONModel({ results: [] }),
          "operatorAssignmentModel",
        );

        this.getView().setModel(
          new JSONModel({ results: [] }),
          "confirmationTableModel",
        );

        this.getView().setModel(
          new JSONModel({ results: [] }),
          "consumptionModel",
        );

        this.getView().setModel(new JSONModel({ results: [] }), "batchModel");

        this.getView().setModel(
          new JSONModel({
            itemNo: "",
            material: "",
            materialDesc: "",
            quantity: 0,
            unit: "",
            totalSplitQty: 0,
          }),
          "batchContextModel",
        );

        this.getView().setModel(
          new JSONModel({
            postingDate: sToday,
            execStrtDt: "",
            execStrtTm: "",
            execEndDt: "",
            execEndTm: "",
            breakTime: "",
            breakTimeUnit: "HR",
            confirmationText: "",
            actualCavityNo: "",
            actualCycleTime: "",
            numberOfShots: "",
          }),
          "confirmationHeaderModel",
        );

        this.getView().setModel(
          new JSONModel({ results: [] }),
          "shiftListModel",
        );
        this._loadShiftList(
          function () {
            if (sOrderId && sUrlDate && sUrlShift) {
              this._applyFilters(sOrderId, sFilterDate, sUrlShift);
            }
          }.bind(this),
        );
      },

      // Fetches the plant's shift list to populate the Shift dropdown.
      _loadShiftList: function (fnCallback) {
        var oCookies = this._parseCookies();
        var sUrl =
          Base_url +
          "/api/operatorAssignment/getShiftList/" +
          oCookies["plant"];

        var fnParseDuration = function (s) {
          var h = parseInt((s.match(/(\d+)H/) || [])[1] || 0, 10);
          var m = parseInt((s.match(/(\d+)M/) || [])[1] || 0, 10);
          return String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0");
        };

        $.ajax({
          url: sUrl,
          method: "GET",
          headers: ngrokHeaders,
          contentType: "application/json",
          success: function (oResponse) {
            console.log("Shift list:", oResponse);
            var aResults = (oResponse.results || [])
              .map(function (o) {
                var oItem = Object.assign({}, o);
                delete oItem.__metadata;
                oItem.startTimeFmt = fnParseDuration(oItem.StartTime || "");
                oItem.endTimeFmt = fnParseDuration(oItem.EndTime || "");
                return oItem;
              })
              .sort(function (a, b) {
                return a.startTimeFmt.localeCompare(b.startTimeFmt);
              });
            this.getView().setModel(
              new JSONModel({ results: aResults }),
              "shiftListModel",
            );
            if (fnCallback) {
              fnCallback();
            }
          }.bind(this),
          error: function (oXHR, sStatus, sError) {
            console.log("Shift list error:", oXHR, sStatus, sError);
            if (fnCallback) {
              fnCallback();
            }
          },
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

      onOrderIdChange: function (oEvent) {
        // Order details are only fetched on Apply — typing/editing the
        // Order ID just auto-populates the Operation dropdown so the user
        // can pick one, then click Apply to load everything else.
        this._markFiltersDirty();

        // Manual edit invalidates any Job Card No captured from a
        // previous scan — go back to the concatenated fallback.
        this._sScannedJobCardId = null;

        var sOrderId = (
          oEvent.getParameter("value") ||
          this.getView().getModel("viewModel").getProperty("/filterOrder") ||
          ""
        ).trim();
        if (sOrderId) {
          this._loadOperationsOnly(sOrderId);
        }
      },

      // ── F4 value helps (Order ID / Date), data from GET /api/f4/... ──────
      onOrderValueHelp: function () {
        this._openF4ValueHelp({
          kind: "order",
          title: "Select Order",
          appId: "order_confirm",
          helpId: "orders_with_jobcards",
        });
      },

      onDateValueHelp: function () {
        this._openF4ValueHelp({
          kind: "date",
          title: "Select Shift Date",
          appId: "order_confirm",
          helpId: "shift_dates_jobcards",
        });
      },

      // Fetches the F4 list for the given app/help id and opens the shared
      // value-help dialog on it.
      _openF4ValueHelp: function (oConfig) {
        var oView = this.getView();
        var o = this._getSessionParams();
        var sUrl =
          Base_url +
          "/api/f4/" +
          encodeURIComponent(oConfig.appId) +
          "/" +
          encodeURIComponent(oConfig.helpId) +
          "?empid=" +
          encodeURIComponent(o.employeeId) +
          "&sesid=" +
          encodeURIComponent(o.sessionId) +
          "&plant=" +
          encodeURIComponent(o.plant);

        this._oF4Config = oConfig;
        oView.setBusy(true);
        $.ajax({
          url: sUrl,
          method: "GET",
          headers: ngrokHeaders,
          contentType: "application/json",
          success: function (oResponse) {
            console.log("F4 " + oConfig.helpId + ":", oResponse);
            var aRaw = (oResponse && oResponse.values) || [];
            oView.setModel(
              new JSONModel({
                title: oConfig.title,
                results: this._mapF4Rows(aRaw, oConfig.kind),
              }),
              "f4Model",
            );

            if (!this._oF4Dialog) {
              this._oF4Dialog = sap.ui.xmlfragment(
                "productionconfirmation.view.F4ValueHelp",
                this,
              );
              oView.addDependent(this._oF4Dialog);
            }
            this._oF4Dialog.open("");
          }.bind(this),
          error: function (oXHR, sStatus, sError) {
            console.log(
              "F4 " + oConfig.helpId + " error:",
              oXHR,
              sStatus,
              sError,
            );
            MessageBox.error("Failed to fetch value help data.");
          },
          complete: function () {
            oView.setBusy(false);
          },
        });
      },

      // Maps F4 rows ({ key, key2, text, info }) to { key, title, description }.
      //  order: title = order no, description = material text | order type
      //  date:  key = "yyyy-MM-dd" (from "yyyyMMdd"), title = the API text
      _mapF4Rows: function (aValues, sKind) {
        return aValues.map(
          function (oRow) {
            if (sKind === "date") {
              var sIso = this._normalizeF4Date(oRow.key);
              return {
                key: sIso,
                title: oRow.text || this.formatDisplayDate(sIso),
                description: oRow.info || "",
              };
            }
            return {
              key: String(oRow.key || "").trim(),
              title: String(oRow.key || "").trim(),
              description: [oRow.text, oRow.info].filter(Boolean).join("  |  "),
            };
          }.bind(this),
        );
      },

      // Accepts "/Date(ms)/", "yyyy-MM-dd…", "dd.MM.yyyy" or "yyyyMMdd" and
      // returns "yyyy-MM-dd" ("" when unrecognised).
      _normalizeF4Date: function (v) {
        if (v === null || v === undefined) {
          return "";
        }
        var s = String(v).trim();
        var m = s.match(/\/Date\((-?\d+)\)\//);
        if (m) {
          return new Date(parseInt(m[1], 10)).toISOString().split("T")[0];
        }
        if (/^\d{4}-\d{2}-\d{2}/.test(s)) {
          return s.substring(0, 10);
        }
        m = s.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
        if (m) {
          return m[3] + "-" + m[2] + "-" + m[1];
        }
        if (/^\d{8}$/.test(s)) {
          return (
            s.substring(0, 4) +
            "-" +
            s.substring(4, 6) +
            "-" +
            s.substring(6, 8)
          );
        }
        return "";
      },

      onF4Search: function (oEvent) {
        var sValue = oEvent.getParameter("value") || "";
        var oBinding = oEvent.getSource().getBinding("items");
        if (!sValue) {
          oBinding.filter([]);
          return;
        }
        oBinding.filter([
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
        ]);
      },

      onF4Confirm: function (oEvent) {
        var oItem = oEvent.getParameter("selectedItem");
        if (!oItem || !this._oF4Config) {
          return;
        }
        var oData = oItem.getBindingContext("f4Model").getObject();
        var oViewModel = this.getView().getModel("viewModel");

        if (this._oF4Config.kind === "order") {
          oViewModel.setProperty("/filterOrder", oData.key);
          // A picked order invalidates any previously scanned job card no.
          this._sScannedJobCardId = null;
          this._markFiltersDirty();
          this._loadOperationsOnly(oData.key);
        } else if (oData.key) {
          oViewModel.setProperty("/filterDate", oData.key);
          this._markFiltersDirty();
        } else {
          sap.m.MessageToast.show("The selected row has no valid date.");
        }
      },

      // Fetches order details purely to populate the Operation dropdown
      // (used on Order ID entry / scan) — does NOT touch productionOrderModel
      // or /orderLoaded, so the Order Details panel stays hidden until the
      // user actually clicks Apply.
      _loadOperationsOnly: function (sOrderId) {
        var oView = this.getView();
        var oViewModel = oView.getModel("viewModel");

        oViewModel.setProperty("/operationEnabled", false);
        oView.setModel(new JSONModel({ results: [] }), "operationListModel");

        var o = this._getSessionParams();
        var sUrl =
          Base_url +
          "/api/productionconfirmation/orderdetails/" +
          sOrderId +
          "/" +
          o.plant +
          "/" +
          o.sessionId +
          "/" +
          o.employeeId;

        $.ajax({
          url: sUrl,
          method: "GET",
          headers: ngrokHeaders,
          contentType: "application/json",
          success: function (oResponse) {
            console.log("Order details (operations preview):", oResponse);
            var aResults = (oResponse && oResponse.results) || [];
            var oOrder = aResults[0];
            var aOperations = [];
            if (oOrder) {
              aOperations =
                (oOrder.npToOperation && oOrder.npToOperation.results) || [];
              aOperations = aOperations.map(function (oOp) {
                var oItem = Object.assign({}, oOp);
                delete oItem.__metadata;
                delete oItem.npToComponent;
                delete oItem.npToJobCardItem;
                delete oItem.npToConsumption;
                return oItem;
              });
            }

            oView.setModel(
              new JSONModel({ results: aOperations }),
              "operationListModel",
            );
            oViewModel.setProperty("/operationEnabled", aOperations.length > 0);

            if (aOperations.length > 0) {
              sap.m.MessageToast.show("Select an operation and click Apply.");
            }
          },
          error: function (oXHR, sStatus, sError) {
            console.log(
              "Order details (operations preview) error:",
              oXHR,
              sStatus,
              sError,
            );
          },
        });
      },

      // Display formatter: "yyyy-MM-dd" -> "dd.MM.yyyy".
      formatDisplayDate: function (sIso) {
        var m = (sIso || "").match(/^(\d{4})-(\d{2})-(\d{2})/);
        return m ? m[3] + "." + m[2] + "." + m[1] : "";
      },

      // The date input is one-way bound for display; typed text is parsed
      // here and written back to /filterDate, or reverted if invalid.
      onDateTextChange: function (oEvent) {
        var oInput = oEvent.getSource();
        var oModel = this.getView().getModel("viewModel");
        var sIso = this._normalizeF4Date(oEvent.getParameter("value"));

        if (!sIso || isNaN(Date.parse(sIso))) {
          sap.m.MessageToast.show("Please enter a valid date (DD.MM.YYYY).");
          oInput.setValue(
            this.formatDisplayDate(oModel.getProperty("/filterDate")),
          );
          return;
        }
        oModel.setProperty("/filterDate", sIso);
        oInput.setValue(this.formatDisplayDate(sIso));
        this._markFiltersDirty();
      },

      onShiftChange: function () {
        this._markFiltersDirty();
      },

      // ── Operation Change ─────────────────────────────────────────────
      onOperationChange: function (oEvent) {
        var oItem = oEvent.getParameter("selectedItem");
        var sOperation = oItem ? oItem.getKey() : "";
        this.getView()
          .getModel("viewModel")
          .setProperty("/filterOperation", sOperation);
        console.log("Selected operation:", sOperation);
      },

      // ── Operator Value Help (select an operator to add to the
      //    confirmation table) ─────────────────────────────────────────
      onOpenOperatorValueHelp: function () {
        if (!this._oOperatorValueHelpDialog) {
          this._oOperatorValueHelpDialog = sap.ui.xmlfragment(
            "productionconfirmation.view.OperatorValueHelp",
            this,
          );
          this.getView().addDependent(this._oOperatorValueHelpDialog);
        }
        this._oOperatorValueHelpDialog.open();
      },

      // Filters the value help list by employee ID or name (name field is
      // used only if the backend happens to provide one).
      onSearchValueHelpOperator: function (oEvent) {
        var sValue =
          oEvent.getParameter("value") || oEvent.getParameter("newValue") || "";
        var oBinding = oEvent.getSource().getBinding("items");
        if (!sValue) {
          oBinding.filter([]);
          return;
        }
        var oFilter = new sap.ui.model.Filter({
          filters: [
            new sap.ui.model.Filter(
              "employeeId",
              sap.ui.model.FilterOperator.Contains,
              sValue,
            ),
            new sap.ui.model.Filter(
              "employeeName",
              sap.ui.model.FilterOperator.Contains,
              sValue,
            ),
          ],
          and: false,
        });
        oBinding.filter([oFilter]);
      },

      onOperatorValueHelpConfirm: function (oEvent) {
        var oSelectedItem = oEvent.getParameter("selectedItem");
        if (!oSelectedItem) {
          return;
        }

        var oOperator = oSelectedItem
          .getBindingContext("operatorAssignmentModel")
          .getObject();

        var oModel = this.getView().getModel("confirmationTableModel");
        var aRows = oModel.getProperty("/results") || [];

        var bDuplicate = aRows.some(function (oRow) {
          return oRow.employeeId === oOperator.employeeId;
        });
        if (bDuplicate) {
          sap.m.MessageToast.show(
            oOperator.employeeId + " is already added to the table.",
          );
          return;
        }

        aRows.push(
          Object.assign({}, oOperator, {
            yieldQty: "",
            reworkQty: "0",
            scrapQty: "0",
            lastValidYieldQty: "",
          }),
        );
        oModel.setProperty("/results", aRows);
        this._recalcConfirmationTotals();

        // The picked operator now lives in the table row — clear the
        // field so it's ready for the next selection.
        this.getView()
          .getModel("viewModel")
          .setProperty("/selectedOperatorLabel", "");
      },

      onRemoveConfirmationOperator: function (oEvent) {
        var oContext = oEvent
          .getSource()
          .getBindingContext("confirmationTableModel");
        if (!oContext) return;

        var sPath = oContext.getPath();
        var iIndex = parseInt(sPath.split("/").pop(), 10);

        var oModel = this.getView().getModel("confirmationTableModel");
        var aRows = oModel.getProperty("/results") || [];
        aRows.splice(iIndex, 1);
        oModel.setProperty("/results", aRows);
        this._recalcConfirmationTotals();
      },

      // Fires on change of Rework/Scrap Qty inputs in the table.
      onConfirmationQtyChange: function () {
        this._recalcConfirmationTotals();
      },

      // Fires on change of an operator's Yield Qty. If a batch split was
      // already saved as draft for the previous total yield, warn that it
      // is now stale — confirm before clearing it (Cancel reverts the
      // yield edit instead).
      onOperatorYieldChange: function (oEvent) {
        var oContext = oEvent
          .getSource()
          .getBindingContext("confirmationTableModel");
        var sPath = oContext.getPath();
        var oRow = oContext.getObject();
        var oModel = this.getView().getModel("confirmationTableModel");

        var fYieldQty = parseFloat(oRow.yieldQty) || 0;
        var fTargetQty = parseFloat(oRow.targetQty) || 0;
        var fConfirmedQty = parseFloat(oRow.confirmedQty) || 0;
        var fRemainingQty = fTargetQty - fConfirmedQty;

        // For mould orders, check total yield vs. Actual Cavity No ×
        // Number of Shots FIRST, then fall through to the per-operator
        // remaining Target Qty (Target − Confirmed) check below.
        var oView = this.getView();
        var bIsMouldOrder =
          oView
            .getModel("productionOrderModel")
            .getProperty("/IsMouldOrder") === "X";
        if (bIsMouldOrder) {
          var oHeaderModel = oView.getModel("confirmationHeaderModel");
          var sActualCavityNo = oHeaderModel.getProperty("/actualCavityNo");
          var sNumberOfShots = oHeaderModel.getProperty("/numberOfShots");
          var sActualCycleTime = oHeaderModel.getProperty("/actualCycleTime");

          if (!sActualCavityNo || !sNumberOfShots || !sActualCycleTime) {
            MessageBox.warning(
              "Please enter Actual Cavity No, Number of Shots, and " +
                "Actual Cycle Time before entering Yield Qty.",
              { title: "Details Required" },
            );
            oModel.setProperty(sPath + "/yieldQty", oRow.lastValidYieldQty);
            this._recalcConfirmationTotals();
            return;
          }

          var fActualCavityNo = parseFloat(sActualCavityNo) || 0;
          var fNumberOfShots = parseFloat(sNumberOfShots) || 0;
          var fMaxYield = fActualCavityNo * fNumberOfShots;

          var aAllRows = oModel.getProperty("/results") || [];
          var fTotalYield = aAllRows.reduce(function (fSum, o) {
            return fSum + (parseFloat(o.yieldQty) || 0);
          }, 0);

          if (fTotalYield > fMaxYield) {
            MessageBox.error(
              "Total Yield Qty (" +
                fTotalYield +
                ") exceeds Actual Cavity No × Number of Shots (" +
                fActualCavityNo +
                " × " +
                fNumberOfShots +
                " = " +
                fMaxYield +
                ").",
            );
            oModel.setProperty(sPath + "/yieldQty", "");
            this._recalcConfirmationTotals();
            return;
          }
        }

        if (fYieldQty > fRemainingQty) {
          MessageBox.error(
            "Yield Qty (" +
              fYieldQty +
              ") cannot exceed this operator's remaining Target Qty (" +
              fRemainingQty +
              " = Target " +
              fTargetQty +
              " − Confirmed " +
              fConfirmedQty +
              ").",
          );
          oModel.setProperty(sPath + "/yieldQty", oRow.lastValidYieldQty);
          this._recalcConfirmationTotals();
          return;
        }

        this._recalcConfirmationTotals();

        if (!this._bBatchDraftSaved) {
          oModel.setProperty(sPath + "/lastValidYieldQty", oRow.yieldQty);
          return;
        }

        MessageBox.confirm(
          "A batch split already exists as a saved draft. Changing the " +
            "yield will clear the existing batch split data. Continue?",
          {
            title: "Yield Changed",
            actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
            emphasizedAction: MessageBox.Action.OK,
            onClose: function (sAction) {
              if (sAction !== MessageBox.Action.OK) {
                // Cancelled — revert the yield edit and its effect on
                // the totals.
                oModel.setProperty(sPath + "/yieldQty", oRow.lastValidYieldQty);
                this._recalcConfirmationTotals();
                return;
              }

              oModel.setProperty(sPath + "/lastValidYieldQty", oRow.yieldQty);

              this._oMaterialBatches = {};
              this._oConsumptionContext = null;
              this._bBatchDraftSaved = false;
              this._fLastActivityYield = null;

              var oView = this.getView();
              oView.setModel(
                new JSONModel({ results: [] }),
                "consumptionModel",
              );
              oView.setModel(new JSONModel({ results: [] }), "batchModel");
              oView.setModel(
                new JSONModel({
                  itemNo: "",
                  material: "",
                  materialDesc: "",
                  quantity: 0,
                  unit: "",
                  totalSplitQty: 0,
                }),
                "batchContextModel",
              );
            }.bind(this),
          },
        );
      },

      // ── Sum Yield/Rework/Scrap Qty across all rows in the confirmation
      //    table and publish under viewModel>/confirmationTotals, which
      //    the table's column footers are bound to. ────────────────────
      _recalcConfirmationTotals: function () {
        var aRows =
          this.getView()
            .getModel("confirmationTableModel")
            .getProperty("/results") || [];

        var oTotals = aRows.reduce(
          function (oAcc, oRow) {
            oAcc.yieldQty += parseFloat(oRow.yieldQty) || 0;
            oAcc.reworkQty += parseFloat(oRow.reworkQty) || 0;
            oAcc.scrapQty += parseFloat(oRow.scrapQty) || 0;
            return oAcc;
          },
          { yieldQty: 0, reworkQty: 0, scrapQty: 0 },
        );

        this.getView()
          .getModel("viewModel")
          .setProperty("/confirmationTotals", oTotals);

        // Only re-fetch activity details when the total yield actually
        // changed (rework/scrap edits also land here but shouldn't
        // trigger a redundant call).
        if (oTotals.yieldQty !== this._fLastActivityYield) {
          this._fLastActivityYield = oTotals.yieldQty;
          this._fetchActivityDetails(oTotals.yieldQty);
        }
      },

      // ── Activity Details (fetched whenever total yield changes) ──────────
      _fetchActivityDetails: function (fYield) {
        var oView = this.getView();
        var sOrder = oView
          .getModel("operationDetailModel")
          .getProperty("/order");
        var sOperation = oView
          .getModel("viewModel")
          .getProperty("/filterOperation");
        if (!sOrder || !sOperation) {
          return;
        }

        var o = this._getSessionParams();
        var sUrl =
          Base_url +
          "/api/productionconfirmation/activitydetails/" +
          sOrder +
          "/" +
          sOperation +
          "/" +
          fYield +
          "/" +
          o.plant +
          "/" +
          o.sessionId +
          "/" +
          o.employeeId;

        $.ajax({
          url: sUrl,
          method: "GET",
          headers: ngrokHeaders,
          contentType: "application/json",
          success: function (oResponse) {
            console.log("Activity details:", oResponse);

            var oActivityData =
              (oResponse.results && oResponse.results[0]) || {};
            var oOperationDetailModel = oView.getModel("operationDetailModel");
            var oOperationData = oOperationDetailModel.getData();
            var aActivities = this._buildActivityList(
              oOperationData,
              oActivityData,
            );
            oOperationDetailModel.setProperty("/activities", aActivities);

            // Also refresh the raw ConfActivity{n}/ConfActiUnit{n} fields
            // on the model itself, so onSubmitOrderConfirmation can read
            // the latest confirmed activity values straight off it.
            for (var i = 1; i <= 6; i++) {
              oOperationDetailModel.setProperty(
                "/ConfActivity" + i,
                oActivityData["ConfActivity" + i] || "0",
              );
              oOperationDetailModel.setProperty(
                "/ConfActiUnit" + i,
                oActivityData["ConfActiUnit" + i] || "",
              );
            }
          }.bind(this),
          error: function (oXHR, sStatus, sError) {
            console.log("Activity details error:", oXHR, sStatus, sError);
          },
        });
      },

      // ── Add Consumption ────────────────────────────────────────────────
      onAddConsumption: function () {
        var oView = this.getView();

        // A batch split was already saved as draft for the current yield —
        // just show that saved data again instead of re-fetching.
        if (this._bBatchDraftSaved) {
          this._openConsumptionDialog();
          return;
        }

        var aOperatorRows =
          oView.getModel("confirmationTableModel").getProperty("/results") ||
          [];
        var oMissingYieldRow = aOperatorRows.find(function (oRow) {
          return (
            oRow.yieldQty === "" ||
            oRow.yieldQty === null ||
            oRow.yieldQty === undefined
          );
        });
        if (oMissingYieldRow) {
          MessageBox.warning(
            "Please provide Yield Qty for operator " +
              oMissingYieldRow.employeeId +
              ".",
            { title: "Yield Required" },
          );
          return;
        }

        var fTotalYield =
          oView
            .getModel("viewModel")
            .getProperty("/confirmationTotals/yieldQty") || 0;

        if (fTotalYield <= 0) {
          MessageBox.error("Total Yield Qty is 0. Please add yield first.");
          return;
        }

        var sOrder = oView
          .getModel("operationDetailModel")
          .getProperty("/order");
        var sOperation = oView
          .getModel("viewModel")
          .getProperty("/filterOperation");
        var o = this._getSessionParams();

        // Remembered for the "Get Batch Info" call, which needs the same
        // order/operation/yield/session context as this call.
        this._oConsumptionContext = {
          order: sOrder,
          operation: sOperation,
          yield: fTotalYield,
        };

        var sUrl =
          Base_url +
          "/api/productionconfirmation/consumptiondetails/" +
          sOrder +
          "/" +
          sOperation +
          "/" +
          fTotalYield +
          "/" +
          o.plant +
          "/" +
          o.sessionId +
          "/" +
          o.employeeId;

        oView.setBusy(true);
        $.ajax({
          url: sUrl,
          method: "GET",
          headers: ngrokHeaders,
          contentType: "application/json",
          success: function (oResponse) {
            console.log("Consumption details:", oResponse);
            var aResults = (oResponse && oResponse.results) || [];
            // Track each row's last-committed Quantity so a cancelled
            // edit can be reverted cleanly.
            aResults = aResults.map(function (oMatRow) {
              return Object.assign({}, oMatRow, {
                originalQuantity: oMatRow.Quantity,
              });
            });
            oView.setModel(
              new JSONModel({ results: aResults }),
              "consumptionModel",
            );
            oView.setModel(new JSONModel({ results: [] }), "batchModel");
            oView.setModel(
              new JSONModel({
                itemNo: "",
                material: "",
                materialDesc: "",
                quantity: 0,
                unit: "",
                totalSplitQty: 0,
              }),
              "batchContextModel",
            );
            // Fresh consumption fetch — start tracking batch splits for
            // this order/operation from scratch.
            this._oMaterialBatches = {};
            this._openConsumptionDialog();

            // Auto-fetch batch details for every material up front, so
            // "Get Batch" just displays already-loaded (and possibly
            // edited) data instead of hitting the API on every click.
            if (aResults.length > 0) {
              oView.setBusy(true);
              this._prefetchAllMaterialBatches(aResults, function () {
                oView.setBusy(false);
              });
            }
          }.bind(this),
          error: function (oXHR, sStatus, sError) {
            console.log("Consumption details error:", oXHR, sStatus, sError);
            MessageBox.error("Failed to fetch consumption details.");
          },
          complete: function () {
            oView.setBusy(false);
          },
        });
      },

      // ── Consumption Quantity Change ───────────────────────────────────
      // Editing a material's Quantity invalidates its previously fetched
      // batch split, so confirm with the user, then either re-fetch that
      // material's batches (OK) or revert the Quantity edit (Cancel).
      onConsumptionQtyChange: function (oEvent) {
        var oContext = oEvent.getSource().getBindingContext("consumptionModel");
        var sPath = oContext.getPath();
        var oRow = oContext.getObject();
        var oCtx = this._oConsumptionContext;
        if (!oRow || !oCtx) {
          return;
        }

        var oConsumptionModel = this.getView().getModel("consumptionModel");

        MessageBox.confirm(
          "Quantity changed for " +
            oRow.material +
            ". Fetching the latest batch data will overwrite any manual " +
            "Split Qty entries you've made for this material. Continue?",
          {
            title: "Quantity Changed",
            actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
            emphasizedAction: MessageBox.Action.OK,
            onClose: function (sAction) {
              if (sAction !== MessageBox.Action.OK) {
                // Cancelled — revert the Quantity back to its last
                // committed value.
                oConsumptionModel.setProperty(
                  sPath + "/Quantity",
                  oRow.originalQuantity,
                );
                return;
              }

              var oView = this.getView();
              oView.setBusy(true);
              this._fetchMaterialBatch(
                oCtx,
                oRow,
                function () {
                  oView.setBusy(false);

                  // The new Quantity is now the committed baseline.
                  oConsumptionModel.setProperty(
                    sPath + "/originalQuantity",
                    oRow.Quantity,
                  );

                  // Show the freshly fetched batch data for this row, as
                  // if "Get Batch" had just been clicked on it.
                  this._displayMaterialBatch(oRow);
                }.bind(this),
              );
            }.bind(this),
          },
        );
      },

      // ── Get Batch (per-row button in the consumption table) ──────────────
      onGetBatchInfo: function (oEvent) {
        var oRow = oEvent
          .getSource()
          .getBindingContext("consumptionModel")
          .getObject();
        var oCtx = this._oConsumptionContext;
        if (!oRow || !oCtx) {
          sap.m.MessageToast.show(
            "Unable to determine order/operation context.",
          );
          return;
        }

        // Batches for every material are pre-fetched when the consumption
        // dialog opens (see _prefetchAllMaterialBatches) — this just
        // displays whatever is already cached (edits included).
        if (this._oMaterialBatches && this._oMaterialBatches[oRow.material]) {
          this._displayMaterialBatch(oRow);
          return;
        }

        // Safety fallback (e.g. the prefetch for this material failed
        // earlier) — fetch it on demand instead of showing nothing.
        this.getView().setBusy(true);
        this._fetchMaterialBatch(
          oCtx,
          oRow,
          function () {
            this.getView().setBusy(false);
            this._displayMaterialBatch(oRow);
          }.bind(this),
        );
      },

      // Publishes a material's context (for the message strip/quantity
      // check) and its cached batch rows into batchContextModel/batchModel
      // — the same effect as clicking "Get Batch" on that material's row.
      _displayMaterialBatch: function (oRow) {
        var oView = this.getView();
        oView.setModel(
          new JSONModel({
            itemNo: oRow.itemNo,
            material: oRow.material,
            materialDesc: oRow.materialDesc,
            quantity: parseFloat(oRow.Quantity) || 0,
            unit: oRow.unit,
            totalSplitQty: 0,
          }),
          "batchContextModel",
        );
        oView.setModel(
          new JSONModel({
            results:
              (this._oMaterialBatches &&
                this._oMaterialBatches[oRow.material]) ||
              [],
          }),
          "batchModel",
        );
        this._recalcBatchSplitTotal();
      },

      // Fetches & caches batch details for every material in the
      // consumption table; fnDone fires once all calls have settled.
      _prefetchAllMaterialBatches: function (aMaterialRows, fnDone) {
        if (!aMaterialRows.length) {
          fnDone();
          return;
        }
        var oCtx = this._oConsumptionContext;
        var iPending = aMaterialRows.length;
        aMaterialRows.forEach(
          function (oMatRow) {
            this._fetchMaterialBatch(oCtx, oMatRow, function () {
              iPending--;
              if (iPending === 0) {
                fnDone();
              }
            });
          }.bind(this),
        );
      },

      // Fetches componentbatchdetails for a single material, stores the
      // (cleaned) result in this._oMaterialBatches[material], and calls
      // fnCallback() once settled (success or error).
      _fetchMaterialBatch: function (oCtx, oMatRow, fnCallback) {
        var o = this._getSessionParams();
        var sUrl =
          Base_url +
          "/api/productionconfirmation/componentbatchdetails/" +
          oCtx.order +
          "/" +
          oCtx.operation +
          "/" +
          oMatRow.material +
          "/" +
          oMatRow.itemNo +
          "/" +
          this._formatQtyForUrl(oMatRow.Quantity) +
          "/" +
          o.plant +
          "/" +
          o.sessionId +
          "/" +
          o.employeeId;

        $.ajax({
          url: sUrl,
          method: "GET",
          headers: ngrokHeaders,
          contentType: "application/json",
          success: function (oResponse) {
            console.log(
              "Component batch details for " + oMatRow.material + ":",
              oResponse,
            );
            var aBatchResults = (oResponse && oResponse.results) || [];
            // Track each row's last-known-valid Split Qty so an over-limit
            // edit can be reverted cleanly.
            aBatchResults = aBatchResults.map(function (oBatchRow) {
              return Object.assign({}, oBatchRow, {
                lastValidSplitQty: parseFloat(oBatchRow.splitQty) || 0,
              });
            });
            if (!this._oMaterialBatches) {
              this._oMaterialBatches = {};
            }
            this._oMaterialBatches[oMatRow.material] = aBatchResults;
          }.bind(this),
          error: function (oXHR, sStatus, sError) {
            console.log(
              "Component batch details error for " + oMatRow.material + ":",
              oXHR,
              sStatus,
              sError,
            );
            if (!this._oMaterialBatches) {
              this._oMaterialBatches = {};
            }
            this._oMaterialBatches[oMatRow.material] = [];
          }.bind(this),
          complete: function () {
            fnCallback();
          },
        });
      },

      // Fires on change of any Split Qty input in the batch table. If the
      // edit pushes the total over the material's Quantity, revert that
      // row back to its last valid value and alert the user.
      onBatchSplitQtyChange: function (oEvent) {
        var oView = this.getView();
        var oBatchModel = oView.getModel("batchModel");
        var oContext = oEvent.getSource().getBindingContext("batchModel");
        var sPath = oContext.getPath();
        var oRow = oContext.getObject();

        var fQuantity =
          oView.getModel("batchContextModel").getProperty("/quantity") || 0;
        var aRows = oBatchModel.getProperty("/results") || [];
        var fTotal = aRows.reduce(function (fSum, o) {
          return fSum + (parseFloat(o.splitQty) || 0);
        }, 0);

        var fSplitQty = parseFloat(oRow.splitQty) || 0;
        var fAvailableQty = parseFloat(oRow.availableQty) || 0;

        if (fSplitQty > fAvailableQty) {
          MessageBox.error(
            "Split Qty (" +
              fSplitQty +
              ") exceeds the available quantity (" +
              fAvailableQty +
              ") for batch " +
              oRow.batch +
              ".",
          );
          oBatchModel.setProperty(sPath + "/splitQty", oRow.lastValidSplitQty);
        } else if (fTotal > fQuantity) {
          MessageBox.error(
            "Total Split Qty (" +
              fTotal +
              ") exceeds the selected material's Quantity (" +
              fQuantity +
              ").",
          );
          oBatchModel.setProperty(sPath + "/splitQty", oRow.lastValidSplitQty);
        } else {
          oBatchModel.setProperty(
            sPath + "/lastValidSplitQty",
            parseFloat(oRow.splitQty) || 0,
          );
        }

        // Keep the per-material snapshot used at submit time in sync.
        var sMaterial = oView
          .getModel("batchContextModel")
          .getProperty("/material");
        if (sMaterial && this._oMaterialBatches) {
          this._oMaterialBatches[sMaterial] =
            oBatchModel.getProperty("/results");
        }

        this._recalcBatchSplitTotal();
      },

      // Sums Split Qty across all batch rows and publishes it to
      // batchContextModel>/totalSplitQty (the message strip is bound to
      // this and turns Error when it exceeds the material's Quantity).
      _recalcBatchSplitTotal: function () {
        var oView = this.getView();
        var aRows = oView.getModel("batchModel").getProperty("/results") || [];
        var fTotal = aRows.reduce(function (fSum, oRow) {
          return fSum + (parseFloat(oRow.splitQty) || 0);
        }, 0);

        oView
          .getModel("batchContextModel")
          .setProperty("/totalSplitQty", fTotal);
      },

      // Builds the npToConsumption-shaped array: one entry per material
      // that has at least one nonzero Split Qty batch, each carrying only
      // its nonzero-split npToBatch rows. Shared by Submit and Save-as-Draft.
      _buildConsumptionArray: function (sOrderPadded, sOperationId) {
        var aConsumptionRows =
          this.getView().getModel("consumptionModel").getProperty("/results") ||
          [];
        var oMaterialBatches = this._oMaterialBatches || {};

        return aConsumptionRows
          .map(function (oMatRow) {
            var aBatchRows = oMaterialBatches[oMatRow.material] || [];
            var aNonZeroBatches = aBatchRows
              .filter(function (oBatchRow) {
                return (parseFloat(oBatchRow.splitQty) || 0) !== 0;
              })
              .map(function (oBatchRow) {
                return {
                  order: sOrderPadded,
                  operation: sOperationId,
                  itemNo: oMatRow.itemNo,
                  material: oMatRow.material,
                  batch: oBatchRow.batch,
                  splitQty: oBatchRow.splitQty,
                };
              });

            // Movement type 531 is always included, batch split or not;
            // every other movement type (e.g. 261) only qualifies when it
            // has at least one nonzero-split batch.
            var bIs531 = oMatRow.movementType === "531";
            if (!bIs531 && aNonZeroBatches.length === 0) {
              return null;
            }

            return {
              order: sOrderPadded,
              operation: sOperationId,
              itemNo: oMatRow.itemNo,
              storageLoc: oMatRow.storageLoc,
              movementType: oMatRow.movementType,
              material: oMatRow.material,
              Quantity: oMatRow.Quantity,
              unit: oMatRow.unit,
              reservationNo: oMatRow.reservationNo || "",
              reservationItem: oMatRow.reservationItem || "",
              npToBatch: aNonZeroBatches,
            };
          })
          .filter(Boolean);
      },

      // ── Save as Draft ─────────────────────────────────────────────────
      // Saves every material's consumption + its nonzero batch splits
      // (same shape as the Submit payload's npToConsumption).
      onSaveConsumptionDraft: function () {
        var oCtx = this._oConsumptionContext;
        var sOrderPadded = ((oCtx && oCtx.order) || "")
          .toString()
          .padStart(12, "0");
        var sOperationId = oCtx && oCtx.operation;

        var aDraft = this._buildConsumptionArray(sOrderPadded, sOperationId);

        console.log("Consumption draft:", aDraft);

        if (aDraft.length === 0) {
          sap.m.MessageToast.show(
            "No materials with non-zero Split Qty to save.",
          );
          return;
        }

        // Remember that a draft now exists for the current yield, so a
        // later "Add Consumption" click can just re-show this data instead
        // of re-fetching, unless the yield changes (see
        // onOperatorYieldChange, which clears this flag).
        this._bBatchDraftSaved = true;

        // TODO: point this at the real save-draft endpoint once available.
        sap.m.MessageToast.show("Consumption saved as draft.");
        this.onCloseConsumptionDialog();
      },

      _openConsumptionDialog: function () {
        if (!this._oConsumptionDialog) {
          this._oConsumptionDialog = sap.ui.xmlfragment(
            "productionconfirmation.view.ConsumptionDialog",
            this,
          );
          this.getView().addDependent(this._oConsumptionDialog);
        }
        this._oConsumptionDialog.open();
      },

      onCloseConsumptionDialog: function () {
        if (this._oConsumptionDialog) {
          this._oConsumptionDialog.close();
        }
      },

      // ── Submit Order Confirmation ──────────────────────────────────────
      onSubmitOrderConfirmation: function () {
        var oView = this.getView();
        var oHeader = oView.getModel("confirmationHeaderModel").getData();
        var aRows =
          oView.getModel("confirmationTableModel").getProperty("/results") ||
          [];

        var bIsMouldOrder =
          oView
            .getModel("productionOrderModel")
            .getProperty("/IsMouldOrder") === "X";
        if (bIsMouldOrder) {
          if (!oHeader.actualCavityNo) {
            sap.m.MessageToast.show("Please enter Actual Cavity No.");
            return;
          }
          if (!oHeader.actualCycleTime) {
            sap.m.MessageToast.show("Please enter Actual Cycle Time.");
            return;
          }
          if (!oHeader.numberOfShots) {
            sap.m.MessageToast.show("Please enter Number of Shots.");
            return;
          }
        }

        if (aRows.length === 0) {
          sap.m.MessageToast.show(
            "Please add at least one operator before submitting.",
          );
          return;
        }

        if (!this._bBatchDraftSaved) {
          MessageBox.confirm(
            "No goods movement defined. Submit will apply the default " +
              "one. Continue?",
            {
              title: "No Goods Movement Defined",
              actions: [MessageBox.Action.OK, MessageBox.Action.CANCEL],
              emphasizedAction: MessageBox.Action.OK,
              onClose: function (sAction) {
                if (sAction === MessageBox.Action.OK) {
                  this._autoApplyDefaultConsumptionAndSubmit();
                }
              }.bind(this),
            },
          );
          return;
        }

        this._buildAndPostSubmitPayload();
      },

      // Fetches the default consumption details for the current
      // order/operation/yield (no dialog shown), auto-saves it as the
      // draft, then proceeds with the final submit. If none is found,
      // consumption is submitted as empty.
      _autoApplyDefaultConsumptionAndSubmit: function () {
        var oView = this.getView();
        var sOrder = oView
          .getModel("operationDetailModel")
          .getProperty("/order");
        var sOperation = oView
          .getModel("viewModel")
          .getProperty("/filterOperation");
        var fTotalYield =
          oView
            .getModel("viewModel")
            .getProperty("/confirmationTotals/yieldQty") || 0;
        var o = this._getSessionParams();

        this._oConsumptionContext = {
          order: sOrder,
          operation: sOperation,
          yield: fTotalYield,
        };

        var sUrl =
          Base_url +
          "/api/productionconfirmation/consumptiondetails/" +
          sOrder +
          "/" +
          sOperation +
          "/" +
          fTotalYield +
          "/" +
          o.plant +
          "/" +
          o.sessionId +
          "/" +
          o.employeeId;

        var fnFinish = function () {
          // Auto-save the draft (empty or not) so the submit payload's
          // npToConsumption reflects whatever was found, and continue.
          this._bBatchDraftSaved = true;
          oView.setBusy(false);
          this._buildAndPostSubmitPayload();
        }.bind(this);

        oView.setBusy(true);
        $.ajax({
          url: sUrl,
          method: "GET",
          headers: ngrokHeaders,
          contentType: "application/json",
          success: function (oResponse) {
            console.log("Default consumption details:", oResponse);
            var aResults = (oResponse && oResponse.results) || [];
            aResults = aResults.map(function (oMatRow) {
              return Object.assign({}, oMatRow, {
                originalQuantity: oMatRow.Quantity,
              });
            });
            oView.setModel(
              new JSONModel({ results: aResults }),
              "consumptionModel",
            );
            this._oMaterialBatches = {};

            if (aResults.length > 0) {
              this._prefetchAllMaterialBatches(aResults, fnFinish);
            } else {
              // No consumption found — submit with consumption empty.
              fnFinish();
            }
          }.bind(this),
          error: function (oXHR, sStatus, sError) {
            console.log(
              "Default consumption details error:",
              oXHR,
              sStatus,
              sError,
            );
            // No consumption found — submit with consumption empty.
            oView.setModel(new JSONModel({ results: [] }), "consumptionModel");
            this._oMaterialBatches = {};
            fnFinish();
          }.bind(this),
        });
      },

      // ── Builds the submit payload from current models and POSTs it ────
      _buildAndPostSubmitPayload: function () {
        var oView = this.getView();
        var oHeader = oView.getModel("confirmationHeaderModel").getData();
        var aRows =
          oView.getModel("confirmationTableModel").getProperty("/results") ||
          [];
        var bIsMouldOrder =
          oView
            .getModel("productionOrderModel")
            .getProperty("/IsMouldOrder") === "X";

        var sOperationId = oView
          .getModel("viewModel")
          .getProperty("/filterOperation");
        var oOperation = oView.getModel("operationDetailModel").getData();
        var oJobCard = oView.getModel("jobCardModel").getData();
        var oTotals = oView
          .getModel("viewModel")
          .getProperty("/confirmationTotals") || {
          yieldQty: 0,
          reworkQty: 0,
          scrapQty: 0,
        };
        var o = this._getSessionParams();

        var sOrderPadded = (oOperation.order || "")
          .toString()
          .padStart(12, "0");

        // ── npToAssignment: one entry per operator, individual quantities ──
        var aAssignments = aRows.map(function (oRow) {
          return {
            shiftDate: oJobCard.shiftDt,
            shiftId: oJobCard.shiftId,
            order: sOrderPadded,
            operation: sOperationId,
            employeeId: oRow.employeeId,
            yieldQty: oRow.yieldQty,
            scrapQty: oRow.scrapQty,
            reworkQty: oRow.reworkQty,
            unit: oRow.unit,
          };
        });

        // ── npToConsumption: material info + their nonzero split batches ──
        var aConsumption = this._buildConsumptionArray(
          sOrderPadded,
          sOperationId,
        );

        var oProductionOrder = oView.getModel("productionOrderModel").getData();

        var oPayload = {
          order: sOrderPadded,
          plant: o.plant,
          employeeId: o.employeeId,
          sessionId: o.sessionId,
          batch: oProductionOrder.batch || "",
          npToOperation: [
            {
              order: sOrderPadded,
              operation: sOperationId,
              yieldQty: (parseFloat(oTotals.yieldQty) || 0).toFixed(3),
              scrapQty: (parseFloat(oTotals.scrapQty) || 0).toFixed(3),
              reworkQty: (parseFloat(oTotals.reworkQty) || 0).toFixed(3),
              postingDate: this._toODataDate(oHeader.postingDate),
              execStrtDt: this._toODataDate(oHeader.execStrtDt),
              execStrtTm: this._toIsoDuration(oHeader.execStrtTm),
              execEndDt: this._toODataDate(oHeader.execEndDt),
              execEndTm: this._toIsoDuration(oHeader.execEndTm),
              breakTime: (parseFloat(oHeader.breakTime) || 0).toFixed(3),
              breakTimeUnit: oHeader.breakTimeUnit || "HR",
              confirmationText: oHeader.confirmationText || "",
              actualCavityNo: bIsMouldOrder ? oHeader.actualCavityNo || "" : "",
              // Always present in the payload — filled in by the user for
              // mould orders, silently defaulted to 00:00:00 otherwise.
              actualCycleTime: this._toIsoDuration(
                oHeader.actualCycleTime || "00:00:00",
              ),
              numberOfShots: bIsMouldOrder
                ? parseInt(oHeader.numberOfShots, 10) || 0
                : 0,
              ConfActivity1: oOperation.ConfActivity1 || "0",
              ConfActiUnit1: oOperation.ConfActiUnit1 || "",
              ConfActivity2: oOperation.ConfActivity2 || "0",
              ConfActiUnit2: oOperation.ConfActiUnit2 || "",
              ConfActivity3: oOperation.ConfActivity3 || "0",
              ConfActiUnit3: oOperation.ConfActiUnit3 || "",
              ConfActivity4: oOperation.ConfActivity4 || "0",
              ConfActiUnit4: oOperation.ConfActiUnit4 || "",
              ConfActivity5: oOperation.ConfActivity5 || "0",
              ConfActiUnit5: oOperation.ConfActiUnit5 || "",
              ConfActivity6: oOperation.ConfActivity6 || "0",
              ConfActiUnit6: oOperation.ConfActiUnit6 || "",
              npToJobCardItem: [
                {
                  jobCard: oJobCard.jobCardNo,
                  shiftDt: oJobCard.shiftDt,
                  shiftId: oJobCard.shiftId,
                  order: sOrderPadded,
                  operation: sOperationId,
                  npToAssignment: aAssignments,
                },
              ],
              npToConsumption: aConsumption,
            },
          ],
        };

        console.log("Submitting order confirmation:", oPayload);

        var sUrl =
          Base_url + "/api/productionconfirmation/submitorderconfirmation";

        oView.setBusy(true);
        $.ajax({
          url: sUrl,
          method: "POST",
          headers: ngrokHeaders,
          contentType: "application/json",
          data: JSON.stringify(oPayload),
          success: function (oResponse) {
            console.log("Order confirmation submitted:", oResponse);

            var sMsg = "Order confirmation submitted successfully.";
            try {
              var oMsg = JSON.parse(oResponse.message);
              sMsg = oMsg.message || sMsg;
            } catch (e) {
              if (oResponse && oResponse.message) {
                sMsg = oResponse.message;
              }
            }
            MessageBox.success(sMsg, {
              title: "Order Confirmation",
              onClose: function () {
                this.onClearFilter();
              }.bind(this),
            });
          }.bind(this),
          error: function (oXHR, sStatus, sError) {
            console.log(
              "Order confirmation submit error:",
              oXHR,
              sStatus,
              sError,
            );
            MessageBox.error("Failed to submit order confirmation.");
          },
          complete: function () {
            oView.setBusy(false);
          },
        });
      },

      // ── Clear Filter ─────────────────────────────────────────────────
      onClearFilter: function () {
        var oModel = this.getView().getModel("viewModel");
        var sToday = new Date().toISOString().split("T")[0];

        oModel.setProperty("/filterOrder", "");
        oModel.setProperty("/filterDate", sToday);
        oModel.setProperty("/filterShift", "");
        oModel.setProperty("/filterOperation", "");
        oModel.setProperty("/operationEnabled", false);
        oModel.setProperty("/operationDetailLoaded", false);
        oModel.setProperty("/selectedOperatorLabel", "");
        oModel.setProperty("/orderLoaded", false);
        oModel.setProperty("/filtersDirty", false);
        this._oMaterialBatches = {};
        this._oConsumptionContext = null;
        this._bBatchDraftSaved = false;
        this._fLastActivityYield = null;
        this._sScannedJobCardId = null;
        oModel.setProperty("/confirmationTotals", {
          yieldQty: 0,
          reworkQty: 0,
          scrapQty: 0,
        });

        this.getView().setModel(
          new JSONModel({ results: [] }),
          "operationListModel",
        );
        this.getView().setModel(
          new JSONModel({ order: "", houseId: "", houseDesc: "" }),
          "productionOrderModel",
        );
        this.getView().setModel(new JSONModel({}), "operationDetailModel");
        this.getView().setModel(
          new JSONModel({ results: [] }),
          "operatorAssignmentModel",
        );
        this.getView().setModel(
          new JSONModel({ results: [] }),
          "confirmationTableModel",
        );
        this.getView().setModel(
          new JSONModel({
            postingDate: sToday,
            execStrtDt: "",
            execStrtTm: "",
            execEndDt: "",
            execEndTm: "",
            breakTime: "",
            breakTimeUnit: "HR",
            confirmationText: "",
            actualCavityNo: "",
            actualCycleTime: "",
            numberOfShots: "",
          }),
          "confirmationHeaderModel",
        );

        var oOrderInput = this.byId("orderFilterInput");
        if (oOrderInput) {
          oOrderInput.setValue("");
        }
        // dateFilterInput is bound to /filterDate (set above), so it
        // refreshes itself.
        var oShiftSelect = this.byId("shiftSelect");
        if (oShiftSelect) {
          oShiftSelect.setSelectedKey("");
        }
        var oOperationSelect = this.byId("operationSelect");
        if (oOperationSelect) {
          oOperationSelect.setSelectedKey("");
        }

        sap.m.MessageToast.show("Filters cleared.");
      },

      // ── Apply Filter ────────────────────────────────────────────────
      onApplyFilter: function () {
        var oModel = this.getView().getModel("viewModel");
        var sOrderId = (oModel.getProperty("/filterOrder") || "").trim();
        var sFilterDate = oModel.getProperty("/filterDate");
        var sShiftId = (oModel.getProperty("/filterShift") || "").trim();
        var sOperationId = (
          oModel.getProperty("/filterOperation") || ""
        ).trim();

        if (!sOrderId) {
          sap.m.MessageToast.show("Please enter an Order ID.");
          return;
        }
        if (!sFilterDate) {
          sap.m.MessageToast.show("Please select a date.");
          return;
        }
        if (!sShiftId) {
          sap.m.MessageToast.show("Please enter a shift.");
          return;
        }
        if (!sOperationId) {
          sap.m.MessageToast.show("Please select an operation.");
          return;
        }

        this._applyFilters(sOrderId, sFilterDate, sShiftId, sOperationId);
      },

      // ── Shared filter-apply logic (manual Apply click or URL deep link) ──
      _applyFilters: function (sOrderId, sFilterDate, sShiftId, sOperationId) {
        var oModel = this.getView().getModel("viewModel");
        var sToday = new Date().toISOString().split("T")[0];
        oModel.setProperty("/filtersDirty", false);

        // Operation dropdown is repopulated once fresh order details come
        // back; keep the previously chosen operation (if any) so it can be
        // re-matched against the freshly loaded job card once both calls
        // complete below.
        oModel.setProperty("/operationEnabled", false);
        oModel.setProperty("/operationDetailLoaded", false);
        oModel.setProperty("/selectedOperatorLabel", "");
        this._oMaterialBatches = {};
        this._oConsumptionContext = null;
        this._bBatchDraftSaved = false;
        this._fLastActivityYield = null;
        oModel.setProperty("/confirmationTotals", {
          yieldQty: 0,
          reworkQty: 0,
          scrapQty: 0,
        });
        this.getView().setModel(
          new JSONModel({ results: [] }),
          "operationListModel",
        );
        this.getView().setModel(new JSONModel({}), "operationDetailModel");
        this.getView().setModel(
          new JSONModel({ results: [] }),
          "operatorAssignmentModel",
        );
        this.getView().setModel(
          new JSONModel({ results: [] }),
          "confirmationTableModel",
        );
        this.getView().setModel(
          new JSONModel({
            postingDate: sToday,
            execStrtDt: "",
            execStrtTm: "",
            execEndDt: "",
            execEndTm: "",
            breakTime: "",
            breakTimeUnit: "HR",
            confirmationText: "",
            actualCavityNo: "",
            actualCycleTime: "",
            numberOfShots: "",
          }),
          "confirmationHeaderModel",
        );

        // Prefer the Job Card No captured from a QR scan, if any; only
        // fall back to concatenating {OrderNo}-{yyyyMMdd}-{ShiftId} when
        // scanning didn't provide one (sFilterDate is already
        // yyyy-MM-dd — DatePicker valueFormat).
        var jobCardId = this._sScannedJobCardId;
        if (!jobCardId) {
          var sJobCardDate = (sFilterDate || "").split("-").join("");
          jobCardId = [sOrderId, sJobCardDate, sShiftId]
            .filter(Boolean)
            .join("-");
        }
        console.log("Job Card ID:", jobCardId);

        // Both calls run independently, but rendering the selected
        // operation needs data from both of them — wait for whichever
        // finishes last before matching/rendering, to avoid a race where
        // operationListModel (order details) is still empty when the
        // job card details callback fires first.
        var iPending = 2;
        var fnAfterBoth = function () {
          iPending--;
          if (iPending === 0) {
            this.getView().setBusy(false);
            if (sOperationId) {
              this._renderOperationDetails(sOperationId);
            }
          }
        }.bind(this);

        this.getView().setBusy(true);
        this._loadOrderDetails(sOrderId, fnAfterBoth, sOperationId);
        this._loadJobCardDetails(jobCardId, fnAfterBoth);
      },

      // ── Match selected operation against order details (header) and
      //     job card (operator panels), and render both independently ──
      _renderOperationDetails: function (sOperationId) {
        var oView = this.getView();

        // Header fields come only from npToOperation (order details API),
        // already extracted into operationListModel by _loadOrderDetails.
        var aOperations =
          oView.getModel("operationListModel").getProperty("/results") || [];
        var oOperation = aOperations.find(function (o) {
          return o.operation === sOperationId;
        });

        // Operator panels come only from the job card's npToItem/
        // npToAssignment (job card details API).
        var aItems = oView.getModel("jobCardModel").getProperty("/items") || [];
        var oItem = aItems.find(function (o) {
          return o.operation === sOperationId;
        });
        var aAssignments =
          (oItem && oItem.npToAssignment && oItem.npToAssignment.results) || [];
        // operatorAssignmentModel is the source list offered in the value
        // help dialog — pre-format planned hours for display there.
        aAssignments = aAssignments.map(
          function (oAssign) {
            return Object.assign({}, oAssign, {
              plannedHrsFmt: this.formatDuration(oAssign.plannedHrs),
            });
          }.bind(this),
        );

        if (!oOperation) {
          oView
            .getModel("viewModel")
            .setProperty("/operationDetailLoaded", false);
          oView.setModel(new JSONModel({}), "operationDetailModel");
          oView.setModel(
            new JSONModel({ results: [] }),
            "operatorAssignmentModel",
          );
          oView.setModel(
            new JSONModel({ results: [] }),
            "confirmationTableModel",
          );
          sap.m.MessageToast.show(
            "No operation details found for operation " + sOperationId + ".",
          );
          return;
        }

        oOperation = Object.assign({}, oOperation, {
          activities: this._buildActivityList(oOperation),
        });

        oView.setModel(new JSONModel(oOperation), "operationDetailModel");
        oView.setModel(
          new JSONModel({ results: aAssignments }),
          "operatorAssignmentModel",
        );
        // Confirmation table starts empty — operators are added one at a
        // time via the value help (onOpenOperatorValueHelp).
        oView.setModel(
          new JSONModel({ results: [] }),
          "confirmationTableModel",
        );
        oView.getModel("viewModel").setProperty("/operationDetailLoaded", true);

        if (!oItem) {
          sap.m.MessageToast.show(
            "No job card item found for operation " + sOperationId + ".",
          );
        }

        // Keep the dropdown visually showing the operation it was
        // rendered for (a fresh items binding can clear the UI selection).
        var oOperationSelect = this.byId("operationSelect");
        if (oOperationSelect) {
          oOperationSelect.setSelectedKey(sOperationId);
        }
      },

      // ── Order ID Scanner (QR / Barcode) ─────────────────────────────
      onScanOrderId: function () {
        // Start every scan from a clean slate.
        this.onClearFilter();

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
          // dateFilterInput is bound to /filterDate, so it refreshes itself.
          oModel.setProperty("/filterDate", sFilterDate);
        } else {
          sFilterDate = oModel.getProperty("/filterDate");
        }

        if (sShiftId) {
          // selectedKey is two-way bound to /filterShift, so the Select
          // picks this up automatically once shiftListModel is loaded.
          oModel.setProperty("/filterShift", sShiftId);
        } else {
          sShiftId = oModel.getProperty("/filterShift");
        }

        this._markFiltersDirty();

        // Order details are only fetched on Apply — scanning just
        // auto-populates the Operation dropdown so the user can pick one,
        // then click Apply to load everything else.
        this._loadOperationsOnly(sOrderNo);
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

      // ── API Calls ───────────────────────────────────────────────────
      // TODO: replace endpoint paths below with the real production
      // confirmation backend once available.

      // ── Order Details (fetched right after a QR scan) ────────────────
      _loadOrderDetails: function (sOrderId, fnCallback, sOperationId) {
        var o = this._getSessionParams();
        var sUrl =
          Base_url +
          "/api/productionconfirmation/orderdetails/" +
          sOrderId +
          "/" +
          o.plant +
          "/" +
          o.sessionId +
          "/" +
          o.employeeId;

        $.ajax({
          url: sUrl,
          method: "GET",
          headers: ngrokHeaders,
          contentType: "application/json",
          success: function (oResponse) {
            console.log("Order details:", oResponse);

            var aResults = (oResponse && oResponse.results) || [];
            var oOrder = aResults[0];
            if (!oOrder) {
              this.getView()
                .getModel("viewModel")
                .setProperty("/orderLoaded", false);
              if (fnCallback) fnCallback(oResponse);
              return;
            }

            var oData = Object.assign({}, oOrder);
            delete oData.__metadata;

            // Operations live under npToOperation.results — pull them out
            // into the operation dropdown, drop the nested OData artifacts.
            var aOperations =
              (oData.npToOperation && oData.npToOperation.results) || [];
            aOperations = aOperations.map(function (oOp) {
              var oItem = Object.assign({}, oOp);
              delete oItem.__metadata;
              delete oItem.npToComponent;
              delete oItem.npToJobCardItem;
              delete oItem.npToConsumption;
              return oItem;
            });
            delete oData.npToOperation;
            delete oData.npToIssue;
            delete oData.npToComponents;
            delete oData.npToReservation;
            delete oData.npToReceipts;

            this.getView().setModel(
              new JSONModel(oData),
              "productionOrderModel",
            );
            this.getView().setModel(
              new JSONModel({ results: aOperations }),
              "operationListModel",
            );

            var oViewModel = this.getView().getModel("viewModel");
            oViewModel.setProperty("/orderLoaded", true);
            oViewModel.setProperty("/operationEnabled", aOperations.length > 0);

            sap.m.MessageToast.show(
              sOperationId
                ? "Production order " +
                    oData.order +
                    " with operation " +
                    sOperationId +
                    " loaded successfully."
                : "Production order " + oData.order + " loaded successfully.",
            );

            if (fnCallback) {
              fnCallback(oResponse);
            }
          }.bind(this),
          error: function (oXHR, sStatus, sError) {
            console.log("Order details error:", oXHR, sStatus, sError);
            this.getView()
              .getModel("viewModel")
              .setProperty("/orderLoaded", false);
            if (fnCallback) {
              fnCallback(null);
            }
          }.bind(this),
        });
      },

      // ── Job Card Details (fetched independently, right after a QR scan) ──
      _loadJobCardDetails: function (sJobCardNo, fnCallback) {
        var o = this._getSessionParams();
        var sUrl =
          Base_url +
          "/api/productionconfirmation/jobcarddetails/" +
          sJobCardNo +
          "/" +
          o.plant +
          "/" +
          o.sessionId +
          "/" +
          o.employeeId;

        $.ajax({
          url: sUrl,
          method: "GET",
          headers: ngrokHeaders,
          contentType: "application/json",
          success: function (oResponse) {
            console.log("Job card details:", oResponse);

            var aResults = (oResponse && oResponse.results) || [];
            var oJobCard = aResults[0];

            if (!oJobCard) {
              this.getView().setModel(
                new JSONModel({ items: [] }),
                "jobCardModel",
              );
              if (fnCallback) fnCallback(oResponse);
              return;
            }

            // npToItem.results[] holds one entry per operation, each
            // carrying its operator assignments under npToAssignment —
            // clean out the OData metadata but keep both nested arrays
            // intact so onOperationChange + Apply can look items up later.
            var aItems = (oJobCard.npToItem && oJobCard.npToItem.results) || [];
            aItems = aItems.map(function (oRawItem) {
              var oCleanItem = Object.assign({}, oRawItem);
              delete oCleanItem.__metadata;

              var aAssignments =
                (oCleanItem.npToAssignment &&
                  oCleanItem.npToAssignment.results) ||
                [];
              aAssignments = aAssignments.map(function (oRawAssign) {
                var oCleanAssign = Object.assign({}, oRawAssign);
                delete oCleanAssign.__metadata;
                return oCleanAssign;
              });
              oCleanItem.npToAssignment = { results: aAssignments };

              return oCleanItem;
            });

            var oCleanJobCard = Object.assign({}, oJobCard);
            delete oCleanJobCard.__metadata;
            oCleanJobCard.items = aItems;
            delete oCleanJobCard.npToItem;

            this.getView().setModel(
              new JSONModel(oCleanJobCard),
              "jobCardModel",
            );

            if (fnCallback) {
              fnCallback(oResponse);
            }
          }.bind(this),
          error: function (oXHR, sStatus, sError) {
            console.log("Job card details error:", oXHR, sStatus, sError);
            this.getView().setModel(
              new JSONModel({ items: [] }),
              "jobCardModel",
            );
            if (fnCallback) {
              fnCallback(null);
            }
          }.bind(this),
        });
      },
    });
  },
);
