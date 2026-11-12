sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/ui/model/json/JSONModel"
], (Controller, JSONModel) => {
    "use strict";

    return Controller.extend("shiftstartinspection.controller.View1", {
        onInit: function () {
            var oModel = new sap.ui.model.json.JSONModel({
                overallProgress: 0,
                overallState: "None",
                sections: {
                    machineAndEquipment: { passed: 0, failed: 0, conditional: 0, pending: 0, answered: 0, totalQuestions: 0, progress: 0, state: "None", icon: "sap-icon://pending" },
                    materialReadiness: { passed: 0, failed: 0, conditional: 0, pending: 0, answered: 0, totalQuestions: 0, progress: 0, state: "None", icon: "sap-icon://pending" },
                    operatorReadiness: { passed: 0, failed: 0, conditional: 0, pending: 0, answered: 0, totalQuestions: 0, progress: 0, state: "None", icon: "sap-icon://pending" },
                    previousShiftHandover: { passed: 0, failed: 0, conditional: 0, pending: 0, answered: 0, totalQuestions: 0, progress: 0, state: "None", icon: "sap-icon://pending" },
                    toolingAndDies: { passed: 0, failed: 0, conditional: 0, pending: 0, answered: 0, totalQuestions: 0, progress: 0, state: "None", icon: "sap-icon://pending" },
                    workEnvironment: { passed: 0, failed: 0, conditional: 0, pending: 0, answered: 0, totalQuestions: 0, progress: 0, state: "None", icon: "sap-icon://pending" }
                }
            });
            this.getView().setModel(oModel, "inspection");
        },
        onStatusChange: function (oEvent) {

            //  Get selected index
            var iIndex = oEvent.getParameter("selectedIndex");

            //  Get RadioButtonGroup
            var oGroup = oEvent.getSource();

            //  Get selected RadioButton using index
            var oSelectedButton = oGroup.getButtons()[iIndex];

            //  Get text (OK / Minor Issue / Not OK)
            var sText = oSelectedButton.getText();

            // Get current card (VBox)
            var oVBox = oGroup.getParent();

            // Header
            var oHeader = oVBox.getItems()[0];

            // Status
            var oStatus = oHeader.getItems()[1];

            // Update based on text
            if (sText === "OK" || sText === "Compliant" || sText === "Good" || sText === "Replaced" || sText === "Clean" || sText === "None Found" || sText === "No Issues") {
                oStatus.setText("PASS");
                oStatus.setState("Success");

            } else if (sText === "Minor Issue" || sText === "Partial" || sText === "Minor" || sText === "Worn" || sText === "Needs Check") {
                oStatus.setText("CONDITIONAL");
                oStatus.setState("Warning");

            } else if (sText === "Not OK" || sText === "Critical Missing" || sText === "Issue Found" || sText === "Non-Compliant" || sText === "Damaged" || sText === "Unacceptable" || sText === "Risk Found" || sText === "Critical Item") {
                oStatus.setText("FAILED");
                oStatus.setState("Error");
            }

            this._computeSummary();
        },
        onOperatorChange: function (oEvent) {

            var sValue = oEvent.getSource().getValue();
            var iValue = parseInt(sValue, 10);

            if (isNaN(iValue)) {
                return; // ignore invalid input
            }

            // Get current card
            var oHBox = oEvent.getSource().getParent(); // Operator row
            var oVBox = oHBox.getParent(); // Full card

            // Header
            var oHeader = oVBox.getItems()[0];

            // Right side status (PENDING → PASS/FAILED)
            var oHeaderStatus = oHeader.getItems()[1];

            // Row status (WITHIN SPEC)
            var oRow = oVBox.getItems()[2]; // Operator row
            var oRowStatus = oRow.getItems()[3];

            // Logic
            if (iValue >= 8 && iValue <= 14) {
                //  PASS
                oHeaderStatus.setText("PASS");
                oHeaderStatus.setState("Success");

                oRowStatus.setText("WITHIN SPEC");
                oRowStatus.setState("Success");

            } else if ((iValue >= 6 && iValue < 8) || (iValue > 14 && iValue <= 16)) {
                //  CONDITIONAL
                oHeaderStatus.setText("CONDITIONAL");
                oHeaderStatus.setState("Warning");

                oRowStatus.setText("NEAR LIMIT");
                oRowStatus.setState("Warning");

            } else {
                //  FAILED
                oHeaderStatus.setText("FAILED");
                oHeaderStatus.setState("Error");

                oRowStatus.setText("OUT OF SPEC");
                oRowStatus.setState("Error");
            }
            this._computeSummary();
        },
        onTemperatureChange: function (oEvent) {

            var oInput = oEvent.getSource();
            var fValue = parseFloat(oInput.getValue());

            if (isNaN(fValue)) return;

            // Structure
            var oRow = oInput.getParent();
            var oVBox = oRow.getParent();
            var oHeader = oVBox.getItems()[0];

            var oHeaderStatus = oHeader.getItems()[1];
            var oRowStatus = oRow.getItems()[3];

            //  Logic
            if (fValue >= 18 && fValue <= 25) {
                oHeaderStatus.setText("PASS");
                oHeaderStatus.setState("Success");

                oRowStatus.setText("WITHIN SPEC");
                oRowStatus.setState("Success");

            } else if ((fValue >= 16 && fValue < 18) || (fValue > 25 && fValue <= 27)) {
                oHeaderStatus.setText("CONDITIONAL");
                oHeaderStatus.setState("Warning");

                oRowStatus.setText("NEAR LIMIT");
                oRowStatus.setState("Warning");

            } else {
                oHeaderStatus.setText("FAILED");
                oHeaderStatus.setState("Error");

                oRowStatus.setText("OUT OF SPEC");
                oRowStatus.setState("Error");
            }
            this._computeSummary();
        },
        onHumidityChange: function (oEvent) {

            var oInput = oEvent.getSource();
            var fValue = parseFloat(oInput.getValue());

            if (isNaN(fValue)) return;

            // Structure
            var oRow = oInput.getParent();
            var oVBox = oRow.getParent();
            var oHeader = oVBox.getItems()[0];

            var oHeaderStatus = oHeader.getItems()[1];
            var oRowStatus = oRow.getItems()[3];

            //  Logic
            if (fValue >= 45 && fValue <= 65) {
                oHeaderStatus.setText("PASS");
                oHeaderStatus.setState("Success");

                oRowStatus.setText("WITHIN SPEC");
                oRowStatus.setState("Success");

            } else if ((fValue >= 40 && fValue < 45) || (fValue > 65 && fValue <= 70)) {
                oHeaderStatus.setText("CONDITIONAL");
                oHeaderStatus.setState("Warning");

                oRowStatus.setText("NEAR LIMIT");
                oRowStatus.setState("Warning");

            } else {
                oHeaderStatus.setText("FAILED");
                oHeaderStatus.setState("Error");

                oRowStatus.setText("OUT OF SPEC");
                oRowStatus.setState("Error");
            }
            this._computeSummary();
        },
        _computeSummary: function () {
            var oSummary = {};

            var aPanels = this.byId("page").findAggregatedObjects(true).filter(function (o) {
                return o.isA("sap.m.Panel");
            });

            aPanels.forEach(function (oPanel) {
                var sSectionName = oPanel.getHeaderText().replace(/^[^\w]+/, "").trim();
                var sKey = sSectionName.replace(/\s+(.)/g, function (_, c) { return c.toUpperCase(); });
                sKey = sKey.charAt(0).toLowerCase() + sKey.slice(1);

                var aAllCards = oPanel.findAggregatedObjects(true).filter(function (o) {
                    return o.isA("sap.m.HBox") && o.hasStyleClass("questionCard");
                });

                var iTotalQuestions = aAllCards.length;
                var iPassed = 0, iFailed = 0, iConditional = 0, iPending = 0;

                aAllCards.forEach(function (oCard) {
                    var oVBox = oCard.getItems()[0];
                    var oHeaderHBox = oVBox.getItems()[0];

                    var oStatusOS = oHeaderHBox.getItems().find(function (o) {
                        return o.isA("sap.m.ObjectStatus");
                    });

                    var sStatusText = oStatusOS ? oStatusOS.getText().toUpperCase() : "PENDING";

                    if (sStatusText === "PASS") iPassed++;
                    else if (sStatusText === "FAILED") iFailed++;
                    else if (sStatusText === "CONDITIONAL") iConditional++;
                    else iPending++;
                });

                var iAnswered = iPassed + iFailed + iConditional;
                var iProgress = iTotalQuestions > 0 ? Math.round((iAnswered / iTotalQuestions) * 100) : 0;

                var sState;
                if (iFailed > 0) sState = "Error";
                else if (iConditional > 0) sState = "Warning";
                else sState = "Success";

                var iAnswered = iPassed + iFailed + iConditional;

                oSummary[sKey] = {
                    sectionName: sSectionName,
                    totalQuestions: iTotalQuestions,
                    answered: iAnswered,
                    passed: iPassed,
                    failed: iFailed,
                    conditional: iConditional,
                    pending: iPending,
                    progress: iProgress,
                    state: sState
                };
            }.bind(this));

            // Overall progress and state
            var iTotalAll = 0, iAnsweredAll = 0, iFailedAll = 0, iConditionalAll = 0;
            Object.values(oSummary).forEach(function (s) {
                iTotalAll += s.totalQuestions;
                iAnsweredAll += (s.passed + s.failed + s.conditional);
                iFailedAll += s.failed;
                iConditionalAll += s.conditional;
            });

            var iOverall = iTotalAll > 0 ? Math.round((iAnsweredAll / iTotalAll) * 100) : 0;

            var sOverallState;
            if (iFailedAll > 0) sOverallState = "Error";
            else if (iConditionalAll > 0) sOverallState = "Warning";
            else sOverallState = "Success";

            // Push to model
            var oModel = this.getView().getModel("inspection");
            oModel.setProperty("/sections", oSummary);
            oModel.setProperty("/overallProgress", iOverall);
            oModel.setProperty("/overallState", sOverallState);

            return oSummary;
        },
        formatSectionIcon: function (sState) {
            if (sState === "Error") return "sap-icon://decline";
            if (sState === "Warning") return "sap-icon://alert";
            if(sState === "Success") return "sap-icon://accept";
            return "sap-icon://pending";
        }
    });
});