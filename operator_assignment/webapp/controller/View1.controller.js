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

    const Base_url = "http://localhost:3000";
    // const Base_url = "http://192.168.1.61:3000";
    // const Base_url = "http://192.168.0.136:3000";

    const Login_Url = "http://localhost:9000/index.html";
    // const Login_Url = "https://romsonsfiori.incresol.com/LoginApp";
    // const Login_Url = "https://webapps.romsons.com/LoginApp";

    const ngrokHeaders = { "ngrok-skip-browser-warning": "69420" };

    const SHIFT_HOURS = 12;

    return Controller.extend("operatorassignment.controller.View1", {
      // ── Init ────────────────────────────────────────────────────────
      onInit: function () {
        var sLogoUrl = sap.ui.require.toUrl(
          "operatorassignment/images/logoNew.svg",
        );
        this.byId("appLogo").setSrc(sLogoUrl);
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
        var sTodayDisplay = new Date().toLocaleDateString("en-GB", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
        var sFilterDate = sUrlDate || sToday;

        this.getView().setModel(
          new JSONModel({
            availableOperators: [],
            depts: [],
            filterOrder: sOrderId || "",
            filterDate: sFilterDate,
            isPastDate: false,
            orderLoaded: false,
            summary: {
              shiftLabel: "",
              shiftId: "",
              shiftSelected: false,
              todayDate: sTodayDisplay,
              opsAssigned: "0 / 0",
              totalOperators: 0,
              totalTarget: 0,
              totalHours: "0 hrs",
              partialOperators: 0,
              statusText: "Incomplete",
              statusState: "Warning",
            },
            _activeDeptPath: null,
            hasUnsavedChanges: false,
            operatorsLoading: false,
            filtersDirty: false,
            appliedPastDate: false,
          }),
          "viewModel",
        );
        this._updateIsPastDate();

        this.getView().setModel(
          new JSONModel({ houseId: "", houseDesc: "" }),
          "productionOrderModel",
        );

        if (sOrderId && sUrlDate && sUrlShift) {
          this._loadShiftList(
            function () {
              var oShiftSelect = this.byId("shiftSelect");
              if (oShiftSelect) {
                oShiftSelect.setSelectedKey(sUrlShift);
              }
              this._applyFilters(sOrderId, sFilterDate, sUrlShift);
            }.bind(this),
          );
        } else if (sOrderId) {
          this._iPendingCalls = 3;
          this.getView().setBusy(true);
          this._loadProductionOrder(sOrderId);
          this._loadOperationList(sOrderId);
          this._loadShiftList();
        } else {
          this._loadShiftList();
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
      },

      // ── Session check ───────────────────────────────────────────────
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

      // ── Past-date view-mode helper ────────────────────────────────────
      _updateIsPastDate: function () {
        var oModel = this.getView().getModel("viewModel");
        var sFilterDate = oModel.getProperty("/filterDate");
        var oYesterday = new Date();
        oYesterday.setDate(oYesterday.getDate() - 1);
        var sYesterday = oYesterday.toISOString().split("T")[0];
        oModel.setProperty(
          "/isPastDate",
          !!sFilterDate && sFilterDate < sYesterday,
        );
      },

      // ── Unapplied-filter warning ────────────────────────────────────
      _markFiltersDirty: function () {
        this.getView().getModel("viewModel").setProperty("/filtersDirty", true);
      },

      onOrderIdChange: function () {
        this._markFiltersDirty();
      },

      onFilterDateChange: function () {
        this._updateIsPastDate();
        this._markFiltersDirty();
      },

      // ── Apply Filter ────────────────────────────────────────────────
      onApplyFilter: function () {
        var oModel = this.getView().getModel("viewModel");
        var sOrderId = (oModel.getProperty("/filterOrder") || "").trim();
        var sFilterDate = oModel.getProperty("/filterDate");
        var oShiftSelect = this.byId("shiftSelect");
        var sShiftId = oShiftSelect ? oShiftSelect.getSelectedKey() : "";

        if (!sOrderId) {
          sap.m.MessageToast.show("Please enter an Order ID.");
          return;
        }
        if (!sFilterDate) {
          sap.m.MessageToast.show("Please select a date.");
          return;
        }
        if (!sShiftId) {
          sap.m.MessageToast.show("Please select a shift.");
          return;
        }

        this._applyFilters(sOrderId, sFilterDate, sShiftId);
      },

      // ── Shared filter-apply logic (manual Apply click or URL deep link) ──
      _applyFilters: function (sOrderId, sFilterDate, sShiftId) {
        var oModel = this.getView().getModel("viewModel");

        this._updateIsPastDate();
        this._clearShiftData();
        oModel.setProperty("/filtersDirty", false);
        oModel.setProperty(
          "/appliedPastDate",
          oModel.getProperty("/isPastDate"),
        );

        oModel.setProperty("/appliedDate", sFilterDate);
        oModel.setProperty("/summary/shiftLabel", "SHIFT-" + sShiftId);
        oModel.setProperty("/summary/shiftId", sShiftId);
        oModel.setProperty("/summary/shiftSelected", true);
        oModel.setProperty("/operatorsLoading", true);

        this.getView().setBusy(true);
        this._loadOperationList(
          sOrderId,
          function (bSuccess) {
            if (!bSuccess) {
              this.getView().setBusy(false);
              oModel.setProperty("/operatorsLoading", false);
              return;
            }
            this._loadProductionOrder(
              sOrderId,
              function (sHouseId) {
                var sShiftDate = sFilterDate + "T00:00:00";
                this._loadOperatorList(
                  sHouseId,
                  sShiftId,
                  function () {
                    this._loadOperatorAssignmentList(
                      sOrderId,
                      sShiftId,
                      sShiftDate,
                    );
                  }.bind(this),
                );
              }.bind(this),
            );
          }.bind(this),
        );
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
              ["employeeId", "sessionId", "plant"].forEach(function (sKey) {
                document.cookie =
                  sKey + "=;expires=Thu, 01 Jan 1970 00:00:00 GMT;path=/";
              });
              window.location.href = Login_Url;
            }
          },
        });
      },

      _getSessionParams: function () {
        var oCookies = this._parseCookies();
        return {
          employeeId: oCookies["employeeId"],
          plant: oCookies["plant"],
          sessionId: oCookies["sessionId"],
        };
      },

      _onCallComplete: function () {
        this._iPendingCalls--;
        if (this._iPendingCalls <= 0) {
          this.getView().setBusy(false);
        }
      },

      // ── Dept path helper ────────────────────────────────────────────
      // Returns the viewModel path up to /depts/N from any child context
      _deptPathFromContext: function (oEvent) {
        const oCtx = oEvent.getSource().getBindingContext("viewModel");
        if (!oCtx) return null;
        const aMatch = oCtx.getPath().match(/(\/depts\/\d+)/);
        return aMatch ? aMatch[1] : null;
      },

      // ── Summary recalculation ───────────────────────────────────────

      _updateDeptSummary: function (sDeptPath) {
        const oModel = this.getView().getModel("viewModel");
        const aOps = oModel.getProperty(sDeptPath + "/operators") || [];
        let totalHrs = 0,
          totalTgt = 0;
        aOps.forEach((op) => {
          totalHrs += parseFloat(op.hours) || 0;
          totalTgt += parseFloat(op.targetQty) || 0;
        });
        oModel.setProperty(sDeptPath + "/operatorCount", aOps.length);
        oModel.setProperty(sDeptPath + "/totalHours", totalHrs);
        oModel.setProperty(sDeptPath + "/totalTarget", totalTgt);
        oModel.setProperty(
          sDeptPath + "/hasUnsavedChanges",
          aOps.length > 0 && aOps.some((op) => op.isNew || op.isModified),
        );
      },

      _updateGlobalSummary: function () {
        const oModel = this.getView().getModel("viewModel");
        const aDepts = oModel.getProperty("/depts") || [];
        const nDepts = aDepts.length;

        let opsAssigned = 0;
        let totalOperators = 0;
        let totalTarget = 0;
        let totalHours = 0;
        let partialOps = 0;

        aDepts.forEach((dept) => {
          const aOps = dept.operators || [];
          if (aOps.length > 0) opsAssigned++;
          totalOperators += aOps.length;
          aOps.forEach((op) => {
            const h = parseFloat(op.hours) || 0;
            const t = parseFloat(op.targetQty) || 0;
            totalHours += h;
            totalTarget += t;
            if (h < SHIFT_HOURS) partialOps++;
          });
        });

        const bComplete = opsAssigned === nDepts && nDepts > 0;
        oModel.setProperty(
          "/summary/opsAssigned",
          opsAssigned + " / " + nDepts,
        );
        oModel.setProperty("/summary/totalOperators", totalOperators);
        oModel.setProperty("/summary/totalTarget", totalTarget);
        oModel.setProperty("/summary/totalHours", totalHours + " hrs");
        oModel.setProperty("/summary/partialOperators", partialOps);
        oModel.setProperty(
          "/summary/statusText",
          bComplete ? "Complete" : "Incomplete",
        );
        oModel.setProperty(
          "/summary/statusState",
          bComplete ? "Success" : "Warning",
        );
      },

      _refreshAll: function (sDeptPath) {
        this._updateDeptSummary(sDeptPath);
        this._updateGlobalSummary();
        this.getView()
          .getModel("viewModel")
          .setProperty("/hasUnsavedChanges", true);
      },

      // ── Add Operator ────────────────────────────────────────────────
      // Returns "" on success, otherwise a short reason the operator was skipped.
      _addOperatorToDept: function (sDeptPath, sOperatorId) {
        const oModel = this.getView().getModel("viewModel");
        if (!oModel.getProperty("/summary/shiftSelected")) {
          return "Please select a shift before assigning operators.";
        }
        if (!sDeptPath) return "No operation selected.";

        const oOp = (oModel.getProperty("/availableOperators") || []).find(
          (op) => op.id === sOperatorId,
        );
        if (!oOp) return sOperatorId + ": operator not found.";

        const aOps = oModel.getProperty(sDeptPath + "/operators") || [];
        if (aOps.some((op) => op.id === oOp.id)) {
          return oOp.name + " is already assigned to this operation.";
        }

        const aDepts = oModel.getProperty("/depts") || [];
        const oUnsavedDept = aDepts.find((oDept) =>
          (oDept.operators || []).some(
            (op) => op.id === oOp.id && (op.isNew || op.isModified),
          ),
        );
        if (oUnsavedDept) {
          return (
            oOp.name +
            " has unsaved changes in operation " +
            oUnsavedDept.operation +
            "."
          );
        }

        const fOperHrs =
          parseFloat(oModel.getProperty(sDeptPath + "/operHrs")) || SHIFT_HOURS;
        const fAvlHours = oOp.freeHoursVal || fOperHrs;

        aOps.push({
          id: oOp.id,
          name: oOp.name,
          displayName: oOp.name + " (" + oOp.id + ")",
          hours: "",
          originalHours: "",
          avlHoursMax: fAvlHours,
          targetQty: 0,
          freeHours: fAvlHours,
          operHrs: fOperHrs,
          isMachineSpecific: !!oModel.getProperty(
            sDeptPath + "/isMachineSpecific",
          ),
          remark: "",
          isNew: true,
          isModified: false,
        });

        oModel.setProperty(sDeptPath + "/operators", aOps);
        this._refreshAll(sDeptPath);
        return "";
      },

      // ── Remove Operator ─────────────────────────────────────────────
      onRemoveOperator: function (oEvent) {
        const oButton = oEvent.getSource();
        const sOpPath = oButton.getBindingContext("viewModel").getPath();
        const aMatch = sOpPath.match(/(\/depts\/\d+)\/operators\/(\d+)/);
        if (!aMatch) return;

        const sDeptPath = aMatch[1];
        const iOpIndex = parseInt(aMatch[2]);
        const oModel = this.getView().getModel("viewModel");
        const aOps = oModel.getProperty(sDeptPath + "/operators") || [];
        const oOp = aOps[iOpIndex];
        if (!oOp) return;

        const sMsg = "Are you sure you want to remove this operator?";

        var oConfirmDialog = new sap.m.Dialog({
          title: "Confirm Removal",
          type: "Message",
          content: new sap.m.Text({ text: sMsg }),
          beginButton: new sap.m.Button({
            icon: "sap-icon://delete",
            text: "Remove",
            type: "Negative",
            press: function () {
              oConfirmDialog.close();
              this._doRemoveOperator(
                oButton,
                sOpPath,
                sDeptPath,
                iOpIndex,
                oOp,
              );
            }.bind(this),
          }),
          endButton: new sap.m.Button({
            icon: "sap-icon://decline",
            text: "Cancel",
            type: "Emphasized",
            press: function () {
              oConfirmDialog.close();
            },
          }),
          afterClose: function () {
            oConfirmDialog.destroy();
          },
        });
        oConfirmDialog.open();
      },

      _doRemoveOperator: function (oButton, sOpPath, sDeptPath, iOpIndex, oOp) {
        const oModel = this.getView().getModel("viewModel");

        if (oOp.isNew) {
          // unsaved — just remove from UI
          const aOps = oModel.getProperty(sDeptPath + "/operators") || [];
          aOps.splice(iOpIndex, 1);
          oModel.setProperty(sDeptPath + "/operators", aOps);
          this._refreshAll(sDeptPath);
          const sHouseIdNew = this.getView()
            .getModel("productionOrderModel")
            .getProperty("/houseId");
          const sShiftIdNew = oModel.getProperty("/summary/shiftId");
          if (sHouseIdNew && sShiftIdNew) {
            this._loadOperatorList(sHouseIdNew, sShiftIdNew, null);
          }
          return;
        }

        // saved — call update API with status LEFT, then remove on success
        const oDept = oModel.getProperty(sDeptPath);
        const oSession = this._getSessionParams();
        const sHouseId = this.getView()
          .getModel("productionOrderModel")
          .getProperty("/houseId");
        const sShiftId = oModel.getProperty("/summary/shiftId");
        const sShiftDate = new Date().toISOString().split("T")[0] + "T00:00:00";

        var fnToIsoDuration = function (fDecimalHours) {
          var fVal = parseFloat(fDecimalHours) || 0;
          var iH = Math.floor(fVal);
          var iM = Math.floor((fVal - iH) * 60);
          var iS = Math.round(((fVal - iH) * 60 - iM) * 60);
          return (
            "PT" +
            String(iH).padStart(2, "0") +
            "H" +
            String(iM).padStart(2, "0") +
            "M" +
            String(iS).padStart(2, "0") +
            "S"
          );
        };

        var oAvailOp = (oModel.getProperty("/availableOperators") || []).find(
          function (op) {
            return op.id === oOp.id;
          },
        );
        var fFreeHoursVal =
          (oAvailOp ? parseFloat(oAvailOp.freeHoursVal) || 0 : 0) +
          (parseFloat(oOp.hours) || 0);

        var oPayload = {
          order: oDept.order,
          shiftId: sShiftId,
          employeeId: oOp.id,
          operation: oDept.operation,
          plannedHrs: fnToIsoDuration(oOp.hours),
          freeHrs: fnToIsoDuration(fFreeHoursVal),
          shiftDate: sShiftDate,
          targetQty: String(oOp.targetQty),
          sessionId: oSession.sessionId,
          plant: oSession.plant,
          unit: oDept.unit,
          status: "LEFT",
        };

        this.getView().setBusy(true);
        $.ajax({
          url: Base_url + "/api/operatorAssignment/updateOperatorAssignment",
          method: "PUT",
          headers: ngrokHeaders,
          contentType: "application/json",
          data: JSON.stringify(oPayload),
          success: function () {
            var aOpsLatest = oModel.getProperty(sDeptPath + "/operators") || [];
            aOpsLatest.splice(iOpIndex, 1);
            oModel.setProperty(sDeptPath + "/operators", aOpsLatest);
            this._refreshAll(sDeptPath);
            sap.m.MessageToast.show(oOp.name + " removed from operation.");
            if (sHouseId && sShiftId) {
              this._loadOperatorList(
                sHouseId,
                sShiftId,
                function () {
                  this.getView().setBusy(false);
                }.bind(this),
              );
            } else {
              this.getView().setBusy(false);
            }
          }.bind(this),
          error: function (oXHR, sStatus, sError) {
            sap.m.MessageBox.error(
              "Failed to remove " + oOp.name + ". Please try again.",
            );
            this.getView().setBusy(false);
          }.bind(this),
          complete: function () {},
        });
      },

      // ── Hours Change ────────────────────────────────────────────────
      onHoursChange: function (oEvent) {
        const oInput = oEvent.getSource();
        const sOpPath = oInput.getBindingContext("viewModel").getPath();
        const sDeptPath = sOpPath.replace(/\/operators\/\d+$/, "");

        const oModel = this.getView().getModel("viewModel");
        const fOperHrs =
          parseFloat(oModel.getProperty(sDeptPath + "/operHrs")) || SHIFT_HOURS;
        const fOperTargetQty =
          parseFloat(oModel.getProperty(sDeptPath + "/operTargetQty")) || 0;
        const sOpId = oModel.getProperty(sOpPath + "/id");
        const sOpName = oModel.getProperty(sOpPath + "/name");
        const bIsNewOp = oModel.getProperty(sOpPath + "/isNew");
        const fSavedHours = bIsNewOp
          ? 0
          : parseFloat(oModel.getProperty(sOpPath + "/originalHours")) || 0;
        const oAvailOp = (oModel.getProperty("/availableOperators") || []).find(
          function (op) {
            return op.id === sOpId;
          },
        );
        const fRemainingFree = oAvailOp
          ? parseFloat(oAvailOp.freeHoursVal) || 0
          : 0;
        // new: max = freeHours only; saved: max = savedHours + freeHours
        const fAvlHoursMax = bIsNewOp
          ? fRemainingFree
          : fSavedHours + fRemainingFree;

        const bIsMachineSpecific = !!oModel.getProperty(
          sOpPath + "/isMachineSpecific",
        );

        const sVal = oInput.getValue().trim();
        if (sVal === "") {
          oModel.setProperty(sOpPath + "/hours", "");
          oModel.setProperty(sOpPath + "/freeHours", fAvlHoursMax);
          if (!bIsMachineSpecific) {
            oModel.setProperty(sOpPath + "/targetQty", 0);
          }
          this._refreshAll(sDeptPath);
          return;
        }

        let hours = parseFloat(sVal) || 0;

        console.log(
          "[HoursChange]",
          sOpName,
          "| free hrs:",
          fRemainingFree,
          "| assigning:",
          hours,
          bIsNewOp ? "" : "| saved assigned hrs: " + fSavedHours,
        );

        if (hours > fAvlHoursMax) {
          sap.m.MessageToast.show(
            sOpName +
              " only has " +
              fRemainingFree +
              "h free. Maximum allowed is " +
              fAvlHoursMax +
              "h.",
          );
          var fPrevHours = bIsNewOp ? 0 : fSavedHours;
          oInput.setValue(fPrevHours || "");
          oModel.setProperty(sOpPath + "/hours", fPrevHours || "");
          return;
        }
        if (hours < 0) hours = 0;

        if (!bIsMachineSpecific) {
          const fTargetQty =
            fOperHrs > 0
              ? Math.round((hours / fOperHrs) * fOperTargetQty * 100) / 100
              : 0;

          // Production Details pending qty = Quantity - Yield Qty
          const fQuantity =
            parseFloat(oModel.getProperty(sDeptPath + "/quantity")) || 0;
          const fYieldQty =
            parseFloat(oModel.getProperty(sDeptPath + "/yieldQty")) || 0;
          const fPendingQty = fQuantity - fYieldQty;

          // Total target qty already filled by the other operators in this
          // operation's table.
          const iRowIdx = parseInt(sOpPath.match(/\/operators\/(\d+)$/)[1], 10);
          const aOperators = oModel.getProperty(sDeptPath + "/operators") || [];
          const fOthersTotal = aOperators.reduce(function (fSum, oOp, i) {
            return i === iRowIdx
              ? fSum
              : fSum + (parseFloat(oOp.targetQty) || 0);
          }, 0);

          const fRemainingQty = fPendingQty - fOthersTotal;

          console.log(
            "[HoursChange -> TargetQty Check]",
            sOpName,
            "| quantity:",
            fQuantity,
            "| yieldQty:",
            fYieldQty,
            "| pendingQty:",
            fPendingQty,
            "| othersTotalTargetQty:",
            fOthersTotal,
            "| remainingQty:",
            fRemainingQty,
            "| computedTargetQty:",
            fTargetQty,
          );

          if (fTargetQty > fRemainingQty) {
            MessageBox.error(
              sOpName +
                "'s expected target qty is " +
                fTargetQty +
                " for " +
                hours +
                " hrs. This operation has " +
                fRemainingQty +
                " qty pending. Can't assign more.",
              { title: "Target Qty Exceeded" },
            );
            var fRevertHours = bIsNewOp ? "" : fSavedHours || "";
            oInput.setValue(fRevertHours);
            oModel.setProperty(sOpPath + "/hours", fRevertHours);
            oModel.setProperty(
              sOpPath + "/freeHours",
              fAvlHoursMax - (parseFloat(fRevertHours) || 0),
            );
            return;
          }

          // apply changes to model temporarily so summary refreshes
          oModel.setProperty(sOpPath + "/hours", hours);
          oModel.setProperty(sOpPath + "/freeHours", fAvlHoursMax - hours);
          oModel.setProperty(sOpPath + "/targetQty", fTargetQty);
        } else {
          // apply changes to model temporarily so summary refreshes
          oModel.setProperty(sOpPath + "/hours", hours);
          oModel.setProperty(sOpPath + "/freeHours", fAvlHoursMax - hours);
        }
        if (!oModel.getProperty(sOpPath + "/isNew")) {
          oModel.setProperty(sOpPath + "/isModified", true);
        }
        this._refreshAll(sDeptPath);

        // Machine-specific operations: hours and target qty are both filled
        // in manually with no auto-calculation. The user fills hours first,
        // then target qty — the save/discard prompt appears on target qty
        // change instead of here.
        if (bIsMachineSpecific) {
          return;
        }

        // New rows are saved together via the bottom Save button.
        if (oModel.getProperty(sOpPath + "/isNew")) {
          return;
        }

        const bIsNew = oModel.getProperty(sOpPath + "/isNew");
        const sAction = bIsNew ? "Save" : "Update";
        const sActionIcon = bIsNew ? "sap-icon://save" : "sap-icon://accept";

        var fnDiscard = function () {
          const fReset = bIsNew
            ? ""
            : oModel.getProperty(sOpPath + "/originalHours");
          const fResetNum = parseFloat(fReset) || 0;
          const fResetTarget =
            fOperHrs > 0
              ? Math.round((fResetNum / fOperHrs) * fOperTargetQty * 100) / 100
              : 0;
          oModel.setProperty(sOpPath + "/hours", fReset);
          oModel.setProperty(sOpPath + "/freeHours", fAvlHoursMax - fResetNum);
          oModel.setProperty(sOpPath + "/targetQty", fResetTarget);
          oModel.setProperty(sOpPath + "/isModified", false);
          oInput.setValue(fReset === "" ? "" : String(fReset));
          this._refreshAll(sDeptPath);
          oDialog.close();
        }.bind(this);

        var oDialog = new sap.m.Dialog({
          title: sAction + " Hours",
          type: "Message",
          content: new sap.m.Text({
            text:
              "Hours changed for " +
              sOpName +
              " to " +
              hours +
              "h. " +
              sAction +
              " or discard?",
          }),
          beginButton: new sap.m.Button({
            icon: sActionIcon,
            text: sAction,
            type: "Success",
            press: function () {
              oDialog.close();
              this._saveOperatorRow(sOpPath, sDeptPath);
            }.bind(this),
          }),
          endButton: new sap.m.Button({
            icon: "sap-icon://decline",
            text: "Discard",
            type: "Negative",
            press: fnDiscard,
          }),
          afterClose: function () {
            oDialog.destroy();
          },
        });
        oDialog.open();
      },

      // ── Target Change (Machine-specific operations only) ───────────────
      onTargetChange: function (oEvent) {
        const oInput = oEvent.getSource();
        const sOpPath = oInput.getBindingContext("viewModel").getPath();
        const sDeptPath = sOpPath.replace(/\/operators\/\d+$/, "");

        const oModel = this.getView().getModel("viewModel");
        const sOpName = oModel.getProperty(sOpPath + "/name");
        const bIsNewOp = oModel.getProperty(sOpPath + "/isNew");
        const fOriginalTarget = bIsNewOp
          ? 0
          : parseFloat(oModel.getProperty(sOpPath + "/targetQty")) || 0;

        // Assigned hours must be filled in before the target qty.
        const sHours = (oModel.getProperty(sOpPath + "/hours") || "")
          .toString()
          .trim();
        if (sHours === "") {
          sap.m.MessageToast.show(
            "Please enter Assigned Hours for " + sOpName + " first.",
          );
          oInput.setValue(fOriginalTarget || "");
          oModel.setProperty(sOpPath + "/targetQty", fOriginalTarget);
          return;
        }

        const sVal = oInput.getValue().trim();
        const fTargetQty = sVal === "" ? 0 : parseFloat(sVal) || 0;

        // Sum of target qty filled by all operators in this operation must
        // not exceed the operation's Target Quantity (Per Shift).
        const iRowIdx = parseInt(sOpPath.match(/\/operators\/(\d+)$/)[1], 10);
        const aOperators = oModel.getProperty(sDeptPath + "/operators") || [];
        const fOperTargetQty =
          parseFloat(oModel.getProperty(sDeptPath + "/operTargetQty")) || 0;
        const fOthersTotal = aOperators.reduce(function (fSum, oOp, i) {
          return i === iRowIdx ? fSum : fSum + (parseFloat(oOp.targetQty) || 0);
        }, 0);

        if (fOthersTotal + fTargetQty > fOperTargetQty) {
          MessageBox.error(
            "Total Target Qty for this operation cannot exceed " +
              fOperTargetQty +
              " (per shift). Already filled: " +
              fOthersTotal +
              ".",
            { title: "Target Qty Exceeded" },
          );
          oInput.setValue(fOriginalTarget || "");
          oModel.setProperty(sOpPath + "/targetQty", fOriginalTarget);
          return;
        }

        // Sum of target qty across operators must also not exceed
        // Production Details: Quantity - Yield Qty. On exceed, remove
        // this operator's row entirely once the user acknowledges.
        const fQuantity =
          parseFloat(oModel.getProperty(sDeptPath + "/quantity")) || 0;
        const fYieldQty =
          parseFloat(oModel.getProperty(sDeptPath + "/yieldQty")) || 0;
        const fPendingQty = fQuantity - fYieldQty;

        if (fOthersTotal + fTargetQty > fPendingQty) {
          var that = this;
          MessageBox.error(
            "Total Target Qty for this operation cannot exceed the pending quantity (Quantity - Yield Qty = " +
              fPendingQty +
              "). This operator's row will be removed.",
            {
              title: "Target Qty Exceeded",
              onClose: function () {
                const oOpToRemove = oModel.getProperty(sOpPath);
                if (oOpToRemove) {
                  that._doRemoveOperator(
                    null,
                    sOpPath,
                    sDeptPath,
                    iRowIdx,
                    oOpToRemove,
                  );
                }
              },
            },
          );
          return;
        }

        oModel.setProperty(sOpPath + "/targetQty", fTargetQty);
        if (!bIsNewOp) {
          oModel.setProperty(sOpPath + "/isModified", true);
        }
        this._refreshAll(sDeptPath);

        // New rows are saved together via the bottom Save button.
        if (bIsNewOp) {
          return;
        }

        const sAction = bIsNewOp ? "Save" : "Update";
        const sActionIcon = bIsNewOp ? "sap-icon://save" : "sap-icon://accept";

        var fnDiscard = function () {
          const fReset = bIsNewOp ? 0 : fOriginalTarget;
          oModel.setProperty(sOpPath + "/targetQty", fReset);
          oModel.setProperty(sOpPath + "/isModified", false);
          oInput.setValue(fReset || "");
          this._refreshAll(sDeptPath);
          oDialog.close();
        }.bind(this);

        var oDialog = new sap.m.Dialog({
          title: sAction + " Target Qty",
          type: "Message",
          content: new sap.m.Text({
            text:
              "Target Qty changed for " +
              sOpName +
              " to " +
              fTargetQty +
              ". " +
              sAction +
              " or discard?",
          }),
          beginButton: new sap.m.Button({
            icon: sActionIcon,
            text: sAction,
            type: "Success",
            press: function () {
              oDialog.close();
              this._saveOperatorRow(sOpPath, sDeptPath);
            }.bind(this),
          }),
          endButton: new sap.m.Button({
            icon: "sap-icon://decline",
            text: "Discard",
            type: "Negative",
            press: fnDiscard,
          }),
          afterClose: function () {
            oDialog.destroy();
          },
        });
        oDialog.open();
      },

      // ── Remark Change ──────────────────────────────────────────────
      onRemarkChange: function () {
        this.getView()
          .getModel("viewModel")
          .setProperty("/hasUnsavedChanges", true);
      },

      // ── Order ID Value Help (released orders F4, paginated) ─────────
      ORDER_PAGE_SIZE: 100,

      onOrderValueHelp: function () {
        var that = this;
        var oList = new sap.m.List({
          mode: "SingleSelectMaster",
          selectionChange: function (oEvent) {
            var oItem = oEvent.getParameter("listItem");
            that
              .getView()
              .getModel("viewModel")
              .setProperty("/filterOrder", oItem.getTitle());
            that._markFiltersDirty();
            that._oOrderDialog.close();
          },
        });
        var oMoreBtn = new sap.m.Button({
          text: "Load More",
          icon: "sap-icon://navigation-down-arrow",
          visible: false,
          press: function () {
            that._fetchOrderPage();
          },
        });
        var oSearch = new sap.m.SearchField({
          placeholder: "Search order or material",
          liveChange: function (oEvent) {
            var sVal = (oEvent.getParameter("newValue") || "").toLowerCase();
            oList.getItems().forEach(function (oItem) {
              oItem.setVisible(
                oItem.getTitle().toLowerCase().indexOf(sVal) > -1 ||
                  oItem.getDescription().toLowerCase().indexOf(sVal) > -1,
              );
            });
          },
        });

        this._oOrderState = { skip: 0, list: oList, moreBtn: oMoreBtn };
        this._oOrderDialog = new Dialog({
          title: "Select Order",
          contentWidth: "420px",
          contentHeight: "500px",
          content: [oSearch, oList],
          buttons: [
            oMoreBtn,
            new sap.m.Button({
              text: "Close",
              press: function () {
                that._oOrderDialog.close();
              },
            }),
          ],
          afterClose: function () {
            that._oOrderDialog.destroy();
            that._oOrderDialog = null;
          },
        });
        this.getView().addDependent(this._oOrderDialog);
        this._oOrderDialog.open();
        this._fetchOrderPage();
      },

      _fetchOrderPage: function () {
        var that = this;
        var oState = this._oOrderState;
        var o = this._getSessionParams();
        var sUrl =
          Base_url +
          "/api/f4/operator_assign/orders_released?empid=" +
          encodeURIComponent(o.employeeId) +
          "&sesid=" +
          encodeURIComponent(o.sessionId) +
          "&plant=" +
          encodeURIComponent(o.plant) +
          "&top=" +
          this.ORDER_PAGE_SIZE +
          "&skip=" +
          oState.skip;

        this._oOrderDialog.setBusy(true);
        $.ajax({
          url: sUrl,
          method: "GET",
          headers: ngrokHeaders,
          contentType: "application/json",
          success: function (oResponse) {
            console.log("orders_released response:", oResponse);
            if (oResponse && oResponse.success === false) {
              var sErr = "Failed to fetch released orders.";
              try {
                sErr =
                  oResponse.error.error.message.value ||
                  oResponse.message ||
                  sErr;
              } catch (e) {
                sErr = (oResponse && oResponse.message) || sErr;
              }
              MessageBox.error(sErr, { title: "Released Orders Error" });
              return;
            }
            var aValues = (oResponse && oResponse.values) || [];
            aValues.forEach(function (r) {
              oState.list.addItem(
                new sap.m.StandardListItem({
                  title: r.key,
                  description: r.text + (r.info ? " (" + r.info + ")" : ""),
                }),
              );
            });
            oState.skip += aValues.length;
            oState.moreBtn.setVisible(
              !!oResponse.has_more && aValues.length > 0,
            );
          },
          error: function (oXHR) {
            var sMsg = "Failed to fetch released orders.";
            try {
              var oErr = JSON.parse(oXHR.responseText);
              sMsg =
                (oErr.error &&
                  oErr.error.error &&
                  oErr.error.error.message &&
                  oErr.error.error.message.value) ||
                oErr.message ||
                sMsg;
            } catch (e) {}
            MessageBox.error(sMsg, { title: "Released Orders Error" });
          },
          complete: function () {
            if (that._oOrderDialog) that._oOrderDialog.setBusy(false);
          },
        });
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
              console.log(decodedText);

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
          this._updateIsPastDate();
        } else {
          sFilterDate = oModel.getProperty("/filterDate");
        }

        this._markFiltersDirty();

        if (!sFilterDate) {
          sap.m.MessageToast.show("Please select a date.");
          return;
        }

        var that = this;

        if (sShiftId) {
          // Ensure the shift list is loaded so we can select the scanned
          // shift, then apply order + date + shift together.
          this._loadShiftList(function () {
            var oShiftSelect = that.byId("shiftSelect");
            if (oShiftSelect) {
              oShiftSelect.setSelectedKey(sShiftId);
            }
            that._applyFilters(sOrderNo, sFilterDate, sShiftId);
          });
        } else {
          this.onApplyFilter();
        }
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

      // ── Operator Value Help ─────────────────────────────────────────
      onOpenOperatorDialog: function (oEvent) {
        if (
          !this.getView()
            .getModel("viewModel")
            .getProperty("/summary/shiftSelected")
        ) {
          sap.m.MessageToast.show(
            "Please select a shift before assigning operators.",
          );
          return;
        }
        const sDeptPath = this._deptPathFromContext(oEvent);
        this.getView()
          .getModel("viewModel")
          .setProperty("/_activeDeptPath", sDeptPath);

        if (!this._oDialog) {
          this._oDialog = sap.ui.xmlfragment(
            "operatorassignment.view.OperatorDialog",
            this,
          );
          this.getView().addDependent(this._oDialog);
          if (this._oDialog._oCancelButton) {
            this._oDialog._oCancelButton.setType("Negative");
            this._oDialog._oCancelButton.setIcon("sap-icon://decline");
          }
        }
        this._oDialog.open();
      },

      onSearchOperator: function (oEvent) {
        const sValue =
          oEvent.getParameter("value") || oEvent.getParameter("newValue") || "";
        const oBinding = oEvent.getSource().getBinding("items");
        if (!sValue) {
          oBinding.filter([]);
          return;
        }
        const oFilter = new sap.ui.model.Filter({
          filters: [
            new sap.ui.model.Filter(
              "name",
              sap.ui.model.FilterOperator.Contains,
              sValue,
            ),
            new sap.ui.model.Filter(
              "id",
              sap.ui.model.FilterOperator.Contains,
              sValue,
            ),
            new sap.ui.model.Filter(
              "designation",
              sap.ui.model.FilterOperator.Contains,
              sValue,
            ),
          ],
          and: false,
        });
        oBinding.filter([oFilter]);
      },

      onOperatorSelect: function (oEvent) {
        const aItems = oEvent.getParameter("selectedItems") || [];
        if (!aItems.length) return;

        const oModel = this.getView().getModel("viewModel");
        const sDeptPath = oModel.getProperty("/_activeDeptPath");
        if (!sDeptPath) return;

        const aSkipped = [];
        aItems.forEach(
          function (oItem) {
            const oData = oItem.getBindingContext("viewModel").getObject();
            if ((oData.freeHoursVal || 0) <= 0) {
              aSkipped.push(
                oData.name + " has no free hours available for this shift.",
              );
              return;
            }
            const sReason = this._addOperatorToDept(sDeptPath, oData.id);
            if (sReason) aSkipped.push(sReason);
          }.bind(this),
        );

        oModel.setProperty(sDeptPath + "/selectedOperator", "");
        oModel.setProperty(sDeptPath + "/selectedOperatorName", "");

        if (aSkipped.length) {
          MessageBox.warning(aSkipped.join("\n"), {
            title: "Some operators were not added",
          });
        }
      },

      // ── Shift Change ────────────────────────────────────────────────
      _clearShiftData: function () {
        const oModel = this.getView().getModel("viewModel");
        const aDepts = oModel.getProperty("/depts") || [];
        aDepts.forEach(function (_, i) {
          oModel.setProperty("/depts/" + i + "/operators", []);
          oModel.setProperty("/depts/" + i + "/operatorCount", 0);
          oModel.setProperty("/depts/" + i + "/totalHours", 0);
          oModel.setProperty("/depts/" + i + "/totalTarget", 0);
          oModel.setProperty("/depts/" + i + "/selectedOperator", "");
          oModel.setProperty("/depts/" + i + "/selectedOperatorName", "");
        });
        this._updateGlobalSummary();
        oModel.setProperty("/hasUnsavedChanges", false);
        oModel.setProperty("/operatorsLoading", false);
        oModel.setProperty("/summary/shiftId", "");
        oModel.setProperty("/summary/shiftLabel", "");
        oModel.setProperty("/summary/shiftSelected", false);
      },

      onShiftChange: function (oEvent) {
        const oItem = oEvent.getParameter("selectedItem");
        const sShiftId = oItem ? oItem.getKey() : "";
        const oModel = this.getView().getModel("viewModel");

        this._markFiltersDirty();

        oModel.setProperty(
          "/summary/shiftLabel",
          sShiftId ? "SHIFT-" + sShiftId : "",
        );
        oModel.setProperty("/summary/shiftId", sShiftId);
      },

      _loadOperatorAssignmentList: function (sOrder, sShiftId, sShiftDate) {
        var o = this._getSessionParams();
        var sUrl =
          Base_url +
          "/api/operatorAssignment/getOperatorAssignmentList/" +
          o.employeeId +
          "/" +
          o.plant +
          "/" +
          o.sessionId +
          "/" +
          sOrder +
          "/" +
          sShiftId +
          "/" +
          encodeURIComponent(sShiftDate);

        this.getView().setBusy(true);

        $.ajax({
          url: sUrl,
          method: "GET",
          headers: ngrokHeaders,
          contentType: "application/json",
          success: function (oResponse) {
            var aResults =
              (oResponse.d && oResponse.d.results) || oResponse.results || [];

            if (aResults.length === 0) {
              sap.m.MessageToast.show(
                "No existing assignment found for this shift.",
              );
              this.getView()
                .getModel("viewModel")
                .setProperty("/operatorsLoading", false);
              return;
            }

            sap.m.MessageToast.show(
              "Existing assignment found for this shift (" +
                aResults.length +
                " record(s)).",
            );

            var oViewModel = this.getView().getModel("viewModel");
            var aDepts = oViewModel.getProperty("/depts") || [];
            var aAvailableOperators =
              oViewModel.getProperty("/availableOperators") || [];

            // group assignment results by operation
            var oByOperation = {};
            aResults.forEach(function (oItem) {
              var sOp = oItem.operation;
              if (!oByOperation[sOp]) oByOperation[sOp] = [];
              oByOperation[sOp].push(oItem);
            });

            aDepts.forEach(
              function (oDept, iIdx) {
                var aAssigned = oByOperation[oDept.operation] || [];
                if (aAssigned.length === 0) return;

                var aOperators = aAssigned.map(function (oItem) {
                  var oAvail = aAvailableOperators.find(function (o) {
                    return o.id === oItem.employeeId;
                  });
                  var sName = oAvail ? oAvail.name : oItem.employeeId;
                  var sDesig = oAvail ? oAvail.designation : "";
                  var fHours = oItem.plannedHrs
                    ? parseInt(
                        (oItem.plannedHrs.match(/PT(\d+)H/) || [])[1] || 0,
                      ) +
                      parseInt(
                        (oItem.plannedHrs.match(/(\d+)M/) || [])[1] || 0,
                      ) /
                        60
                    : SHIFT_HOURS;
                  var fFreeHrs = oItem.freeHrs
                    ? parseInt(
                        (oItem.freeHrs.match(/PT(\d+)H/) || [])[1] || 0,
                      ) +
                      parseInt((oItem.freeHrs.match(/(\d+)M/) || [])[1] || 0) /
                        60
                    : 0;
                  return {
                    id: oItem.employeeId,
                    name: sName,
                    designation: sDesig,
                    displayName: sName + " (" + oItem.employeeId + ")",
                    hours: fHours,
                    originalHours: fHours,
                    avlHoursMax: fHours,
                    targetQty: parseFloat(oItem.targetQty) || 0,
                    freeHours: fFreeHrs,
                    operHrs: oDept.operHrs || SHIFT_HOURS,
                    isMachineSpecific: !!oDept.isMachineSpecific,
                    remark: "",
                    isNew: false,
                    isModified: false,
                  };
                });

                oViewModel.setProperty(
                  "/depts/" + iIdx + "/operators",
                  aOperators,
                );
                this._updateDeptSummary("/depts/" + iIdx);
              }.bind(this),
            );

            this._updateGlobalSummary();
          }.bind(this),
          error: function (oXHR, sStatus, sError) {
            var sMsg = "Failed to fetch operator assignment list.";
            try {
              var oErr = JSON.parse(oXHR.responseText);
              sMsg =
                (oErr.error &&
                  oErr.error.error &&
                  oErr.error.error.message &&
                  oErr.error.error.message.value) ||
                oErr.message ||
                sMsg;
            } catch (e) {}
            sap.m.MessageBox.error(sMsg, {
              title: "Operator Assignment List Error",
            });
          },
          complete: function () {
            this.getView().setBusy(false);
            this.getView()
              .getModel("viewModel")
              .setProperty("/operatorsLoading", false);
          }.bind(this),
        });
      },

      _saveOperatorRow: function (sOpPath, sDeptPath) {
        const oModel = this.getView().getModel("viewModel");
        const oOp = oModel.getProperty(sOpPath);
        const oDept = oModel.getProperty(sDeptPath);

        if (oOp.hours === "" || oOp.hours === undefined) {
          sap.m.MessageToast.show("Please enter assigned hours before saving.");
          return;
        }

        const oSession = this._getSessionParams();
        const sHouseId = this.getView()
          .getModel("productionOrderModel")
          .getProperty("/houseId");
        const sShiftId = oModel.getProperty("/summary/shiftId");
        const sShiftDate = new Date().toISOString().split("T")[0] + "T00:00:00";

        var fnToIsoDuration = function (fDecimalHours) {
          var fVal = parseFloat(fDecimalHours) || 0;
          var iH = Math.floor(fVal);
          var iM = Math.floor((fVal - iH) * 60);
          var iS = Math.round(((fVal - iH) * 60 - iM) * 60);
          return (
            "PT" +
            String(iH).padStart(2, "0") +
            "H" +
            String(iM).padStart(2, "0") +
            "M" +
            String(iS).padStart(2, "0") +
            "S"
          );
        };

        var bIsNew = oOp.isNew;
        var sUrl = bIsNew
          ? Base_url + "/api/operatorAssignment/assignOperator"
          : Base_url + "/api/operatorAssignment/updateOperatorAssignment";
        var sMethod = bIsNew ? "POST" : "PUT";

        var oAvailOp = (oModel.getProperty("/availableOperators") || []).find(
          function (op) {
            return op.id === oOp.id;
          },
        );
        var fFreeHoursVal = Math.max(
          0,
          (oAvailOp ? parseFloat(oAvailOp.freeHoursVal) || 0 : 0) -
            (parseFloat(oOp.hours) || 0),
        );

        var oPayload = bIsNew
          ? {
              order: oDept.order,
              plant: oSession.plant,
              shiftDate: sShiftDate,
              sessionId: oSession.sessionId,
              operation: oDept.operation,
              shiftId: sShiftId,
              status: "",
              employeeId: oOp.id,
              houseId: sHouseId,
              plannedHrs: fnToIsoDuration(oOp.hours),
              freeHrs: fnToIsoDuration(fFreeHoursVal),
              targetQty: String(oOp.targetQty),
              unit: oDept.unit,
            }
          : {
              order: oDept.order,
              shiftId: sShiftId,
              employeeId: oOp.id,
              operation: oDept.operation,
              plannedHrs: fnToIsoDuration(oOp.hours),
              freeHrs: fnToIsoDuration(fFreeHoursVal),
              shiftDate: sShiftDate,
              targetQty: String(oOp.targetQty),
              sessionId: oSession.sessionId,
              plant: oSession.plant,
              unit: oDept.unit,
            };

        this.getView().setBusy(true);
        $.ajax({
          url: sUrl,
          method: sMethod,
          headers: ngrokHeaders,
          contentType: "application/json",
          data: JSON.stringify(oPayload),
          success: function (oResponse) {
            oModel.setProperty(sOpPath + "/isNew", false);
            oModel.setProperty(sOpPath + "/isModified", false);
            oModel.setProperty(sOpPath + "/originalHours", oOp.hours);
            this._updateDeptSummary(sDeptPath);
            sap.m.MessageToast.show(oOp.name + " saved successfully.");
            var sShiftIdReload = oModel.getProperty("/summary/shiftId");
            if (sHouseId && sShiftIdReload) {
              this._loadOperatorList(
                sHouseId,
                sShiftIdReload,
                function () {
                  this.getView().setBusy(false);
                }.bind(this),
              );
            } else {
              this.getView().setBusy(false);
            }
          }.bind(this),
          error: function (oXHR, sStatus, sError) {
            sap.m.MessageBox.error(
              "Failed to save " + oOp.name + ". Please try again.",
            );
            this.getView().setBusy(false);
          }.bind(this),
          complete: function () {},
        });
      },

      // ── Bulk Save (all newly added operators across operations) ─────
      onSaveAssignment: function (oEvent) {
        const sDeptPath = this._deptPathFromContext(oEvent);
        if (!sDeptPath) return;
        const oModel = this.getView().getModel("viewModel");
        const oPOModel = this.getView().getModel("productionOrderModel");
        const oSession = this._getSessionParams();
        const sOrder = oPOModel.getProperty("/order");
        const sHouseId = oPOModel.getProperty("/houseId");
        const sShiftId = oModel.getProperty("/summary/shiftId");
        const sAppliedDate = oModel.getProperty("/appliedDate");
        const sShiftDate = sAppliedDate + "T00:00:00";

        const fnToIsoDuration = function (fDecimalHours) {
          var fVal = parseFloat(fDecimalHours) || 0;
          var iH = Math.floor(fVal);
          var iM = Math.floor((fVal - iH) * 60);
          var iS = Math.round(((fVal - iH) * 60 - iM) * 60);
          return (
            "PT" +
            String(iH).padStart(2, "0") +
            "H" +
            String(iM).padStart(2, "0") +
            "M" +
            String(iS).padStart(2, "0") +
            "S"
          );
        };

        const aAvail = oModel.getProperty("/availableOperators") || [];
        const aItems = [];
        const aMissing = [];

        [oModel.getProperty(sDeptPath)].forEach(function (oDept) {
          (oDept.operators || []).forEach(function (oOp) {
            const fHours = parseFloat(oOp.hours) || 0;
            if (fHours <= 0) {
              aMissing.push(oOp.name + " (" + oDept.operation + ")");
              return;
            }
            const oAvailOp = aAvail.find(function (op) {
              return op.id === oOp.id;
            });
            const fSavedHrs = oOp.isNew
              ? 0
              : parseFloat(oOp.originalHours) || 0;
            const fFree = Math.max(
              0,
              (oAvailOp ? parseFloat(oAvailOp.freeHoursVal) || 0 : 0) +
                fSavedHrs -
                fHours,
            );
            aItems.push({
              order: oDept.order,
              plant: oSession.plant,
              shiftDate: sShiftDate,
              sessionId: oSession.sessionId,
              operation: oDept.operation,
              shiftId: sShiftId,
              status: "",
              employeeId: oOp.id,
              houseId: sHouseId,
              plannedHrs: fnToIsoDuration(fHours),
              freeHrs: fnToIsoDuration(fFree),
              targetQty: String(oOp.targetQty),
              unit: oDept.unit,
            });
          });
        });

        if (aMissing.length) {
          MessageBox.error(
            "Please enter assigned hours for:\n" + aMissing.join("\n"),
            { title: "Assigned Hours Missing" },
          );
          return;
        }
        if (!aItems.length) {
          sap.m.MessageToast.show("No operators to save.");
          return;
        }

        const oPayload = {
          order: sOrder,
          shiftId: sShiftId,
          shiftDt: sShiftDate,
          houseId: sHouseId,
          employeeId: oSession.employeeId,
          plant: oSession.plant,
          sessionId: oSession.sessionId,
          NpToAssignment: aItems,
        };
        console.log("bulkoperatorassign payload:", oPayload);

        this.getView().setBusy(true);
        $.ajax({
          url: Base_url + "/api/productionconfirmation/bulkoperatorassign",
          method: "POST",
          headers: ngrokHeaders,
          contentType: "application/json",
          data: JSON.stringify(oPayload),
          success: function (oResponse) {
            console.log("bulkoperatorassign response:", oResponse);
            if (oResponse && oResponse.success === false) {
              var sErr = "Failed to save operator assignments.";
              try {
                sErr =
                  oResponse.error.error.message.value ||
                  oResponse.message ||
                  sErr;
              } catch (e) {
                sErr = (oResponse && oResponse.message) || sErr;
              }
              this.getView().setBusy(false);
              MessageBox.error(sErr, { title: "Save Failed" });
              return;
            }
            sap.m.MessageToast.show(
              aItems.length + " operator assignment(s) saved successfully.",
            );
            this._applyFilters(sOrder, sAppliedDate, sShiftId);
          }.bind(this),
          error: function (oXHR) {
            var sMsg = "Failed to save operator assignments.";
            try {
              var oErr = JSON.parse(oXHR.responseText);
              sMsg =
                (oErr.error &&
                  oErr.error.error &&
                  oErr.error.error.message &&
                  oErr.error.error.message.value) ||
                oErr.message ||
                sMsg;
            } catch (e) {}
            this.getView().setBusy(false);
            MessageBox.error(sMsg, { title: "Save Failed" });
          }.bind(this),
        });
      },

      // ── API Calls ───────────────────────────────────────────────────

      // Converts an ISO-8601 duration ("PT00H00M00S") to "HH:MM:SS".
      // Returns the original value unchanged if it doesn't match.
      _formatIsoDuration: function (sVal) {
        if (!sVal) return sVal;
        var oMatch = sVal.toString().match(/^PT(\d+)H(\d+)M(\d+)S$/);
        if (!oMatch) return sVal;
        return (
          oMatch[1].padStart(2, "0") +
          ":" +
          oMatch[2].padStart(2, "0") +
          ":" +
          oMatch[3].padStart(2, "0")
        );
      },

      _loadProductionOrder: function (sOrderId, fnCallback) {
        var oCookies = this._parseCookies();
        var sUrl =
          Base_url +
          "/api/productionOrder/getProductionOrder/" +
          oCookies["employeeId"] +
          "/" +
          oCookies["plant"] +
          "/" +
          oCookies["sessionId"] +
          "/" +
          sOrderId;

        $.ajax({
          url: sUrl,
          method: "GET",
          headers: ngrokHeaders,
          contentType: "application/json",
          success: function (oResponse) {
            if (oResponse.success === false) {
              var sErrMsg = "";
              try {
                sErrMsg =
                  oResponse.error.error.message.value ||
                  oResponse.message ||
                  "Order not found.";
              } catch (e) {
                sErrMsg = oResponse.message || "Order not found.";
              }
              this.getView()
                .getModel("viewModel")
                .setProperty("/orderLoaded", false);
              this.getView()
                .getModel("viewModel")
                .setProperty("/operatorsLoading", false);
              this.getView().setBusy(false);
              sap.m.MessageBox.error(sErrMsg, { title: "Order Not Found" });
              return;
            }
            var oOrder = oResponse.results ? oResponse.results[0] : oResponse;
            var oData = Object.assign({}, oOrder);
            delete oData.__metadata;
            oData.MinCycleTime = this._formatIsoDuration(oData.MinCycleTime);
            oData.MaxCycleTime = this._formatIsoDuration(oData.MaxCycleTime);
            oData.PlnMinCycle = this._formatIsoDuration(oData.PlnMinCycle);
            oData.PlnMaxCycle = this._formatIsoDuration(oData.PlnMaxCycle);
            this.getView().setModel(
              new JSONModel(oData),
              "productionOrderModel",
            );
            this.getView()
              .getModel("viewModel")
              .setProperty("/orderLoaded", true);
            sap.m.MessageToast.show(
              "Production order " + oData.order + " loaded successfully.",
            );
            if (fnCallback) {
              fnCallback(oData.houseId);
            }
          }.bind(this),
          error: function (oXHR, sStatus, sError) {
            var sMsg = "Failed to fetch production order.";
            try {
              var oErr = JSON.parse(oXHR.responseText);
              sMsg =
                (oErr.error &&
                  oErr.error.error &&
                  oErr.error.error.message &&
                  oErr.error.error.message.value) ||
                oErr.message ||
                sMsg;
            } catch (e) {}
            this.getView()
              .getModel("viewModel")
              .setProperty("/orderLoaded", false);
            this.getView()
              .getModel("viewModel")
              .setProperty("/operatorsLoading", false);
            this.getView().setBusy(false);
            sap.m.MessageBox.error(sMsg, { title: "Order Not Found" });
          },
          complete: this._onCallComplete.bind(this),
        });
      },

      _loadShiftList: function (fnCallback) {
        var oCookies = this._parseCookies();
        var sUrl =
          Base_url +
          "/api/operatorAssignment/getShiftList/" +
          oCookies["plant"];

        $.ajax({
          url: sUrl,
          method: "GET",
          headers: ngrokHeaders,
          contentType: "application/json",
          success: function (oResponse) {
            var fnParseDuration = function (s) {
              var h = parseInt((s.match(/(\d+)H/) || [])[1] || 0);
              var m = parseInt((s.match(/(\d+)M/) || [])[1] || 0);
              return (
                String(h).padStart(2, "0") + ":" + String(m).padStart(2, "0")
              );
            };
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
          error: function (oXHR, sStatus, sError) {},
          complete: this._onCallComplete.bind(this),
        });
      },

      _loadOperationList: function (sOrderId, fnCallback) {
        var o = this._getSessionParams();
        var sUrl =
          Base_url +
          "/api/operatorAssignment/getOperationList/" +
          o.employeeId +
          "/" +
          o.plant +
          "/" +
          o.sessionId +
          "/" +
          sOrderId;

        $.ajax({
          url: sUrl,
          method: "GET",
          headers: ngrokHeaders,
          contentType: "application/json",
          success: function (oResponse) {
            console.log("getOperationList response:", oResponse);
            if (oResponse.success === false) {
              var sErrMsg = "";
              try {
                sErrMsg =
                  oResponse.error.error.message.value ||
                  oResponse.message ||
                  "Failed to fetch operation list.";
              } catch (e) {
                sErrMsg =
                  oResponse.message || "Failed to fetch operation list.";
              }
              sap.m.MessageBox.error(sErrMsg, {
                title: "Operation List Error",
              });
              if (fnCallback) {
                fnCallback(false);
              }
              return;
            }
            var aResults = (oResponse.results || []).map(function (o) {
              var oItem = Object.assign({}, o);
              delete oItem.__metadata;
              return oItem;
            });
            this.getView().setModel(
              new JSONModel({ results: aResults }),
              "operationListModel",
            );
            var aDepts = aResults.map(function (op) {
              return {
                key: op.operation,
                label:
                  op.operation +
                  (op.operationDesc ? " · " + op.operationDesc : ""),
                operation: op.operation,
                operationDesc: op.operationDesc,
                workCenter: op.workCenter,
                workCenterDesc: op.workCenterDesc,
                order: op.order,
                AssignedOperators: op.AssignedOperators,
                quantity: op.quantity,
                scrapQty: op.scrapQty,
                yieldQty: op.yieldQty,
                unit: op.unit,
                operHrs: parseFloat(op.operHrs) || SHIFT_HOURS,
                operTargetQty: parseFloat(op.targetQty) || 0,
                operTargetUnit: op.unit || "",
                isMachineSpecific: op.isMachineSpecific === "X",
                isLaborSpecific: op.isLaborSpecific === "X",
                stdRate: 0,
                operators: [],
                operatorCount: 0,
                totalHours: 0,
                totalTarget: 0,
                hasUnsavedChanges: false,
                selectedOperator: "",
                selectedOperatorName: "",
              };
            });
            this.getView().getModel("viewModel").setProperty("/depts", aDepts);
            if (fnCallback) {
              fnCallback(true);
            }
          }.bind(this),
          error: function (oXHR, sStatus, sError) {
            var sMsg = "Failed to fetch operation list.";
            try {
              var oErr = JSON.parse(oXHR.responseText);
              sMsg =
                (oErr.error &&
                  oErr.error.error &&
                  oErr.error.error.message &&
                  oErr.error.error.message.value) ||
                oErr.message ||
                sMsg;
            } catch (e) {}
            sap.m.MessageBox.error(sMsg, { title: "Operation List Error" });
            if (fnCallback) {
              fnCallback(false);
            }
          },
          complete: this._onCallComplete.bind(this),
        });
      },

      _loadOperatorList: function (sHouseId, sShiftId, fnCallback) {
        var o = this._getSessionParams();
        var sUrl =
          Base_url +
          "/api/operatorAssignment/getOperatorList/" +
          o.employeeId +
          "/" +
          o.plant +
          "/" +
          o.sessionId +
          "/" +
          sHouseId +
          "/" +
          sShiftId +
          "/" +
          encodeURIComponent(
            this.getView().getModel("viewModel").getProperty("/appliedDate") +
              "T00:00:00",
          );

        $.ajax({
          url: sUrl,
          method: "GET",
          headers: ngrokHeaders,
          contentType: "application/json",
          success: function (oResponse) {
            if (oResponse.success === false) {
              var sErrMsg = "";
              try {
                sErrMsg =
                  oResponse.error.error.message.value ||
                  oResponse.message ||
                  "Failed to fetch operator list.";
              } catch (e) {
                sErrMsg = oResponse.message || "Failed to fetch operator list.";
              }
              this.getView()
                .getModel("viewModel")
                .setProperty("/operatorsLoading", false);
              this.getView().setBusy(false);
              sap.m.MessageBox.error(sErrMsg, { title: "Operator List Error" });
              return;
            }
            var aResults = (oResponse.results || []).map(function (o) {
              var oItem = Object.assign({}, o);
              delete oItem.__metadata;
              return oItem;
            });
            this.getView().setModel(
              new JSONModel({ results: aResults }),
              "operatorListModel",
            );
            var fnParseDuration = function (s) {
              if (!s) return "0:00";
              var h = parseInt((s.match(/PT(\d+)H/) || [])[1] || 0);
              var m = parseInt((s.match(/(\d+)M/) || [])[1] || 0);
              return h + "h " + String(m).padStart(2, "0") + "m";
            };
            var fnParseToDecimal = function (s) {
              if (!s) return 0;
              var h = parseInt((s.match(/PT(\d+)H/) || [])[1] || 0);
              var m = parseInt((s.match(/(\d+)M/) || [])[1] || 0);
              return h + m / 60;
            };
            var aOperators = aResults.map(function (o) {
              var fVal = fnParseToDecimal(o.freeHours);
              return {
                id: o.employeeId,
                name: o.employeeName,
                designation: o.roleDesc,
                freeHours: fnParseDuration(o.freeHours),
                freeHoursVal: fVal,
                totalShiftHours: fnParseDuration(o.totalShiftHours),
                assignedHours: fnParseDuration(o.assignedHours),
              };
            });
            this.getView()
              .getModel("viewModel")
              .setProperty("/availableOperators", aOperators);
            if (typeof fnCallback === "function") {
              fnCallback();
            }
          }.bind(this),
          error: function (oXHR, sStatus, sError) {
            this.getView()
              .getModel("viewModel")
              .setProperty("/operatorsLoading", false);
            this.getView().setBusy(false);
          }.bind(this),
          complete: this._onCallComplete.bind(this),
        });
      },
    });
  },
);
