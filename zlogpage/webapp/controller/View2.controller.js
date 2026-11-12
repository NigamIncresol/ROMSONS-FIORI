sap.ui.define(
  [
    "sap/ui/core/mvc/Controller",
    "sap/m/MessageToast",
    "sap/m/MessageBox",
    "sap/ui/model/json/JSONModel",
    "sap/ui/core/HTML",
    "sap/m/Dialog",
    "sap/m/Popover",
  ],
  function (
    Controller,
    MessageToast,
    MessageBox,
    JSONModel,
    HTML,
    Dialog,
    Popover,
  ) {
    "use strict";

    // ═══════════════════════════════════════════════════════════
    // BASE URL — comment one, uncomment the other
    // ═══════════════════════════════════════════════════════════
    // const Base_url = "http://192.168.0.136:3000";
    const Base_url = "http://localhost:3000";
    // const Base_url = "http://192.168.1.61:3000";

    // ═══════════════════════════════════════════════════════════
    // LOCALHOST URLs — uncomment this block to use localhost
    // ═══════════════════════════════════════════════════════════
    const Production_Orders_Url = "http://localhost:9001/index.html";
    const Operator_Assignment_Url = "http://localhost:9002/index.html";
    const Job_Card_List_Url = "http://localhost:9013/index.html";
    const Print_Job_Card_Url =
      "http://localhost:9011/index.html?doctype=jobcard";
    const Material_Reservation_Url = "http://localhost:9003/index.html";
    const Reservation_List_Url = "http://localhost:9005/index.html";
    const Reservation_Details_Url = "http://localhost:9006/index.html";
    const Download_Requisition_Slip_Url =
      "http://localhost:9011/index.html?doctype=requisition";
    const Create_Issue_Url = "http://localhost:9007/index.html";
    const Issue_List_Url = "http://localhost:9008/index.html";
    const Issue_Detail_Url = "http://localhost:9010/index.html";
    const Print_Issue_Slip_Url =
      "http://localhost:9011/index.html?doctype=issue";
    const Receipt_Confirmation_Url =
      "http://localhost:9009/index.html?navType=matDoc";
    const Confirmation_List_Url = "http://localhost:9012/index.html";
    const Print_Receiving_Slip_Url =
      "http://localhost:9011/index.html?doctype=receiving";
    const Production_Order_Confirmation_Url =
      "http://localhost:9014/index.html";
    const Order_Confirmation_List_Url = "http://localhost:9015/index.html";
    const Transfer_Material_Url = "http://localhost:9019/index.html";
    const Stock_Report_Url = "http://localhost:9018/index.html";
    const Operator_Performance_Report_Url = "http://localhost:9020/index.html";

    // ═══════════════════════════════════════════════════════════
    // INTERNAL URLs — uncomment this block to use production
    // ═══════════════════════════════════════════════════════════
    // const Production_Orders_Url =
    //   "https://romsonsfiori.incresol.com/ProductionOrderList/index.html";
    // const Operator_Assignment_Url =
    //   "https://romsonsfiori.incresol.com/CreateOperatorAssignment/index.html";
    // const Job_Card_List_Url =
    //   "https://romsonsfiori.incresol.com/JobCardList/index.html";
    // const Print_Job_Card_Url =
    //   "https://romsonsfiori.incresol.com/DocumentCenter/index.html?doctype=jobcard";
    // const Material_Reservation_Url =
    //   "https://romsonsfiori.incresol.com/CreateMaterialReservation/index.html";
    // const Reservation_List_Url =
    //   "https://romsonsfiori.incresol.com/ReservationList/index.html";
    // const Reservation_Details_Url =
    //   "https://romsonsfiori.incresol.com/ReservationDetails/index.html";
    // const Download_Requisition_Slip_Url =
    //   "https://romsonsfiori.incresol.com/DocumentCenter/index.html?doctype=requisition";
    // const Create_Issue_Url =
    //   "https://romsonsfiori.incresol.com/CreateMaterialIssue/index.html";
    // const Issue_List_Url =
    //   "https://romsonsfiori.incresol.com/IssueList/index.html";
    // const Issue_Detail_Url =
    //   "https://romsonsfiori.incresol.com/IssueDetails/index.html";
    // const Print_Issue_Slip_Url =
    //   "https://romsonsfiori.incresol.com/DocumentCenter/index.html?doctype=issue";
    // const Receipt_Confirmation_Url =
    //   "https://romsonsfiori.incresol.com/ReceiptConfirmation/index.html?navType=matDoc";
    // const Confirmation_List_Url =
    //   "https://romsonsfiori.incresol.com/ConfirmationList/index.html";
    // const Print_Receiving_Slip_Url =
    //   "https://romsonsfiori.incresol.com/DocumentCenter/index.html?doctype=receiving";
    // const Production_Order_Confirmation_Url =
    //   "https://romsonsfiori.incresol.com/ProductionOrderConfirmation/index.html";
    // const Order_Confirmation_List_Url =
    //   "https://romsonsfiori.incresol.com/OrderConfirmationList/index.html";
    // const Transfer_Material_Url =
    //   "https://romsonsfiori.incresol.com/TransferMaterial/index.html";
    // const Stock_Report_Url =
    //   "https://romsonsfiori.incresol.com/StockReport/index.html";
    // const Operator_Performance_Report_Url =
    //   "https://romsonsfiori.incresol.com/OperatorPerformanceReport/index.html";

    // ═══════════════════════════════════════════════════════════
    // PRODUCTION URLs — uncomment this block to use production
    // ═══════════════════════════════════════════════════════════
    // const Production_Orders_Url =
    //   "https://webapps.romsons.com/ProductionOrderList/index.html";
    // const Operator_Assignment_Url =
    //   "https://webapps.romsons.com/CreateOperatorAssignment/index.html";
    // const Job_Card_List_Url =
    //   "https://webapps.romsons.com/JobCardList/index.html";
    // const Print_Job_Card_Url =
    //   "https://webapps.romsons.com/DocumentCenter/index.html?doctype=jobcard";
    // const Material_Reservation_Url =
    //   "https://webapps.romsons.com/CreateMaterialReservation/index.html";
    // const Reservation_List_Url =
    //   "https://webapps.romsons.com/ReservationList/index.html";
    // const Reservation_Details_Url =
    //   "https://webapps.romsons.com/ReservationDetails/index.html";
    // const Download_Requisition_Slip_Url =
    //   "https://webapps.romsons.com/DocumentCenter/index.html?doctype=requisition";
    // const Create_Issue_Url =
    //   "https://webapps.romsons.com/CreateMaterialIssue/index.html";
    // const Issue_List_Url = "https://webapps.romsons.com/IssueList/index.html";
    // const Issue_Detail_Url =
    //   "https://webapps.romsons.com/IssueDetails/index.html";
    // const Print_Issue_Slip_Url =
    //   "https://webapps.romsons.com/DocumentCenter/index.html?doctype=issue";
    // const Receipt_Confirmation_Url =
    //   "https://webapps.romsons.com/ReceiptConfirmation/index.html?navType=matDoc";
    // const Confirmation_List_Url =
    //   "https://webapps.romsons.com/ConfirmationList/index.html";
    // const Print_Receiving_Slip_Url =
    //   "https://webapps.romsons.com/DocumentCenter/index.html?doctype=receiving";

    // const Production_Order_Confirmation_Url =
    //   "https://webapps.romsons.com/ProductionOrderConfirmation/index.html";

    // const Order_Confirmation_List_Url =
    //   "https://webapps.romsons.com/OrderConfirmationList/index.html";
    // const Transfer_Material_Url =
    //   "https://webapps.romsons.com/TransferMaterial/index.html";
    // const Stock_Report_Url =
    //   "https://webapps.romsons.com/StockReport/index.html";
    // const Operator_Performance_Report_Url =
    //   "https://webapps.romsons.com/OperatorPerformanceReport/index.html";

    return Controller.extend("zlogpage.controller.View2", {
      // =========================================================
      // Init
      // =========================================================
      onInit: function () {
        var sImageUrl = sap.ui.require.toUrl("zlogpage/images/logoNew.svg");
        this.byId("logoImage").setSrc(sImageUrl);

        this.getOwnerComponent()
          .getRouter()
          .getRoute("RouteView2")
          .attachPatternMatched(this._onObjectMatched, this);
      },

      // =========================================================
      // Parse All Cookies into an Object
      // =========================================================
      _parseCookies: function () {
        var oCookies = {};
        document.cookie.split(";").forEach(function (sPair) {
          var aParts = sPair.trim().split("=");
          if (aParts.length >= 2) {
            oCookies[aParts[0].trim()] = decodeURIComponent(
              aParts.slice(1).join("="),
            );
          }
        });
        return oCookies;
      },

      // =========================================================
      // Enforce Session — show unauthorized dialog if cookies missing
      // =========================================================
      _enforceSession: function () {
        var that = this;
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
            "<a id='unauthGoToLogin' href='#' style='margin-top:24px;display:inline-block;padding:10px 28px;background:#e00000;color:#fff;border-radius:8px;font-size:14px;font-weight:600;text-decoration:none;letter-spacing:.3px;'>Go to Login</a>" +
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
            oDialog
              .$()
              .find("#unauthGoToLogin")
              .on("click", function (e) {
                e.preventDefault();
                oDialog.close();
                that.getOwnerComponent().getRouter().navTo("RouteView1");
              });
          },
        });

        oDialog.open();
        return false;
      },

      // =========================================================
      // Session Cookie Check (every 20s)
      // =========================================================
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
                  that.getOwnerComponent().getRouter().navTo("RouteView1");
                },
              });
            }
          }
        }, 30000);
      },

      // =========================================================
      // Route Matched
      // =========================================================
      _onObjectMatched: function (oEvent) {
        this.sEmployeeId = oEvent.getParameter("arguments").employeeId;
        this.sPlant = oEvent.getParameter("arguments").plant;

        // Hide slideshow and restore body background for launchpad
        var oBg = document.getElementById("loginBgSlideshow");
        if (oBg) {
          oBg.style.display = "none";
        }
        document.body.style.setProperty("background", "#f5f6f7", "important");

        // Reset visibility in case it was hidden by a previous _enforceSession call
        this.getView().setVisible(true);

        // Set userModel so all 8 tiles are visible
        var oUserModel = new JSONModel({
          tileCount: 8,
          employeeId: this.sEmployeeId,
          plant: this.sPlant,
        });
        this.getView().setModel(oUserModel, "userModel");

        // Set appModel for header display using cookie value
        var oAppModel = new JSONModel({
          employeeId: this._parseCookies()["employeeId"] || "",
        });
        this.getView().setModel(oAppModel, "appModel");

        // Block access immediately if cookies are missing
        if (!this._enforceSession()) {
          return;
        }

        // Clear any existing timer and start fresh on each navigation to View2
        if (this._oSessionCheckTimer) {
          clearInterval(this._oSessionCheckTimer);
          this._oSessionCheckTimer = null;
        }
        this._bSessionDialogOpen = false;
        this._startSessionCheck();
      },

      // =========================================================
      // Tile Press — Open Production Orders
      // =========================================================
      onOpenProductionOrders: function () {
        window.open(Production_Orders_Url, "_blank");
      },

      // =========================================================
      // Tile Press — Operator Assignment
      // =========================================================
      onOpenOperatorAssignment: function () {
        window.open(Operator_Assignment_Url, "_blank");
      },

      // =========================================================
      // Tile Press — Job Card List View
      // =========================================================
      onOpenJobCardList: function () {
        window.open(Job_Card_List_Url, "_blank");
      },

      // =========================================================
      // Tile Press — Print Job Card
      // =========================================================
      onOpenPrintJobCard: function () {
        window.open(Print_Job_Card_Url, "_blank");
      },

      // =========================================================
      // Tile Press — Material Request
      // =========================================================
      onOpenMaterialRequest: function () {
        window.open(Material_Reservation_Url, "_blank");
      },

      // =========================================================
      // Tile Press — Download Requisition Slip
      // =========================================================
      onOpenDownloadRequisitionSlip: function () {
        window.open(Download_Requisition_Slip_Url, "_blank");
      },

      // =========================================================
      // Tile Press — Reservation List
      // =========================================================
      onOpenReservationList: function () {
        window.open(Reservation_List_Url, "_blank");
      },

      // =========================================================
      // Tile Press — Show Reservation Details
      // =========================================================
      onOpenReservationDetails: function () {
        window.open(Reservation_Details_Url, "_blank");
      },

      // =========================================================
      // Tile Press — Issue List View
      // =========================================================
      onOpenIssueList: function () {
        window.open(Issue_List_Url, "_blank");
      },

      // =========================================================
      // Tile Press — Print Issue Slip
      // =========================================================
      onOpenPrintIssueSlip: function () {
        window.open(Print_Issue_Slip_Url, "_blank");
      },

      // =========================================================
      // Tile Press — Issue Detail View
      // =========================================================
      onOpenIssueDetail: function () {
        window.open(Issue_Detail_Url, "_blank");
      },

      // =========================================================
      // Tile Press — Print Receiving Slip
      // =========================================================
      onOpenPrintReceivingSlip: function () {
        window.open(Print_Receiving_Slip_Url, "_blank");
      },

      // =========================================================
      // Tile Press — Production Order Confirmation
      // =========================================================
      onOpenProductionOrderConfirmation: function () {
        window.open(Production_Order_Confirmation_Url, "_blank");
      },

      // =========================================================
      // Tile Press — Order Confirmation List / GRN Post
      // =========================================================
      onOpenOrderConfirmationList: function () {
        window.open(Order_Confirmation_List_Url, "_blank");
      },

      // =========================================================
      // Tile Press — Transfer Material
      // =========================================================
      onOpenTransferMaterial: function () {
        window.open(Transfer_Material_Url, "_blank");
      },

      // =========================================================
      // Tile Press — Stock Report
      // =========================================================
      onOpenStockReport: function () {
        window.open(Stock_Report_Url, "_blank");
      },

      // =========================================================
      // Tile Press — Operator Performance Report
      // =========================================================
      onOpenOperatorPerformanceReport: function () {
        window.open(Operator_Performance_Report_Url, "_blank");
      },

      // =========================================================
      // Tile Press — Receipt Confirmation
      // =========================================================
      onOpenReceiptConfirmation: function () {
        window.open(Receipt_Confirmation_Url, "_blank");
      },

      // =========================================================
      // Tile Press — Confirmation List View
      // =========================================================
      onOpenConfirmationList: function () {
        window.open(Confirmation_List_Url, "_blank");
      },

      // =========================================================
      // Tile Press — Tcreate Material Issue
      // =========================================================
      onOpenCreateMaterialIssue: function () {
        window.open(Create_Issue_Url, "_blank");
      },

      // =========================================================
      // Employee Info Popup
      // =========================================================
      onEmployeeInfoPress: function (oEvent) {
        var that = this;
        var sEmployeeId = this._parseCookies()["employeeId"] || "";

        if (!sEmployeeId) {
          MessageBox.error("Employee ID not found in session.");
          return;
        }

        this.getView().setBusy(true);

        $.ajax({
          url: Base_url + "/api/employeeinfo/" + sEmployeeId,
          method: "GET",
          contentType: "application/json",

          success: function (oData) {
            that.getView().setBusy(false);

            // Inject popup CSS once
            if (!document.getElementById("empInfoCSS")) {
              var oStyle = document.createElement("style");
              oStyle.id = "empInfoCSS";
              oStyle.textContent = [
                ".empInfoDialog{border-radius:12px!important;box-shadow:0 8px 24px rgba(0,0,0,.12)!important;border:1px solid #e4e6ea!important;}",
                ".empInfoDialog .sapMPopoverCont{border-radius:12px!important;overflow:hidden!important;}",
                ".empInfoDialog .sapMPopoverScroll{padding:0!important}",
                ".empInfo-body{font-family:'72','72full',Arial,sans-serif;background:#ffffff;}",
                ".empInfo-header{background:#ffffff;padding:14px 16px;display:flex;align-items:center;gap:12px;border-bottom:1px solid #f0f0f0;}",
                ".empInfo-avatar{width:40px;height:40px;border-radius:50%;background:#f2f4f5;display:flex;align-items:center;justify-content:center;font-size:18px;color:#555;flex-shrink:0;}",
                ".empInfo-name{color:#1a1a1a;font-size:0.95rem;font-weight:700;margin-bottom:1px;}",
                ".empInfo-id{color:#888;font-size:0.75rem;}",
                ".empInfo-rows{padding:8px 16px 12px;}",
                ".empInfo-row{display:flex;justify-content:space-between;align-items:flex-start;padding:7px 0;border-bottom:1px solid #f2f4f5;}",
                ".empInfo-row:last-child{border-bottom:none;}",
                ".empInfo-label{font-size:0.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.05em;color:#aaa;min-width:110px;}",
                ".empInfo-value{font-size:0.8rem;color:#333;font-weight:500;text-align:right;word-break:break-word;max-width:160px;}",
              ].join("");
              document.head.appendChild(oStyle);
            }

            var sName = oData.employeeName || "-";
            var sId = oData.employeeId || "-";
            var sEmail = oData.email || "-";
            var sType = oData.employeeType || "-";
            var sRole = oData.productionRole || "-";
            var sDesig = oData.officialDesignation || "-";

            var oHTML = new HTML({
              content:
                "<div class='empInfo-body'>" +
                "<div class='empInfo-header'>" +
                "<div class='empInfo-avatar'>&#128100;</div>" +
                "<div>" +
                "<div class='empInfo-name'>" +
                sName +
                "</div>" +
                "<div class='empInfo-id'>" +
                sId +
                "</div>" +
                "</div>" +
                "</div>" +
                "<div class='empInfo-rows'>" +
                "<div class='empInfo-row'><span class='empInfo-label'>Email</span><span class='empInfo-value'>" +
                sEmail +
                "</span></div>" +
                "<div class='empInfo-row'><span class='empInfo-label'>Employee Type</span><span class='empInfo-value'>" +
                sType +
                "</span></div>" +
                "<div class='empInfo-row'><span class='empInfo-label'>Production Role</span><span class='empInfo-value'>" +
                sRole +
                "</span></div>" +
                "<div class='empInfo-row'><span class='empInfo-label'>Designation</span><span class='empInfo-value'>" +
                sDesig +
                "</span></div>" +
                "</div>" +
                "</div>",
            });

            var oPopover = new Popover({
              contentWidth: "320px",
              showHeader: false,
              showArrow: true,
              placement: "Bottom",
              content: [oHTML],
              afterOpen: function () {
                oPopover.$().addClass("empInfoDialog");
                oPopover
                  .$()
                  .find("#empInfoCloseBtn")
                  .on("click", function () {
                    oPopover.close();
                  });
              },
              afterClose: function () {
                oPopover.destroy();
              },
            });

            oPopover.openBy(oEvent.getSource());
          },

          error: function (oError) {
            that.getView().setBusy(false);
            var sMsg = "Failed to fetch employee info";
            try {
              var oResp = JSON.parse(oError.responseText);
              sMsg = oResp.message || sMsg;
            } catch (e) {}
            MessageBox.error(sMsg);
          },
        });
      },

      // =========================================================
      // Logout
      // =========================================================
      onlogoutpress: function () {
        // =========================================
        // Get Cookie Function
        // =========================================
        function getCookie(name) {
          var value = "; " + document.cookie;

          var parts = value.split("; " + name + "=");

          if (parts.length === 2) {
            return decodeURIComponent(parts.pop().split(";").shift());
          }

          return "";
        }

        // =========================================
        // Read Cookies
        // =========================================
        var sUser = getCookie("employeeId");

        var sPlant = getCookie("plant");

        var sSessionId = getCookie("sessionId");

        console.log("Employee ID:", sUser);

        console.log("Plant:", sPlant);

        console.log("Session ID:", sSessionId);

        var that = this;

        // Show busy indicator
        this.getView().setBusy(true);

        // =========================================
        // Logout API Call
        // =========================================
        $.ajax({
          url: Base_url + "/api/auth/logout",

          method: "PUT",

          contentType: "application/json",

          data: JSON.stringify({
            employeeId: sUser,
            plant: sPlant,
            sessionId: sSessionId,
          }),

          // =====================================
          // Success
          // =====================================
          success: function (oData) {
            that.getView().setBusy(false);
            console.log("Logout Success Response:", oData);

            // Stop session check timer so it doesn't fire on the login page
            if (that._oSessionCheckTimer) {
              clearInterval(that._oSessionCheckTimer);
              that._oSessionCheckTimer = null;
            }

            // Clear Employee ID Cookie
            document.cookie =
              "employeeId=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";

            // Clear Plant Cookie
            document.cookie =
              "plant=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";

            // Clear Session Cookie
            document.cookie =
              "sessionId=; expires=Thu, 01 Jan 1970 00:00:00 UTC; path=/;";

            MessageToast.show(
              "Logout successful. Redirecting to login page...",
            );

            // Navigate to Login
            setTimeout(function () {
              that.getOwnerComponent().getRouter().navTo("RouteView1");
            }, 2000);
          },

          // =====================================
          // Error
          // =====================================
          error: function (oError) {
            that.getView().setBusy(false);
            console.log("Logout Error Response:", oError);

            var sMsg = "Logout Failed";

            try {
              var oResponse = JSON.parse(oError.responseText);

              sMsg = oResponse.message || sMsg;
            } catch (e) {
              console.log("Error Parsing Response:", e);
            }

            MessageBox.error(sMsg);
          },
        });
      },
    });
  },
);
