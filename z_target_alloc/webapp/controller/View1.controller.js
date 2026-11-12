sap.ui.define([
    "sap/ui/core/mvc/Controller",
    "sap/m/Panel",
    "sap/m/Text",
    "sap/m/HBox",
    "sap/m/VBox",
    "sap/m/Table",
    "sap/m/Column",
    "sap/m/ColumnListItem",
    "sap/m/Input",
    "sap/m/Button",
    "sap/m/MessageToast",
    "sap/ui/core/CustomData",
    "sap/tnt/InfoLabel"
], function (Controller, Panel, Text, HBox, VBox, Table, Column, ColumnListItem, Input, Button, MessageToast, CustomData, InfoLabel) {
    "use strict";

    return Controller.extend("ztargetalloc.controller.View1", {

        onInit: function () {
            var oView = this.getView();

            // Reference the VBox inside DynamicPage content
            this.oContentVBox = oView.byId("contentVBox");

            // Attach Go button press
            oView.byId("goButton").attachPress(this.onGoPress.bind(this));
        },

        onAfterRendering: function () {
            setTimeout(() => {

                this.byId("datePicker").focus();
            }, 200)
        },

        onGoPress: function () {
            var oView = this.getView();

            // Sample data
            var aData = [
                {
                    OpNo: "10",
                    OpDesc: "Cutting",
                    TotalQty: 100,
                    ConfirmedQty: 50,
                    PendingQty: 50,
                    PendingTarget: 40,
                    Details: [
                        { EmpId: "E001", EmpName: "John", TargetHours: 5, TargetQty: 10 },
                        { EmpId: "E002", EmpName: "Alice", TargetHours: 4, TargetQty: 8 }
                    ]
                },
                {
                    OpNo: "20",
                    OpDesc: "Sewing",
                    TotalQty: 200,
                    ConfirmedQty: 100,
                    PendingQty: 100,
                    PendingTarget: 80,
                    Details: [
                        { EmpId: "E003", EmpName: "Bob", TargetHours: 6, TargetQty: 15 }
                    ]
                },
                 {
                    OpNo: "21",
                    OpDesc: "Demo",
                    TotalQty: 1,
                    ConfirmedQty: 0,
                    PendingQty: 100,
                    PendingTarget: 80,
                    Details: [
                       
                    ]
                }
            ];

            this.oContentVBox.removeAllItems();

            aData.forEach(function (oOp) {
                // Panel
                var oPanel = new Panel({
                    headerText: "Operation: " + oOp.OpNo,
                    expandable: true,
                    expanded: true
                }).addStyleClass("sapUiSmallMarginBottom");

                // Store operation info in CustomData
                oPanel.addCustomData(new CustomData({ key: "OpNo", value: oOp.OpNo }));
                oPanel.addCustomData(new CustomData({ key: "OpDesc", value: oOp.OpDesc }));
                oPanel.addCustomData(new CustomData({ key: "TotalQty", value: oOp.TotalQty }));
                oPanel.addCustomData(new CustomData({ key: "ConfirmedQty", value: oOp.ConfirmedQty }));
                oPanel.addCustomData(new CustomData({ key: "PendingQty", value: oOp.PendingQty }));
                oPanel.addCustomData(new CustomData({ key: "PendingTarget", value: oOp.PendingTarget }));

                // Header row using InfoLabel
                var oHeaderRow = new HBox({
                    justifyContent: "SpaceBetween",
                    wrap: "Wrap",
                    items: [
                        new sap.tnt.InfoLabel({
                            text: "Op No: " + oOp.OpNo,
                            colorScheme: 7
                        }),
                        new sap.tnt.InfoLabel({
                            text: "Op Desc: " + oOp.OpDesc,
                            colorScheme: 5
                        }),
                        new sap.tnt.InfoLabel({
                            text: "Total Qty: " + oOp.TotalQty,
                            colorScheme: 9
                        }),
                        new sap.tnt.InfoLabel({
                            text: "Confirmed Qty: " + oOp.ConfirmedQty,
                            colorScheme: 8
                        }),
                        new sap.tnt.InfoLabel({
                            text: "Pending Qty: " + oOp.PendingQty,
                            colorScheme: 3
                        }),
                        new sap.tnt.InfoLabel({
                            text: "Pending Target: " + oOp.PendingTarget,
                            colorScheme: 4
                        })
                    ]
                }).addStyleClass("sapUiSmallMarginBottom");

                // Table
                var oTable = new Table({
                    growing: true,
                    columns: [
                        new Column({ header: new Text({ text: "S.No" }) }),
                        new Column({ header: new Text({ text: "Operation" }) }),
                        new Column({ header: new Text({ text: "Emp ID" }) }),
                        new Column({ header: new Text({ text: "Emp Name" }) }),
                        new Column({ header: new Text({ text: "Target Hours" }) }),
                        new Column({ header: new Text({ text: "Target Qty" }) }),
                        new Column({ header: new Text({ text: "Actions" }) })
                    ]
                });

                oOp.Details.forEach(function (d, index) {
                    var oRow = this.createTableRow(index + 1, oOp.OpNo, d.EmpId, d.EmpName, d.TargetHours, d.TargetQty, oTable);
                    oTable.addItem(oRow);
                }.bind(this));

                // Add row button
                var oAddRowButton = new Button({
                    text: "Row",
                    icon: "sap-icon://add",
                    type: "Emphasized",
                    press: function () {
                        var newIndex = oTable.getItems().length + 1;
                        var oRow = this.createTableRow(newIndex, oOp.OpNo, "", "", "", "", oTable);
                        oTable.addItem(oRow);
                    }.bind(this)
                }).addStyleClass("sapUiSmallMarginTop");

                var oVBox = new VBox({ items: [oHeaderRow, oTable, oAddRowButton], width: "100%", class: "sapUiSmallMargin" });
                oPanel.addContent(oVBox);

                this.oContentVBox.addItem(oPanel);

            }.bind(this));
        },
        createTableRow: function (sNo, opNo, empId, empName, targetHours, targetQty, oTable) {
            return new ColumnListItem({
                cells: [
                    new Text({ text: sNo }),
                    new Text({ text: opNo }),
                    new Input({ value: empId }),
                    new Input({ value: empName }),
                    new Input({ value: targetHours, type: "Number" }),
                    new Input({ value: targetQty, type: "Number" }),
                    new HBox({
                        items: [
                            new Button({

                                icon: "sap-icon://delete",
                                type: "Reject",
                                press: function (oEvent) {
                                    var oItem = oEvent.getSource()
                                        .getParent()
                                        .getParent();
                                    oTable.removeItem(oItem);

                                    // Re-number S.No
                                    oTable.getItems().forEach(function (row, idx) {
                                        row.getCells()[0].setText(idx + 1);
                                    });
                                }
                            })
                        ]
                    })
                ]
            });
        },
        onResetPress: function () {
            // Clear previous dynamic panels
            this.oContentVBox.removeAllItems();
            MessageToast.show("Page Cleared")
        }
        , onSavePress: function () {
            var aPanels = this.oContentVBox.getItems(); // All panels inside contentVBox
            var aAllData = [];

            aPanels.forEach(function (oPanel) {
                var oVBox = oPanel.getContent()[0]; // VBox inside panel
                var oTable = oVBox.getItems()[1];   // Table is second item in VBox

                var oOpData = {
                    OpNo: oPanel.data("OpNo"),
                    OpDesc: oPanel.data("OpDesc"),
                    TotalQty: Number(oPanel.data("TotalQty")),
                    ConfirmedQty: Number(oPanel.data("ConfirmedQty")),
                    PendingQty: Number(oPanel.data("PendingQty")),
                    PendingTarget: Number(oPanel.data("PendingTarget")),
                    Details: []
                };

                oTable.getItems().forEach(function (row) {
                    var cells = row.getCells();
                    oOpData.Details.push({
                        EmpId: cells[2].getValue(),
                        EmpName: cells[3].getValue(),
                        TargetHours: Number(cells[4].getValue()) || 0,
                        TargetQty: Number(cells[5].getValue()) || 0
                    });
                });

                aAllData.push(oOpData);
            });

            console.log("All Data:", aAllData);
            MessageToast.show("All data logged to console!");
        }

    });
});